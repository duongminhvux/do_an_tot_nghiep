# syntax=docker/dockerfile:1.7
FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
ENV PIP_DEFAULT_TIMEOUT=180 PIP_RETRIES=12 PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_PROGRESS_BAR=off
WORKDIR /app
COPY services/job-broker/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked pip install -r requirements.txt
COPY services/job-broker/ .
EXPOSE 8020
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8020"]
