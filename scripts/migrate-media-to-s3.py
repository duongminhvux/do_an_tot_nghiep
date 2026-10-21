"""Non-destructive local media sync to S3. Run from project root with boto3 installed.
Usage: python scripts/migrate-media-to-s3.py --dry-run  (default)
       python scripts/migrate-media-to-s3.py --apply
"""
import argparse
import hashlib
import mimetypes
import os
from pathlib import Path
import boto3
from botocore.config import Config

parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true')
parser.add_argument('--root',default='./storage');args=parser.parse_args()
root=Path(args.root).resolve()
client=boto3.client('s3',endpoint_url=os.environ['S3_ENDPOINT'],aws_access_key_id=os.environ['S3_ACCESS_KEY'],
    aws_secret_access_key=os.environ['S3_SECRET_KEY'],region_name=os.getenv('S3_REGION','us-east-1'),
    config=Config(signature_version='s3v4'))
bucket=os.getenv('S3_BUCKET','vocalearn-media')
files=[p for p in root.rglob('*') if p.is_file() and not p.name.startswith('.')]
for p in files:
    key=p.relative_to(root).as_posix()
    digest=hashlib.sha256(p.read_bytes()).hexdigest()
    try:
        remote=client.head_object(Bucket=bucket,Key=key)
        if remote.get('Metadata',{}).get('sha256')==digest:
            print('SKIP',key);continue
        if 'sha256' not in remote.get('Metadata',{}):
            raise RuntimeError(f'Existing object has no trusted checksum, refusing overwrite: {key}')
        raise RuntimeError(f'Object conflict at {key}: different sha256')
    except client.exceptions.ClientError as e:
        if e.response.get('ResponseMetadata',{}).get('HTTPStatusCode')!=404: raise
    print(('UPLOAD' if args.apply else 'DRY RUN'),key,p.stat().st_size)
    if args.apply:
        with p.open('rb') as f:
            client.upload_fileobj(f,bucket,key,ExtraArgs={'ContentType':mimetypes.guess_type(p.name)[0] or 'application/octet-stream','Metadata':{'sha256':digest}})
print('Finished. Original local files were not removed.')
