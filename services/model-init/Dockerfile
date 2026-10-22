# syntax=docker/dockerfile:1.7
FROM python:3.11-slim-bookworm
ENV PIP_DEFAULT_TIMEOUT=180 PIP_RETRIES=12 PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_PROGRESS_BAR=off
WORKDIR /app
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked pip install 'huggingface_hub>=0.30,<2'
COPY services/model-init/check_models.py ./check_models.py
CMD ["python", "-u", "check_models.py"]
