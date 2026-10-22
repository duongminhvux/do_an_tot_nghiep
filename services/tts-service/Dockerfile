# syntax=docker/dockerfile:1.7
FROM python:3.11-slim-bookworm

ARG TORCH_VERSION=2.7.1
ARG TORCH_INDEX_URL=https://download.pytorch.org/whl/cpu

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN sed -i "s|http://deb.debian.org|https://deb.debian.org|g" /etc/apt/sources.list.d/debian.sources \
    && apt-get -o Acquire::Retries=8 -o Acquire::https::Timeout=120 update \
    && apt-get -o Acquire::Retries=8 -o Acquire::https::Timeout=120 install -y --no-install-recommends espeak-ng libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

ENV PIP_DEFAULT_TIMEOUT=180 PIP_RETRIES=12 PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_PROGRESS_BAR=off
WORKDIR /app

COPY services/tts-service/requirements.txt ./requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked python -m pip install "torch==${TORCH_VERSION}" --index-url "${TORCH_INDEX_URL}" \
    && python -m pip install -r requirements.txt

COPY services/tts-service/app ./app

EXPOSE 8001

HEALTHCHECK --interval=15s --timeout=5s --start-period=180s --retries=10 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=4).read()" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
