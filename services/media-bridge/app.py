"""Private S3 adapter. Only API/worker containers should reach this service.
Do not publish 8010 to the public internet. A token is required for all object operations.
"""
from __future__ import annotations
import os
import mimetypes
from io import BytesIO
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse

app = FastAPI(title="internal-media-bridge", docs_url=None, redoc_url=None)
ENDPOINT = os.getenv('S3_ENDPOINT', 'http://minio:9000')
BUCKET = os.getenv('S3_BUCKET', 'vocalearn-media')
TOKEN = os.getenv('MEDIA_INTERNAL_TOKEN', '')
if not TOKEN or len(TOKEN) < 24 or TOKEN.upper().startswith('REPLACE_'):
    raise RuntimeError('MEDIA_INTERNAL_TOKEN must be configured with at least 24 characters')

s3 = boto3.client('s3', endpoint_url=ENDPOINT,
    aws_access_key_id=os.environ.get('S3_ACCESS_KEY'),
    aws_secret_access_key=os.environ.get('S3_SECRET_KEY'),
    region_name=os.getenv('S3_REGION', 'us-east-1'),
    config=Config(signature_version='s3v4', retries={'max_attempts': 3, 'mode': 'standard'}))

@app.on_event('startup')
def initialize():
    try:
        s3.head_bucket(Bucket=BUCKET)
    except ClientError as err:
        status = err.response.get('ResponseMetadata', {}).get('HTTPStatusCode')
        if status == 404:
            s3.create_bucket(Bucket=BUCKET)
        else:
            raise

def verify(request: Request):
    import hmac
    if not hmac.compare_digest(request.headers.get('x-internal-token',''), TOKEN):
        raise HTTPException(status_code=403, detail='Forbidden')

def validate_key(key: str):
    if not key or len(key) > 1024 or any(segment in ('.', '..', '') for segment in key.split('/')):
        raise HTTPException(status_code=400, detail='Invalid key')
    return key

@app.get('/health')
def health():
    s3.head_bucket(Bucket=BUCKET)
    return {'status':'ok'}

@app.put('/objects/{key:path}')
async def upload(key: str, request: Request):
    verify(request)
    validate_key(key)
    body = await request.body()
    if not body or len(body) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail='Empty or oversized payload')
    s3.put_object(Bucket=BUCKET, Key=key, Body=body,
                  ContentType=(mimetypes.guess_type(key)[0] or 'application/octet-stream'))
    return {'key':key, 'size':len(body)}

@app.get('/objects/{key:path}')
def download(key: str, request: Request):
    verify(request)
    validate_key(key)
    opts = {'Bucket':BUCKET,'Key':key}
    if request.headers.get('range'): opts['Range'] = request.headers['range']
    try: obj = s3.get_object(**opts)
    except ClientError as err:
        status = err.response.get('ResponseMetadata', {}).get('HTTPStatusCode')
        raise HTTPException(status_code=404 if status == 404 or err.response.get('Error',{}).get('Code')=='NoSuchKey' else 502,
                            detail='Object unavailable')
    headers={'Accept-Ranges':'bytes', 'Cache-Control':'public, max-age=3600'}
    if 'ContentRange' in obj: headers['Content-Range']=obj['ContentRange']
    if 'ContentLength' in obj: headers['Content-Length']=str(obj['ContentLength'])
    return StreamingResponse(obj['Body'].iter_chunks(chunk_size=64*1024),
        media_type=obj.get('ContentType','application/octet-stream'),
        headers=headers, status_code=206 if 'ContentRange' in obj else 200)

@app.head('/objects/{key:path}')
def exists(key: str, request: Request):
    verify(request);validate_key(key)
    try: s3.head_object(Bucket=BUCKET,Key=key)
    except ClientError as err:
        code=err.response.get('ResponseMetadata',{}).get('HTTPStatusCode')
        raise HTTPException(status_code=404 if code == 404 else 502)
    return {}

@app.delete('/objects/{key:path}')
def delete(key: str, request: Request):
    verify(request);validate_key(key)
    s3.delete_object(Bucket=BUCKET,Key=key)
    return {'deleted':True}
