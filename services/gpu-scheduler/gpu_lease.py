"""Optional GPU admission leases shared by RabbitMQ workers on one GPU node.

A lease limits *admitted AI inference jobs*, not VRAM itself. The default limit
of one is conservative. Configure >1 only after monitoring actual VRAM usage.
"""
from contextlib import contextmanager
import os
import threading
import time
import uuid

@contextmanager
def gpu_lease(kind: str):
    if os.getenv('GPU_SCHEDULER_ENABLED','false').lower() != 'true':
        yield
        return
    import redis
    client = redis.Redis.from_url(os.environ['REDIS_URL'])
    node = os.getenv('GPU_NODE_ID','default-gpu')
    slots = max(1, min(4, int(os.getenv('GPU_MAX_CONCURRENT','1'))))
    lease_sec = 300
    token = f'{kind}:{uuid.uuid4()}'
    acquired = None
    timeout = int(os.getenv('GPU_ADMISSION_WAIT_SECONDS','3600'))
    deadline = time.monotonic() + timeout
    while time.monotonic()<deadline:
        for number in range(slots):
            key = f'gpu:lease:{node}:{number}'
            if client.set(key, token, nx=True, ex=lease_sec):
                acquired=key
                break
        if acquired:
            break
        time.sleep(2)
    if not acquired:
        raise TimeoutError('GPU admission wait timed out')
    stopped=threading.Event()
    renew_script="""if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('expire',KEYS[1],ARGV[2]) else return 0 end"""
    release_script="""if redis.call('get',KEYS[1])==ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end"""
    def heartbeat():
        while not stopped.wait(60):
            try:
                if not client.eval(renew_script,1,acquired,token,lease_sec):
                    # The lease was lost; fail closed for subsequent work.
                    stopped.set()
                    break
            except Exception:
                # Network partition: not safe to assume the lease is held.
                stopped.set()
                break
    thread=threading.Thread(target=heartbeat,daemon=True);thread.start()
    try:
        yield
        if stopped.is_set():
            raise RuntimeError('GPU lease renewal was lost during inference')
    finally:
        stopped.set();thread.join(timeout=2)
        try:client.eval(release_script,1,acquired,token)
        finally:client.close()
