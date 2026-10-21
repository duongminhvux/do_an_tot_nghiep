"""Startup-only model preflight. No model weights belong in image layers."""
import os
from huggingface_hub import snapshot_download

ALLOW=os.getenv('MODEL_AUTO_DOWNLOAD','true').lower()=='true'
plans=[
    (os.getenv('KOKORO_MODEL_ID','hexgrad/Kokoro-82M'),os.getenv('KOKORO_HF_HOME','/models/huggingface')),
    (os.getenv('WHISPER_REPO_ID','Systran/faster-whisper-small.en'),os.getenv('ASR_MODEL_DIR','/models/faster-whisper')),
]
for repo, cache in plans:
    print(f'Checking {repo} in {cache}',flush=True)
    path=snapshot_download(repo_id=repo,cache_dir=cache,local_files_only=not ALLOW)
    if not path: raise RuntimeError(f'Missing model: {repo}')
    print(f'READY: {repo}',flush=True)
print('Model preflight completed',flush=True)
