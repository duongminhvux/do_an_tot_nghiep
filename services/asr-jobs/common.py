"""Internal S3 + RabbitMQ ASR jobs. GPU inference happens in asr-service."""
import os
import json
import pika
import boto3
from pg_store import JobStore
from botocore.config import Config

QUEUE = 'asr.jobs'
RETRY = 'asr.jobs.retry'
DEAD = 'asr.jobs.dead'
TOKEN = os.environ.get('JOB_INTERNAL_TOKEN','')
if len(TOKEN)<24:
    raise RuntimeError('JOB_INTERNAL_TOKEN must be >=24 characters')
JOBS = JobStore('asr_jobs')
S3 = boto3.client('s3', endpoint_url=os.environ['S3_ENDPOINT'],
    aws_access_key_id=os.environ['S3_ACCESS_KEY'],
    aws_secret_access_key=os.environ['S3_SECRET_KEY'],
    config=Config(signature_version='s3v4', retries={'max_attempts':3}))
BUCKET = os.getenv('S3_BUCKET','vocalearn-media')

def broker():
    params = pika.URLParameters(os.environ['RABBITMQ_URL']);params.heartbeat=0
    c=pika.BlockingConnection(params);ch=c.channel()
    ch.queue_declare(queue=DEAD, durable=True, arguments={'x-queue-type':'quorum'})
    ch.queue_declare(queue=QUEUE, durable=True, arguments={'x-queue-type':'quorum',
        'x-dead-letter-exchange':'', 'x-dead-letter-routing-key':DEAD})
    ch.queue_declare(queue=RETRY,durable=True,arguments={'x-message-ttl':30000,
        'x-dead-letter-exchange':'', 'x-dead-letter-routing-key':QUEUE})
    ch.confirm_delivery()
    return c,ch

def publish(ch,job_id,attempt=0,queue=QUEUE):
    # Publisher confirms raise on failure; successful basic_publish returns None.
    ch.basic_publish(exchange='',routing_key=queue,
        body=json.dumps({'jobId':job_id,'attempt':attempt}).encode('utf8'),mandatory=True,
        properties=pika.BasicProperties(delivery_mode=2, content_type='application/json',
            message_id=job_id+':'+str(attempt)))
