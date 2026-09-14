FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/models/huggingface \
    KOKORO_DEVICE=cuda \
    KOKORO_MODEL_ID=hexgrad/Kokoro-82M

RUN apt-get update \
    && apt-get install -y --no-install-recommends espeak-ng libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY services/tts-service/requirements.txt ./requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install torch==2.7.1 --index-url https://download.pytorch.org/whl/cu126 \
    && python -m pip install -r requirements.txt

COPY services/tts-service/app ./app

EXPOSE 8001
HEALTHCHECK --interval=15s --timeout=5s --start-period=120s --retries=10 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health', timeout=4).read()" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
