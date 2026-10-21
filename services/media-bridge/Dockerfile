FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY services/media-bridge/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/media-bridge/app.py ./app.py
EXPOSE 8010
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8010"]
