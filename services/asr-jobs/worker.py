"""One queue consumer; work sent to the existing single ASR model process."""
import io
import json
import os
import time
import logging
import uuid
from datetime import datetime, timezone
import requests
from common import JOBS, S3, BUCKET, QUEUE, RETRY, broker, publish
from gpu_lease import gpu_lease

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
                try:
                    payload=json.loads(body);job_id=payload['jobId']
                    if str(uuid.UUID(job_id))!=job_id:raise ValueError('Invalid job ID')
                    attempt=int(payload.get('attempt',0))
                    job=JOBS.find_one({'_id':job_id})
                    if job is None or job['state']=='completed':
                        ch.basic_ack(delivery.delivery_tag);return
                    JOBS.update_one({'_id':job_id},{'$set':{'state':'active'},'$inc':{'attempts':1}})
                    file=S3.get_object(Bucket=BUCKET,Key=job['key'])['Body'].read()
                    with gpu_lease('asr'):
                        resp=requests.post(ASR_URL+'/v1/transcribe',timeout=3600,
                            data={'language':job['language'] if job['language']!='auto' else ''},
                            files={'file':('audio.wav',io.BytesIO(file),'application/octet-stream')})
                        resp.raise_for_status()
                        result=resp.json()
                    JOBS.update_one({'_id':job_id},{'$set':{
                        'state':'completed','result':result,'finishedAt':datetime.now(timezone.utc)}})
                    ch.basic_ack(delivery.delivery_tag)
                    LOG.info('Completed ASR %s',job_id)
                except Exception as exc:
                    LOG.exception('Failed ASR %s',job_id)
                    attempt=int(json.loads(body).get('attempt',0))
                    if job_id:
                        if attempt<MAX_RETRIES:
                            publish(ch,job_id,attempt+1,RETRY)
                            JOBS.update_one({'_id':job_id},{'$set':{'state':'retrying','error':str(exc)[:500]}})
                            ch.basic_ack(delivery.delivery_tag)
                        else:
                            JOBS.update_one({'_id':job_id},{'$set':{'state':'failed','error':str(exc)[:500],
                                'finishedAt':datetime.now(timezone.utc)}})
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
