# syntax=docker/dockerfile:1.7
FROM python:3.12-slim
ENV PIP_DEFAULT_TIMEOUT=180 PIP_RETRIES=12 PIP_DISABLE_PIP_VERSION_CHECK=1 PIP_PROGRESS_BAR=off
WORKDIR /app
COPY services/projections/requirements.txt ./requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip,sharing=locked pip install -r requirements.txt
COPY services/projections/ ./
COPY database/import/ownership.json /app/ownership.json
COPY database/schema/collections.json /app/collections.json
ENV PYTHONUNBUFFERED=1
CMD ["python", "projection.py"]
