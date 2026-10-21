FROM python:3.12-slim
WORKDIR /app
COPY services/domain-events/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services/domain-events/*.py ./
CMD ["python", "relay.py"]
