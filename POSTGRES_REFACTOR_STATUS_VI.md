# VocaLearn — Đại tu PostgreSQL V8 (bản thử nghiệm, chưa đạt full E2E)

## Đã triển khai trên bản mã nguồn V7

Đây là bản **worktree thử nghiệm**, không phải release đã xác minh chạy hoàn chỉnh. Bản gốc V7 không bị thay đổi.

- Thay hạ tầng MongoDB bằng một PostgreSQL 17 server với **8 database logic** và account riêng cho mỗi domain. File `database/postgres/01-init.sql` là nguồn DDL chính, chạy một lần trên volume trống. Không dùng migration/restore `.dump` cũ.
- Thiết kế **49 bảng nghiệp vụ và 16 bảng outbox/inbox**, các cột typed và JSONB cho trường lồng nhau. Index JSONB được sửa sang GIN/biểu thức phù hợp.
- Loại dependency `mongoose`, `@nestjs/mongoose` và `pymongo` khỏi code runtime/package. Dùng lớp PostgreSQL compatibility repository trong `apps/api/src/postgres/compat.ts` và psycopg trong Python jobs/relays. Phần compatibility này giữ API cũ nhưng chưa thay được mọi truy vấn phức tạp.
- Đưa cấu hình về duy nhất `.env` tại root (có `.env.example`). Seed Admin qua SQL/bcrypt, không reset mật khẩu khi restart; Identity chờ seed thành công.
- Tạo `docker-compose.yml` (full, 32 services) và `compose.infra.yml` (10 Docker services cho máy chạy API/Next/PostgreSQL local). Node gateway local hỗ trợ HTTP/WebSocket và 8 Nest roles + audio worker (cổng 5009).
- Relay sử dụng PostgreSQL `outbox_events` → RabbitMQ, consumer ghi `inbox_events` để idempotent receipt. Không sử dụng MongoDB Change Streams.

## Kiểm tra đã chạy trong môi trường biên tập

- `python scripts/audit-postgres.py`: 12/12 kiểm tra cấu trúc đạt.
- `node scripts/check-ts-syntax.cjs`: 678 file TypeScript/TSX không lỗi cú pháp / đường dẫn import tương đối thiếu.
- `node tests/pg-compat-smoke.cjs`: CRUD cơ bản và aggregate đơn giản trên **mock pool** đạt.
- `node --test apps/api/src/scripts/seed-admin-core.test.mjs`: 8/8 test logic seed đạt.
- Python `compileall` đạt; 263/263 route API tĩnh khớp Nginx.

**CHƯA chạy được**: `pnpm install`/full `tsc`, `psql` khởi tạo thật, `docker compose up --build`, toàn bộ request end-to-end. Môi trường xử lý file không có Docker daemon hoặc PostgreSQL server, thiếu npm dependencies nên không có cơ sở khẳng định chạy được.

## Các khối CHƯA HOÀN THÀNH — chặn tuyên bố chuyển đổi toàn bộ thành công

1. Một số pipeline aggregation nhiều tầng, `populate` và truy vấn giữa nhiều database vẫn còn logic theo kiểu document cũ, chưa được viết lại thành SQL và client/event theo đúng service ownership. Compatibility adapter chỉ xử lý subset và hiện lọc nhiều truy vấn bằng JS sau `SELECT` — **không sẵn sàng cho production**.
2. Domain consumers hiện ghi inbox event nhưng **chưa thực hiện đầy đủ cập nhật read-model nghiệp vụ**. XP, Arena, user profile và notification đòi hỏi kiểm thử luồng xuyên service.
3. Chưa rà soát/xác nhận toàn bộ `NOT NULL`, FK và JSONB model mapping bằng dữ liệu thực tế; các bảng SQL là phần thiết kế nền tảng từ schema V7, không phải schema production đã nghiệm thu.
4. Local PostgreSQL Windows phải cho phép các container Python truy cập đến `host.docker.internal:5432` bằng `listen_addresses` và `pg_hba.conf` giới hạn subnet Docker. Không mở PostgreSQL ra Internet.
5. Cần chạy full TypeScript typecheck, dựng Docker, và E2E các luồng login user/admin, tạo bài, TOEIC attempts, XP, Arena, upload media, TTS/ASR và event delivery. Có thể phát sinh lỗi kiểu dữ liệu khi chuyển từ document sang UUID.

## Full Docker (CHỈ thử với dữ liệu mới, khi đã sẵn sàng sửa lỗi runtime)

```powershell
Copy-Item .env.example .env
notepad .env
pnpm install --no-frozen-lockfile
python scripts/audit-postgres.py
docker compose config --quiet
docker compose up -d --build
```

Kiểm tra `docker compose ps -a`, logs `postgres`, `admin-seed`, `identity-service` trước. `01-init.sql` chỉ chạy **khi volume PG mới trống**; thay SQL không tự cập nhật DB hiện có. KHÔNG dùng `docker compose down -v` trên các volume chứa dữ liệu bạn cần giữ.

## Hybrid local (máy không có GPU)

Cài Node >=24, pnpm 11, PostgreSQL 17 trên Windows; đặt PostgreSQL và `psql.exe` trên PATH. Docker Desktop chạy Redis, RabbitMQ, SeaweedFS, TTS/ASR CPU và Python job services.

```powershell
Copy-Item .env.example .env
notepad .env
powershell -ExecutionPolicy Bypass -File .\scripts\init-postgres-local.ps1
docker compose -f compose.infra.yml up -d --build
pnpm install --no-frozen-lockfile
node scripts/dev-local.mjs all
```

Cổng: user `3000`, admin `3001`, gateway `5000`, 8 Nest backend `5001–5008`, audio worker `5009`, PostgreSQL local `5432`, Redis `6379`, RabbitMQ `5672`/UI `15672`, TTS `8001`, ASR `8002`.

**Cảnh báo:** Chỉ dùng hai chế độ ở hai môi trường riêng, không khởi chạy đồng thời hai Compose project (trùng port). Không dùng bản thử nghiệm này thay hệ thống đang hoạt động trước khi hoàn thành kiểm thử nêu trên.
