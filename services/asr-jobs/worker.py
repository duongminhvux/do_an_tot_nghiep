"""One queue consumer; work sent to the existing single ASR model process."""
import io
import json
import os
import time
import logging
import uuid
import requests
from common import JOBS, S3, BUCKET, QUEUE, RETRY, broker, publish

logging.basicConfig(level=logging.INFO)
LOG=logging.getLogger('asr-worker')
MAX_RETRIES=max(0,min(5,int(os.getenv('ASR_JOB_RETRIES','2'))))
ASR_URL=os.getenv('ASR_SERVICE_URL','http://asr-service:8002').rstrip('/')


def main():
    while True:
        connection=None
        try:
            connection,ch=broker();ch.basic_qos(prefetch_count=1)
            def handle(ch,delivery,properties,body):
                job_id=None
                attempt=0
                try:
                    payload=json.loads(body);candidate=payload['jobId']
                    if str(uuid.UUID(candidate))!=candidate:raise ValueError('Invalid job ID')
                    attempt=int(payload.get('attempt',0))
                    if attempt<0:raise ValueError('Invalid attempt')
                    job_id=candidate
                    job=JOBS.get(job_id)
                    if job is None or job['state']=='completed':
                        ch.basic_ack(delivery.delivery_tag);return
                    if not JOBS.activate(job_id):
                        ch.basic_ack(delivery.delivery_tag);return
                    file=S3.get_object(Bucket=BUCKET,Key=job['key'])['Body'].read()
                    resp=requests.post(ASR_URL+'/v1/transcribe',timeout=3600,
                        data={'language':job['language'] if job['language']!='auto' else ''},
                        files={'file':('audio.wav',io.BytesIO(file),'application/octet-stream')})
                    resp.raise_for_status()
                    result=resp.json()
                    JOBS.complete(job_id, result)
                    ch.basic_ack(delivery.delivery_tag)
                    LOG.info('Completed ASR %s',job_id)
                except Exception as exc:
                    LOG.exception('Failed ASR %s',job_id)
                    if job_id:
                        if attempt<MAX_RETRIES:
                            JOBS.retry(job_id, str(exc))
                            publish(ch,job_id,attempt+1,RETRY)
                            ch.basic_ack(delivery.delivery_tag)
                        else:
                            JOBS.fail(job_id, str(exc))
                            ch.basic_reject(delivery.delivery_tag,requeue=False)
                    else: ch.basic_reject(delivery.delivery_tag,requeue=False)
            ch.basic_consume(queue=QUEUE,on_message_callback=handle,auto_ack=False)
            ch.start_consuming()
        except Exception:
            LOG.exception('ASR broker reconnecting')
            time.sleep(5)
        finally:
            if connection and connection.is_open:
                try:connection.close()
                except Exception:pass
if __name__=='__main__':main()
