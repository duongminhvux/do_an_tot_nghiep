"""RabbitMQ durable consumer: ACK only after internal Nest worker finishes.
Expected: `RUNNER_ROLE=primary|elastic`; elastic polls backlog + explicit GPU admission.
"""
import json
import os
import subprocess
import time
import pika
import requests
from common import connect, QUEUE, RETRY, DLQ, cache, load_job, store_job, TOKEN
from gpu_lease import gpu_lease

ROLE=os.getenv('RUNNER_ROLE','primary')
WORKER_URL=os.getenv('AUDIO_WORKER_URL','http://audio-worker:5001').rstrip('/')
RETRIES=int(os.getenv('AUDIO_JOB_RETRIES','3'))
MIN_FREE_MB=int(os.getenv('AUDIO_ELASTIC_MIN_FREE_VRAM_MB','2500'))
SESSION=requests.Session()

def elastic_allowed(ch):
    if ROLE!='elastic': return True
    try:
        config=json.loads(cache.get('audio:worker:config') or '{}')
        if int(config.get('maxWorkers',1)) < 2: return False
        threshold=max(1, int(config.get('backlogThreshold',10)))
        waiting=ch.queue_declare(queue=QUEUE, passive=True).method.message_count
        if waiting < threshold: return False
        # Fail closed when GPU measurements are unavailable or secondary admission is disabled.
        if os.getenv('GPU_ALLOW_SECONDARY','false').lower()!='true': return False
        out=subprocess.check_output(['nvidia-smi','--query-gpu=memory.free', '--format=csv,noheader,nounits'],timeout=4,text=True)
        return any(int(x.strip()) >= MIN_FREE_MB for x in out.splitlines())
    except Exception as exc:
        print('Elastic denied:',exc,flush=True)
        return False

def handle(ch, method, props, body):
    payload=json.loads(body)
    job_id=payload['jobId']
    job=load_job(job_id)
    if not job or job.get('state')=='completed':
        ch.basic_ack(method.delivery_tag);return
    attempts=int((props.headers or {}).get('x-retries',0))
    try:
        with gpu_lease('tts'):
            response=SESSION.post(f'{WORKER_URL}/_internal/audio/jobs/{job_id}',
                headers={'x-internal-token':TOKEN}, timeout=3600)
            response.raise_for_status()
        ch.basic_ack(method.delivery_tag)
        print('Job done:',job_id,flush=True)
    except Exception as exc:
        print('Job failed:',job_id,'attempt',attempts,str(exc),flush=True)
        job=load_job(job_id)
        if attempts < RETRIES:
            if job:
                job['state']='waiting';job['failedReason']=str(exc)[:600]
                store_job(job)
            dest=RETRY;headers={'x-retries':attempts+1}
        else:
            if job:
                job['state']='failed';job['failedReason']=str(exc)[:600]
                store_job(job)
            dest=DLQ;headers={'x-retries':attempts}
        ch.basic_publish(exchange='',routing_key=dest,body=body,
            properties=pika.BasicProperties(delivery_mode=2,headers=headers,content_type='application/json'),mandatory=True)
        ch.basic_ack(method.delivery_tag)

def main():
    while True:
        connection=None
        try:
            connection,ch=connect(long_running=True)
            ch.basic_qos(prefetch_count=1)
            print(f'Runner {ROLE} connected',flush=True)
            # Poll basic_get so elastic can idle without consuming messages.
            while True:
                if not elastic_allowed(ch):
                    time.sleep(5);continue
                method, props, body=ch.basic_get(queue=QUEUE,auto_ack=False)
                if method is None:
                    time.sleep(1);continue
                handle(ch,method,props,body)
        except Exception as e:
            print('Runner restarting after failure:',e,flush=True)
            time.sleep(5)
        finally:
            if connection and connection.is_open:
                try:connection.close()
                except Exception:pass

if __name__=='__main__':main()
