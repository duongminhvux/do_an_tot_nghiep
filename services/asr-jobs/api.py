from __future__ import annotations
import hmac
import os
import uuid
from fastapi import FastAPI, UploadFile, File, Form, Request, HTTPException
from common import JOBS, S3, BUCKET, TOKEN, broker, publish

MAX_SIZE = max(1,min(200,int(os.getenv('ASR_MAX_UPLOAD_MB','100'))))*1024*1024
app = FastAPI(title='Internal ASR Job API', docs_url=None,redoc_url=None)

def authenticate(request: Request):
    if not hmac.compare_digest(request.headers.get('x-internal-token',''),TOKEN):
        raise HTTPException(403,'Forbidden')

@app.get('/health')
def health():
    JOBS.ping()
    return {'status':'ok'}

@app.post('/jobs',status_code=202)
async def enqueue(request: Request, file: UploadFile=File(...), language: str=Form('en')):
    authenticate(request)
    if language not in ('en','vi','auto'):
        raise HTTPException(400,'Unsupported language')
    data=await file.read(MAX_SIZE+1);await file.close()
    if not data or len(data)>MAX_SIZE:
        raise HTTPException(413,'Audio empty or too large')
    job_id=str(uuid.uuid4())
    suffix=os.path.splitext(file.filename or 'audio.wav')[1].lower()
    if suffix not in ('.wav','.mp3','.m4a','.flac','.ogg','.webm'):
        raise HTTPException(400,'Unsupported audio extension')
    key=f'asr-jobs/{job_id}/source{suffix}'
    S3.put_object(Bucket=BUCKET, Key=key, Body=data,
                  ContentType=file.content_type or 'application/octet-stream')
    JOBS.create(job_id, language, key)
    c=None
    try:
        c,ch=broker();publish(ch,job_id)
    except Exception as exc:
        JOBS.fail(job_id, 'Queue unavailable')
        raise HTTPException(503,'RabbitMQ unavailable') from exc
    finally:
        if c and c.is_open:c.close()
    return {'jobId':job_id,'state':'waiting'}

@app.get('/jobs/{job_id}')
def status(job_id: str, request:Request):
    authenticate(request)
    try:
        if str(uuid.UUID(job_id))!=job_id:raise ValueError('Invalid job ID')
    except ValueError:raise HTTPException(404,'Job not found')
    job=JOBS.get(job_id)
    if job is None:raise HTTPException(404,'Job not found')
    return job
