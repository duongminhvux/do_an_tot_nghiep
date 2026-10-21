FROM python:3.11-slim-bookworm
WORKDIR /app
RUN pip install --no-cache-dir 'huggingface_hub>=0.30,<2'
COPY services/model-init/check_models.py ./check_models.py
CMD ["python", "-u", "check_models.py"]
