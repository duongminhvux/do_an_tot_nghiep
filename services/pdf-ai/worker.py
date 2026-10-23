"""Single Qwen inference consumer. Restart/re-delivery safe via job-state.json."""
import json
import logging
import os
from pathlib import Path
import time
import uuid
import app as pdf_app
from rabbit_queue import connect, publish, QUEUE, RETRY

logging.basicConfig(level=logging.INFO)
LOG = logging.getLogger('qwen-worker')
ROOT = Path(os.getenv('PDF_AI_ASSET_DIR', '/app/assets'))
MAX_RETRIES = max(0, min(10, int(os.getenv('AI_IMPORT_MAX_RETRIES', '2'))))


def process(job_id: str):
    if str(uuid.UUID(job_id)) != job_id:
        raise ValueError('Invalid job id')
    state = pdf_app.read_saved_job(job_id)
    if not state:
        raise FileNotFoundError('Unknown job')
    if state.get('state') == 'completed':
        return True
    directory = ROOT / job_id
    meta = json.loads((directory / 'input.json').read_text(encoding='utf8'))
    files = {}
    for name in meta['files']:
        if not name.isidentifier():
            raise ValueError('Unexpected input filename')
        files[name] = (directory / (name + '.pdf')).read_bytes()
    pdf_app.jobs[job_id] = state
    if meta.get('bundle'):
        pdf_app.run_job(job_id, b'', None, files, int(meta['test_number']))
    else:
        pdf_app.run_job(job_id, files['file'], files.get('answers'))
    final = pdf_app.read_saved_job(job_id)
    return final is not None and final.get('state') == 'completed'


def main():
    while True:
        try:
            connection, channel = connect()
            channel.basic_qos(prefetch_count=1)  # Qwen concurrency stays 1
            def consume(ch, method, properties, raw):
                job_id = None
                try:
                    data = json.loads(raw)
                    job_id = data['jobId']
                    attempt = int(data.get('attempt', 0))
                    done = process(job_id)
                    if done:
                        ch.basic_ack(method.delivery_tag)
                        LOG.info('AI job completed %s', job_id)
                    elif attempt < MAX_RETRIES:
                        state = pdf_app.read_saved_job(job_id)
                        if state:
                            state.update(state='queued', message='Đang đợi chạy lại', error=None, finishedAt=None)
                            pdf_app.persist_job(state)
                        publish(ch, job_id, attempt + 1, RETRY)
                        ch.basic_ack(method.delivery_tag)
                        LOG.warning('AI job retry %s attempt %s',job_id,attempt+1)
                    else:
                        ch.basic_reject(method.delivery_tag, requeue=False)  # dead-letter
                        LOG.error('AI job exhausted retries %s',job_id)
                except Exception:
                    LOG.exception('AI worker error on job %s',job_id)
                    # Crash/redelivery can replay a job; completed jobs are deduplicated.
                    try: ch.basic_nack(method.delivery_tag, requeue=True)
                    except Exception: pass
            channel.basic_consume(queue=QUEUE, on_message_callback=consume, auto_ack=False)
            LOG.info('Qwen worker listening to %s', QUEUE)
            channel.start_consuming()
        except Exception:
            LOG.exception('RabbitMQ connection failed; reconnecting')
            time.sleep(5)

if __name__ == '__main__':
    main()
