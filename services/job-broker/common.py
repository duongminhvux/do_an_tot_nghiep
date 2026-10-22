from __future__ import annotations
import hmac
import json
import os
import pika
from pymongo import MongoClient
from fastapi import HTTPException, Request

AMQP = os.environ['RABBITMQ_URL']
QUEUE = 'audio.jobs'
RETRY = 'audio.jobs.retry'
DLQ = 'audio.jobs.dead'
TOKEN = os.getenv('JOB_INTERNAL_TOKEN', '')
if len(TOKEN) < 24 or TOKEN.upper().startswith('REPLACE_'): raise RuntimeError('JOB_INTERNAL_TOKEN must be >= 24 chars')

MONGO = MongoClient(os.environ['MONGO_URI'], serverSelectionTimeoutMS=12000)
JOBS = MONGO['media_db']['audio_jobs']

def authorize(request: Request):
    if not hmac.compare_digest(request.headers.get('x-internal-token',''), TOKEN):
        raise HTTPException(403, 'Forbidden')

def connect(long_running=False):
    params = pika.URLParameters(AMQP)
    if long_running: params.heartbeat = 0  # HTTP inference blocks the pika I/O thread; relies on TCP + consumer_timeout
    c = pika.BlockingConnection(params)
    ch = c.channel()
    ch.queue_declare(queue=QUEUE, durable=True, arguments={'x-queue-type':'quorum'})
    ch.queue_declare(queue=DLQ, durable=True, arguments={'x-queue-type':'quorum'})
    ch.queue_declare(queue=RETRY, durable=True,
        arguments={'x-message-ttl':30000, 'x-dead-letter-exchange':'', 'x-dead-letter-routing-key':QUEUE})
    ch.confirm_delivery()
    return c, ch

def load_job(job_id):
    return JOBS.find_one({'id':job_id}, {'_id':0})
