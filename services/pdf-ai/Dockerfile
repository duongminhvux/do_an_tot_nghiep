# syntax=docker/dockerfile:1.7
FROM python:3.12-slim
ENV PIP_DEFAULT_TIMEOUT=180 PIP_RETRIES=12 PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_PROGRESS_BAR=off
WORKDIR /app
RUN sed -i "s|http://deb.debian.org|https://deb.debian.org|g" /etc/apt/sources.list.d/debian.sources \
    && apt-get -o Acquire::Retries=8 -o Acquire::https::Timeout=120 update \
    && apt-get -o Acquire::Retries=8 -o Acquire::https::Timeout=120 install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng && rm -rf /var/lib/apt/lists/*
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata OMP_THREAD_LIMIT=2
COPY services/pdf-ai/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked pip install -r requirements.txt
COPY services/pdf-ai/*.py ./
EXPOSE 8003
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8003", "--workers", "1"]
