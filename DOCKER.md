# Docker CPU và CUDA

Chạy từ thư mục gốc, dùng cấu hình chung trong `.env`.

## CPU mặc định

```powershell
docker compose up -d --build
```

Lệnh trên luôn build/chạy ASR và TTS với CPU, kể cả khi `.env` đặt device là `cuda`.
Chế độ chỉ chạy hạ tầng trên Docker: `pnpm dev:infra`.

## CUDA theo từng service trong .env

Ví dụ bật GPU cho cả hai service:

```dotenv
ASR_DEVICE=cuda
ASR_COMPUTE_TYPE=float16
KOKORO_DEVICE=cuda
TORCH_VERSION=2.7.1
TORCH_CUDA_VARIANT=cu126
```

```powershell
pnpm dev:docker:cuda
# Tương đương, không cần pnpm:
node scripts/docker-up.mjs --cuda
```

Service có device `cuda` mới được thêm CUDA override và quyền truy cập GPU;
service còn lại vẫn dùng CPU. Lệnh kiểm tra GPU bên trong Docker trước khi build.
Máy cần NVIDIA driver và Docker GPU support (Docker Desktop dùng WSL2 trên Windows,
NVIDIA Container Toolkit trên Linux). Không tự chuyển về CPU nếu GPU không hoạt động.

Các lệnh khác:

```powershell
# Tự chọn CPU/CUDA theo .env; cho phép cả hai device đều cpu.
pnpm dev:docker:auto
# Chỉ build/start riêng ASR; các service khác được giữ nguyên.
node scripts/docker-up.mjs --cuda asr-service
# Hạ tầng Docker khi Node/Next chạy trên host.
pnpm dev:infra:cuda
# Xem lệnh đã chọn, không build/chạy container.
node scripts/docker-up.mjs --cuda --dry-run
# Kiểm tra cấu hình Compose và GPU, chưa build/start service.
node scripts/docker-up.mjs --cuda --check
```

Nếu muốn dùng Docker Compose trực tiếp, thêm override tương ứng (bỏ file của service
không cần CUDA). Các override này bật CUDA rõ ràng, không tự đọc device để chọn file:

```powershell
docker compose -f docker-compose.yml -f compose.asr-cuda.yml -f compose.tts-cuda.yml up -d --build
```

## Giữ cache PyTorch/CUDA

TTS cài Torch và TorchAudio cùng phiên bản vào layer riêng, trước `requirements.txt`
và code ứng dụng. Bộ cài kiểm tra phiên bản và biến thể `cpu`/`cu126` đã có; chỉ cài
khi thiếu hoặc khác bản. Sau khi cài dependency, build kiểm tra lại Torch và CUDA
runtime, tránh dependency kéo nhầm Torch CPU/CUDA hoặc nâng phiên bản ngoài ý muốn.
Không dùng `torch.cuda.is_available()` trong build vì GPU chỉ được cấp lúc chạy;
TTS kiểm tra điều này khi khởi động.

Cache pip của CPU/CUDA được tách riêng bằng BuildKit cache mounts. Sửa code không
cài lại Torch; sửa dependency khác cũng giữ layer Torch. Chuyển CPU ↔ CUDA dùng lại
layer đã build trước đó khi cache còn. Lần đầu của mỗi biến thể vẫn cần tải package.
Không xóa build cache (`docker builder prune`/`docker system prune`) nếu muốn giữ nó.
Cache nằm trong Docker builder, độc lập với PyTorch cài trên Windows/host.

ASR dùng faster-whisper/CTranslate2, không cần PyTorch. Image GPU chứa CUDA 12 và
cuDNN 9; cache package và volume model hiện có vẫn được dùng lại.

Kiểm tra sau khi khởi động:

```powershell
Invoke-RestMethod http://localhost:8001/health
Invoke-RestMethod http://localhost:8002/health
```

Kiểm thử lựa chọn thiết bị, bộ cài Torch và cấu hình Compose:

```powershell
node --test tests/docker-devices.mjs
python -m unittest discover -s services/tts-service -p test_install_torch.py
node --test tests/docker-compose-devices.mjs
```

Tài liệu tham chiếu: [Compose GPU](https://docs.docker.com/compose/how-tos/gpu-support/),
[Docker build cache](https://docs.docker.com/build/cache/optimize/),
[PyTorch 2.7.1 wheels](https://pytorch.org/get-started/previous-versions/),
[faster-whisper CUDA requirements](https://github.com/SYSTRAN/faster-whisper/tree/v1.1.1#gpu).
