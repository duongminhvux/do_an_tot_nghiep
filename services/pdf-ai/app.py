import os
import json
import logging
import copy
from pathlib import Path
import threading
import time
import uuid
from typing import Any
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pipeline import analyze
from bundle import analyze_bundle
import learning

app = FastAPI(title="Local TOEIC PDF AI")
executor = ThreadPoolExecutor(max_workers=1)
lock = threading.Lock()
jobs: dict[str, dict] = {}
LIMIT = 25 * 1024 * 1024
QUEUE_BACKEND = os.getenv('PDF_AI_QUEUE_BACKEND', 'local').lower()
TTL = 24 * 60 * 60


def persist_job(job):
    target = Path(os.getenv('PDF_AI_ASSET_DIR', '/app/assets')) / job['id']
    target.mkdir(parents=True, exist_ok=True)
    temporary = target / 'job-state.tmp'
    temporary.write_text(json.dumps(job, ensure_ascii=False), encoding='utf8')
    temporary.replace(target / 'job-state.json')


def read_saved_job(job_id: str) -> dict | None:
    try:
        if str(uuid.UUID(job_id)) != job_id:
            return None
        path = Path(os.getenv('PDF_AI_ASSET_DIR', '/app/assets')) / job_id / 'job-state.json'
        return json.loads(path.read_text(encoding='utf8'))
    except (OSError, ValueError, json.JSONDecodeError):
        return None


def persist_job_inputs(job_id: str, files: dict[str, bytes], *, bundle: bool, test_number: int = 1):
    folder = Path(os.getenv('PDF_AI_ASSET_DIR', '/app/assets')) / job_id
    folder.mkdir(parents=True, exist_ok=True)
    for name, data in files.items():
        if not name.isidentifier() or len(data) > LIMIT or not data.startswith(b'%PDF-'):
            raise ValueError('Invalid PDF input')
        temp = folder / (name + '.partial')
        temp.write_bytes(data)
        temp.replace(folder / (name + '.pdf'))
    meta = {'bundle': bundle, 'test_number': test_number, 'files': list(files)}
    (folder / 'input.json').write_text(json.dumps(meta), encoding='utf8')


def submit_to_broker(job_id: str):
    from rabbit_queue import publish_job
    publish_job(job_id)


@app.get("/health")
def health():
    return {"status": "ok", "model": os.getenv("OLLAMA_MODEL", "qwen2.5:7b")}


@app.get('/learning')
def learning_overview():
    return learning.overview()


@app.post('/learning/events')
def learning_capture(event: dict):
    try:
        return learning.capture(event)
    except (ValueError, KeyError, StopIteration) as exc:
        raise HTTPException(400, str(exc))


@app.post('/learning/samples/{sample_id}/review')
def learning_review(sample_id: str, decision: dict):
    try:
        return learning.review(sample_id, decision.get('status', ''), decision.get('note', ''))
    except FileNotFoundError:
        raise HTTPException(404, 'Correction not found')
    except (ValueError, KeyError) as exc:
        raise HTTPException(400, str(exc))


async def read_upload(file: UploadFile) -> bytes:
    data = await file.read(LIMIT + 1)
    await file.close()
    if not data or len(data) > LIMIT or not data.startswith(b"%PDF-"):
        raise HTTPException(400, "Chỉ hỗ trợ PDF có nội dung, tối đa 25 MB mỗi file.")
    return data


def run_job(job_id: str, pdf: bytes, answers: bytes | None, bundle=None, test_number=1):
    def progress(current, total, message):
        with lock:
            jobs[job_id].update(state="running", current=current, total=total, message=message)
            snapshot = dict(jobs[job_id])
        persist_job(snapshot)
    try:
        progress(0, 0, "Đang đọc PDF")
        learning.retain_sources(job_id, bundle if bundle else {'file': pdf, **({'answers': answers} if answers else {})}, test_number)
        result = analyze_bundle(bundle, test_number, job_id, progress) if bundle else analyze(pdf, answers, progress)
        learning.retain_baseline(job_id, result)
        with lock:
            jobs[job_id].update(state="completed", result=result, finishedAt=time.time())
    except Exception as exc:
        with lock:
            jobs[job_id].update(state="failed", error=str(exc), finishedAt=time.time())
    finally:
        with lock:
            snapshot = dict(jobs[job_id])
        try:
            persist_job(snapshot)
        except OSError:
            logging.getLogger(__name__).exception('Could not persist PDF job %s', job_id)


