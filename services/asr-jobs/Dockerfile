FROM python:3.12-slim
WORKDIR /app
COPY services/asr-jobs/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/asr-jobs/*.py ./
COPY services/gpu-scheduler/gpu_lease.py ./gpu_lease.py
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8021"]
