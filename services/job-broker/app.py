from __future__ import annotations
import json
import pika
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel, Field
from common import authorize, connect, QUEUE, load_job

app=FastAPI(title='internal-rabbit-publisher',docs_url=None,redoc_url=None)

class PublishBody(BaseModel):
    jobId: str=Field(pattern=r'^[a-f0-9-]{36}$')
    name: str=Field(min_length=1,max_length=100)

@app.get('/health')
def health():
    c,ch=connect();c.close()
    return {'status':'ok'}

@app.post('/publish')
def publish(body: PublishBody, request: Request):
    authorize(request)
    job=load_job(body.jobId)
    if not job or job.get('state') != 'waiting':
        raise HTTPException(409,'Job not waiting in Redis')
    c,ch=connect()
    try:
        accepted=ch.basic_publish(exchange='',routing_key=QUEUE,
            body=json.dumps({'jobId':body.jobId,'name':body.name}).encode(),
            properties=pika.BasicProperties(delivery_mode=2, content_type='application/json'),mandatory=True)
        if not accepted: raise HTTPException(503,'Message not confirmed')
        return {'published':True,'jobId':body.jobId}
    finally:
        c.close()

@app.get('/stats')
def stats(request: Request):
    authorize(request)
    c,ch=connect()
    try:
        waiting=ch.queue_declare(queue=QUEUE,passive=True).method
        dead=ch.queue_declare(queue='audio.jobs.dead',passive=True).method
        retry=ch.queue_declare(queue='audio.jobs.retry',passive=True).method
        return {'waiting':waiting.message_count,'consumers':waiting.consumer_count,
                'retrying':retry.message_count,'dead':dead.message_count}
    finally: c.close()
