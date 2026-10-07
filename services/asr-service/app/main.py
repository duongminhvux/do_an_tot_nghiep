from __future__ import annotations

import os
import re
import tempfile
import threading
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from faster_whisper import WhisperModel



def _load_root_env() -> None:
    root_env = next(
        (parent / ".env" for parent in Path(__file__).resolve().parents if (parent / ".env").exists()),
        None,
    )
    if root_env is None:
        return

    for raw_line in root_env.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue

        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"\"", "'"}:
            value = value[1:-1]
        os.environ[key] = value.replace("\\n", "\n")


_load_root_env()

MODEL_SIZE = os.getenv("ASR_MODEL", "small.en").strip()
DEVICE = os.getenv("ASR_DEVICE", "cpu").strip().lower()
COMPUTE_TYPE = os.getenv(
    "ASR_COMPUTE_TYPE", "float16" if DEVICE == "cuda" else "int8"
).strip()
MODEL_DIR = os.getenv("ASR_MODEL_DIR", "/models/faster-whisper")
VAD_FILTER = os.getenv("ASR_VAD_FILTER", "true").strip().lower() not in {"0", "false", "no"}
BEAM_SIZE = max(1, int(os.getenv("ASR_BEAM_SIZE", "5")))
SENTENCE_GAP_MS = max(0, int(os.getenv("ASR_SENTENCE_GAP_MS", "900")))
MAX_UPLOAD_MB = max(1, int(os.getenv("ASR_MAX_UPLOAD_MB", "100")))

SENTENCE_END_RE = re.compile(r"[.!?][\"'\)\]\}]*$")


class AsrRuntime:
    def __init__(self) -> None:
        self.model: WhisperModel | None = None
        self.lock = threading.Lock()
        self.ready = False
        self.error: str | None = None

    def load(self) -> None:
        try:
            self.model = WhisperModel(
                MODEL_SIZE,
                device=DEVICE,
                compute_type=COMPUTE_TYPE,
                download_root=MODEL_DIR,
            )
            self.ready = True
            self.error = None
        except Exception as exc:
            self.ready = False
            self.error = str(exc)
            raise

    def transcribe(self, path: str, language: str | None) -> dict[str, object]:
        if not self.model:
            raise RuntimeError("ASR model is not loaded")

        with self.lock:
            segments_iter, info = self.model.transcribe(
                path,
                language=language or None,
                beam_size=BEAM_SIZE,
                word_timestamps=True,
                vad_filter=VAD_FILTER,
                condition_on_previous_text=True,
            )
            raw_segments = list(segments_iter)

        all_words: list[dict[str, object]] = []
        raw: list[dict[str, object]] = []
        for segment in raw_segments:
            words = []
            for word in segment.words or []:
                item = {
                    "word": word.word,
                    "startMs": round((word.start or 0.0) * 1000),
                    "endMs": round((word.end or word.start or 0.0) * 1000),
                    "probability": round(float(word.probability or 0.0), 4),
                }
                words.append(item)
                all_words.append(item)
            raw.append(
                {
                    "text": segment.text.strip(),
                    "startMs": round(segment.start * 1000),
                    "endMs": round(segment.end * 1000),
                    "words": words,
                }
            )

        sentences = build_sentences(all_words, raw)
        text = " ".join(sentence["text"] for sentence in sentences).strip()
        info_duration = float(getattr(info, "duration", 0.0) or 0.0)
        duration_ms = round(info_duration * 1000) if info_duration > 0 else 0
        if not duration_ms and sentences:
            duration_ms = int(sentences[-1]["endMs"])
        elif not duration_ms and raw:
            duration_ms = int(raw[-1]["endMs"])

        return {
            "text": text,
            "language": getattr(info, "language", language or "unknown"),
            "languageProbability": round(float(getattr(info, "language_probability", 0.0) or 0.0), 4),
            "durationMs": duration_ms,
            "model": MODEL_SIZE,
            "device": DEVICE,
            "computeType": COMPUTE_TYPE,
            "segments": sentences,
        }


def _join_words(words: list[dict[str, object]]) -> str:
    # faster-whisper includes leading spaces in word tokens. Joining the raw
    # tokens preserves punctuation spacing better than inserting spaces ourselves.
    raw = "".join(str(word["word"]) for word in words).strip()
    return re.sub(r"\s+", " ", raw)


def _confidence(words: list[dict[str, object]]) -> float:
    if not words:
        return 0.0
    return round(
        sum(float(word.get("probability", 0.0) or 0.0) for word in words) / len(words),
        4,
    )


def build_sentences(
    words: list[dict[str, object]], raw_segments: list[dict[str, object]]
) -> list[dict[str, object]]:
    if not words:
        return [
            {
                "text": str(segment["text"]),
                "startMs": int(segment["startMs"]),
                "endMs": int(segment["endMs"]),
                "durationMs": max(0, int(segment["endMs"]) - int(segment["startMs"])),
                "confidence": 0.0,
                "words": [],
            }
            for segment in raw_segments
            if str(segment["text"]).strip()
        ]

    result: list[dict[str, object]] = []
    current: list[dict[str, object]] = []

    def flush() -> None:
        nonlocal current
        if not current:
            return
        start_ms = int(current[0]["startMs"])
        end_ms = int(current[-1]["endMs"])
        result.append(
            {
                "text": _join_words(current),
                "startMs": start_ms,
                "endMs": end_ms,
                "durationMs": max(0, end_ms - start_ms),
                "confidence": _confidence(current),
                "words": current,
            }
        )
        current = []

    for word in words:
        if current:
            gap_ms = int(word["startMs"]) - int(current[-1]["endMs"])
            if SENTENCE_GAP_MS and gap_ms >= SENTENCE_GAP_MS:
                flush()
        current.append(word)
        if SENTENCE_END_RE.search(str(word["word"]).strip()):
            flush()

    flush()
    return [item for item in result if str(item["text"]).strip()]


runtime = AsrRuntime()


@asynccontextmanager
async def lifespan(_: FastAPI):
    runtime.load()
    yield


app = FastAPI(title="ListenUp Faster Whisper ASR", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "provider": "faster-whisper",
        "model": MODEL_SIZE,
        "ready": runtime.ready,
        "device": DEVICE,
        "computeType": COMPUTE_TYPE,
        "vadFilter": VAD_FILTER,
        "error": runtime.error,
    }


@app.post("/v1/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: str = Form(default="en"),
) -> dict[str, object]:
    if not runtime.ready:
        raise HTTPException(status_code=503, detail=runtime.error or "ASR is not ready")

    suffix = Path(file.filename or "audio.bin").suffix or ".bin"
    limit = MAX_UPLOAD_MB * 1024 * 1024
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status_code=413, detail=f"Audio file exceeds {MAX_UPLOAD_MB} MB")
    if not data:
        raise HTTPException(status_code=422, detail="Audio file is empty")

    tmp_path = ""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(data)
            tmp_path = tmp.name
        return runtime.transcribe(tmp_path, language)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}") from exc
    finally:
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
