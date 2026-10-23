#!/usr/bin/env python3
"""Manual, loss-averse backup/restore for one S3-compatible bucket.

Usage:
  python scripts/s3-backup-restore.py backup --env-file .env --out backups/media
  python scripts/s3-backup-restore.py restore --env-file .env --from backups/media/2026... \
      --yes-i-have-verified-target   # skips existing objects, never deletes

Requires: pip install boto3
"""
from __future__ import annotations
import argparse
import base64
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
from urllib.parse import urlsplit
from botocore.exceptions import ClientError
import sys


def env_file(path: str):
    file = Path(path)
    if not file.is_file():
        return
    for line in file.read_text(encoding='utf-8-sig').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        k = k.strip()
        if k.startswith('export '): k = k[7:]
        if v.strip().startswith('#'): v = ''
        v = v.strip()
        if len(v) > 1 and v[0] in ('"', "'") and v[0] == v[-1]: v = v[1:-1]
        if k and k not in os.environ: os.environ[k] = v


def client():
    try:
        import boto3
    except ImportError as e:
        raise SystemExit('Install Python package: python -m pip install boto3') from e
    endpoint = os.environ.get('S3_BACKUP_ENDPOINT') or os.environ.get('S3_ENDPOINT', 'http://localhost:9000')
    # .env normally contains Docker DNS 'objectstore'. Host-side backups should use
    # the loopback port published by root docker-compose.yml instead.
    if not os.environ.get('S3_BACKUP_ENDPOINT') and urlsplit(endpoint).hostname in ('minio','objectstore'):
        endpoint = 'http://127.0.0.1:9000'
    access_key = os.environ.get('S3_ACCESS_KEY')
    secret_key = os.environ.get('S3_SECRET_KEY')
    if not access_key or not secret_key:
        raise SystemExit('Missing S3_ACCESS_KEY or S3_SECRET_KEY in environment/.env')
    return boto3.client('s3', endpoint_url=endpoint,
        aws_access_key_id=access_key, aws_secret_access_key=secret_key,
        region_name=os.environ.get('S3_REGION', 'us-east-1'))


def file_id(key: str) -> str:
    return base64.urlsafe_b64encode(key.encode()).decode().rstrip('=')


def backup(s3, bucket: str, target: Path):
    target = target / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    target.mkdir(parents=True, exist_ok=False)
    files = target / 'objects'
    files.mkdir()
    count = 0
    try:
        with (target / 'manifest.jsonl').open('w', encoding='utf8') as manifest:
            for page in s3.get_paginator('list_objects_v2').paginate(Bucket=bucket):
                for obj in page.get('Contents', []):
                    key = obj['Key']
                    name = file_id(key)
                    destination = files / name
                    response = s3.get_object(Bucket=bucket, Key=key)
                    h = hashlib.sha256()
                    size = 0
                    with destination.open('xb') as output:
                        for chunk in response['Body'].iter_chunks(1024 * 1024):
                            if chunk:
                                h.update(chunk)
                                size += len(chunk)
                                output.write(chunk)
                    if size != obj['Size']:
                        raise IOError(f'Size changed during backup for {key}; retry after pausing uploads')
                    record = {'bucket':bucket, 'key':key, 'filename':name,
                        'size':size,'sha256':h.hexdigest(), 'content_type':response.get('ContentType', 'application/octet-stream')}
                    manifest.write(json.dumps(record, ensure_ascii=False) + '\n')
                    manifest.flush()
                    count += 1
        (target / 'BACKUP_COMPLETE').write_text(f'{bucket} {count} objects\n', encoding='utf8')
    except BaseException:
        print(f'BACKUP FAILED; incomplete directory: {target}', file=sys.stderr)
        raise
    print(f'Backup complete: {count} objects in {target}')


def restore(s3, folder: Path, accept: bool):
    if not accept:
        raise SystemExit('Restore requires --yes-i-have-verified-target; original objects are NEVER overwritten')
    if not (folder/'BACKUP_COMPLETE').is_file():
        raise SystemExit('Incomplete backup: BACKUP_COMPLETE marker not found')
    records = [json.loads(line) for line in (folder/'manifest.jsonl').read_text(encoding='utf8').splitlines() if line.strip()]
    marker = (folder/'BACKUP_COMPLETE').read_text(encoding='utf8').strip().split()
    if len(marker) != 3 or marker[2] != 'objects':
        raise SystemExit('Invalid backup completion marker')
    bucket = marker[0]
    if any(record['bucket'] != bucket for record in records):
        raise SystemExit('Backup contains mixed buckets')
    if len(records) != int(marker[1]):
        raise SystemExit('Manifest/object count mismatch')
    configured = os.environ.get('S3_BUCKET','vocalearn-media')
    if bucket != configured:
        raise SystemExit('S3_BUCKET does not match the backup bucket')
    created = skipped = 0
    for record in records:
        name = file_id(record['key'])
        if name != record['filename']:
            raise SystemExit('Manifest contains invalid filename')
        path = folder/'objects'/name
        sha = hashlib.sha256()
        with path.open('rb') as f:
            for chunk in iter(lambda: f.read(1024*1024),b''): sha.update(chunk)
        if sha.hexdigest() != record['sha256'] or path.stat().st_size != record['size']:
            raise SystemExit(f'Checksum/size mismatch for key: {record["key"]}')
        try:
            s3.head_object(Bucket=bucket,Key=record['key'])
            skipped += 1
            continue  # never overwrite target object
        except ClientError as e:
            if e.response.get('ResponseMetadata',{}).get('HTTPStatusCode') != 404:
                raise
        with path.open('rb') as f:
            s3.put_object(Bucket=bucket,Key=record['key'],Body=f, ContentType=record['content_type'])
        created += 1
    print(f'Restore complete: created={created} existing_skipped={skipped}; no deletions')


def main():
    parser = argparse.ArgumentParser(description='S3-compatible backup and non-destructive restore')
    parser.add_argument('action', choices=('backup','restore'))
    parser.add_argument('--env-file',default='.env')
    parser.add_argument('--out', default='backups/media')
    parser.add_argument('--from',dest='source')
    parser.add_argument('--yes-i-have-verified-target', action='store_true')
    opts = parser.parse_args()
    env_file(opts.env_file)
    bucket = os.environ.get('S3_BUCKET','vocalearn-media')
    s3=client()
    if opts.action=='backup': backup(s3, bucket, Path(opts.out))
    else:
        if not opts.source: raise SystemExit('Restore requires --from <backup-folder>')
        restore(s3, Path(opts.source), opts.yes_i_have_verified_target)

if __name__ == '__main__': main()
