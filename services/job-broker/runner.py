"""Single durable RabbitMQ TTS consumer. GPU scaling deliberately deferred.
PostgreSQL owns job state; RabbitMQ owns delivery, retry and DLQ.
"""
import json
import os
import time
import pika
import requests
from common import connect, QUEUE, RETRY, DLQ, load_job, TOKEN

WORKER_URL=os.getenv('AUDIO_WORKER_URL','http://audio-worker:5001').rstrip('/')
RETRIES=int(os.getenv('AUDIO_JOB_RETRIES','3'))
SESSION=requests.Session()

def handle(ch, method, props, body):
    payload=json.loads(body)
    job_id=payload['jobId']
    job=load_job(job_id)
    if job and job.get('state')=='completed':
        ch.basic_ack(method.delivery_tag)
        return
    attempts=int((props.headers or {}).get('x-retries',0))
    try:
        if not job: raise RuntimeError(f'Unknown audio job {job_id}')
        response=SESSION.post(f'{WORKER_URL}/_internal/audio/jobs/{job_id}',
            headers={'x-internal-token':TOKEN},timeout=3600)
        response.raise_for_status()
        ch.basic_ack(method.delivery_tag)
        print('Audio job completed',job_id,flush=True)
    except Exception as exc:
        print('Audio job failure',job_id,'attempt',attempts,str(exc),flush=True)
        dest=RETRY if attempts<RETRIES else DLQ
        header={'x-retries':attempts+1}
        # Do not acknowledge the original job unless RabbitMQ confirmed
        # publishing to the retry or dead-letter queue.
        ch.basic_publish(exchange='',routing_key=dest,body=body, mandatory=True,
            properties=pika.BasicProperties(delivery_mode=2,content_type='application/json',headers=header))
        ch.basic_ack(method.delivery_tag)

def main():
    while True:
        connection=None
        try:
            connection,ch=connect(long_running=True)
            ch.basic_qos(prefetch_count=1)
            print('TTS worker consumer connected',flush=True)
            ch.basic_consume(queue=QUEUE,on_message_callback=handle,auto_ack=False)
            ch.start_consuming()
        except Exception as exc:
            print('RabbitMQ consumer reconnecting',exc,flush=True)
            time.sleep(5)
        finally:
            if connection and connection.is_open:
                try:connection.close()
                except Exception:pass
if __name__=='__main__':main()
