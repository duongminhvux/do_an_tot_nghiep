# ListenUp local Kokoro TTS service

FastAPI wrapper around `hexgrad/Kokoro-82M`, designed to run as the internal `tts-service` container in the root Docker Compose stack.

Runtime:

- Python 3.11
- Kokoro 0.9.4
- PyTorch 2.7.1
- 24 kHz PCM WAV output
- American English (`en-US`) and British English (`en-GB`)
- persistent Hugging Face model/voice cache at `/models/huggingface`

Endpoints:

```text
GET  /health
GET  /voices
POST /v1/synthesize
POST /v1/synthesize-sequence
```

`/v1/synthesize-sequence` supports multi-segment TOEIC listening stimuli with separate voices, speeds, and pauses.

The base Compose stack installs CPU PyTorch so it works on machines without NVIDIA container support. Use `docker-compose.gpu.yml` together with the base Compose file to install the CUDA 12.6 PyTorch wheel and run Kokoro on an NVIDIA GPU.
