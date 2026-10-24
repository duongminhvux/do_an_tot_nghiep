"""Publish generated PDF image assets to the media bridge's S3 bucket.

PDF parsing uses local scratch space; all URLs returned to browsers are backed by
objects under pdf-ai/<job-id>/..., not by the worker's ephemeral file system.
Replaying a job is safe: PUT replaces the same object key with identical bytes.
"""
from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen
from uuid import UUID

IMAGE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
MAX_ASSET_BYTES = 15 * 1024 * 1024


def publish_pdf_images(job_id: str, scratch_root: Path | None = None) -> int:
    if str(UUID(job_id)) != job_id:
        raise ValueError('Invalid PDF job identifier')
    root = (scratch_root or Path(os.getenv('PDF_AI_ASSET_DIR', '/app/assets'))) / job_id
    files = sorted(file for file in root.rglob('*') if file.is_file() and file.suffix.lower() in IMAGE_SUFFIXES)
    if not files:
        return 0
    token = os.environ.get('MEDIA_INTERNAL_TOKEN', '')
    if len(token) < 24:
        raise RuntimeError('MEDIA_INTERNAL_TOKEN is required to publish PDF images')
    bridge = os.getenv('MEDIA_BRIDGE_URL', 'http://media-bridge:8010').rstrip('/')
    for file in files:
        relative = file.relative_to(root)
        if any(part in ('', '.', '..') for part in relative.parts):
            raise ValueError('Unsafe PDF asset path')
        if file.stat().st_size > MAX_ASSET_BYTES:
            raise ValueError(f'Generated PDF image too large: {relative}')
        object_key = '/'.join(('pdf-ai', job_id, *relative.parts))
        url = f"{bridge}/objects/{'/'.join(quote(part, safe='') for part in object_key.split('/'))}"
        req = Request(url, data=file.read_bytes(), method='PUT', headers={
            'x-internal-token': token, 'content-type': 'application/octet-stream',
        })
        # Fail the job if media is unavailable. Never return a successful
        # analysis result whose source image URLs point to missing objects.
        with urlopen(req, timeout=40) as response:
            if not 200 <= response.status < 300:
                raise RuntimeError(f'PDF image upload failed: {relative} HTTP {response.status}')
    return len(files)