@app.post("/jobs", status_code=202)
async def create_job(exam_id: str = Form(...), file: UploadFile = File(...), answers: UploadFile | None = File(None)):
    pdf = await read_upload(file)
    key = await read_upload(answers) if answers else None
    with lock:
        now = time.time()
        for job_id in list(jobs):
            if jobs[job_id].get("finishedAt", now) < now - TTL:
                del jobs[job_id]
        if sum(j["state"] in ("queued", "running") for j in jobs.values()) >= 3:
            raise HTTPException(429, "Đang có nhiều PDF chờ xử lý. Vui lòng thử lại sau.")
        if len(jobs) >= 30:
            # Bound memory occupied by retained PDF drafts.
            completed = [k for k, v in jobs.items() if "finishedAt" in v]
            if completed:
                del jobs[min(completed, key=lambda k: jobs[k]["finishedAt"])]
        job_id = str(uuid.uuid4())
        jobs[job_id] = {"id": job_id, "examId": exam_id, "state": "queued", "current": 0, "total": 0, "message": "Đang chờ AI"}
        if QUEUE_BACKEND == 'rabbitmq':
            persist_job_inputs(job_id, {'file': pdf, **({'answers': key} if key is not None else {})}, bundle=False)
            persist_job(jobs[job_id])
            try:
                submit_to_broker(job_id)
            except Exception as exc:
                jobs[job_id].update(state='failed', error='RabbitMQ unavailable', finishedAt=time.time())
                persist_job(jobs[job_id])
                raise HTTPException(503, 'Không thể đưa PDF vào RabbitMQ, hãy thử lại.') from exc
        else:
            executor.submit(run_job, job_id, pdf, key)
        return {"jobId": job_id}


@app.get("/jobs/{job_id}")
def get_job(job_id: str, exam_id: str):
    with lock:
        job = jobs.get(job_id) if QUEUE_BACKEND != 'rabbitmq' else None
        saved = read_saved_job(job_id)
        if saved is not None and (
            QUEUE_BACKEND == 'rabbitmq' or job is None
        ):
            job = saved
        if not job or job["examId"] != exam_id:
            raise HTTPException(404, "Không tìm thấy lượt xử lý. Dịch vụ có thể đã khởi động lại; hãy tải PDF lại.")
        response = copy.deepcopy(job)
        if response.get('state') == 'completed' and response.get('result', {}).get('listeningScript'):
            from listening_script import normalize_listening_choices
            normalize_listening_choices(response['result'])
            # Older completed jobs predate the structured missing-script list.
            result = response['result']
            recognized = {q['order'] for p in result.get('parts', []) for q in p.get('questions', []) if q.get('scriptPages')}
            if len(recognized) == result['listeningScript'].get('questions'):
                result['listeningScript'].setdefault('missingQuestions', sorted(set(range(1, 101)) - recognized))
        return response


@app.post("/bundle-jobs", status_code=202)
async def create_bundle_job(test_number: int = Form(...), lc: UploadFile = File(...), rc: UploadFile = File(...), lc_answers: UploadFile = File(...), rc_answers: UploadFile = File(...), lc_script: UploadFile | None = File(None)):
    if not 1 <= test_number <= 10:
        raise HTTPException(400, "Chọn Test từ 1 đến 10.")
    files = {name: await read_upload(upload) for name, upload in (("lc", lc), ("rc", rc), ("lc_answers", lc_answers), ("rc_answers", rc_answers))}
    if lc_script:
        files['lc_script'] = await read_upload(lc_script)
    with lock:
        if sum(j["state"] in ("queued", "running") for j in jobs.values()) >= 3:
            raise HTTPException(429, "Đang có nhiều PDF chờ xử lý. Vui lòng thử lại sau.")
        job_id = str(uuid.uuid4())
        jobs[job_id] = {"id": job_id, "examId": "bundle", "state": "queued", "current": 0, "total": 100, "message": "Đang chờ đọc 4 PDF"}
        if QUEUE_BACKEND == 'rabbitmq':
            persist_job_inputs(job_id, files, bundle=True, test_number=test_number)
            persist_job(jobs[job_id])
            try:
                submit_to_broker(job_id)
            except Exception as exc:
                jobs[job_id].update(state='failed', error='RabbitMQ unavailable', finishedAt=time.time())
                persist_job(jobs[job_id])
                raise HTTPException(503, 'Không thể đưa PDF vào RabbitMQ, hãy thử lại.') from exc
        else:
            executor.submit(run_job, job_id, b"", None, files, test_number)
        return {"jobId": job_id}
