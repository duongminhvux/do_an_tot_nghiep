# Hướng dẫn sửa Docker Build và đồng bộ MongoDB — VocaLearn

## Nguyên nhân đã xác định trong source

1. `apps/api/Dockerfile` trước đây nhận `SERVICE_ROLE` rồi chạy `tsc` riêng cho
   9 vai trò. Khi `docker compose up -d --build`, chúng chạy song song, tranh
   tài nguyên RAM/SSD và mỗi service xuất một image.
2. `database/init.js` trước đây dừng nếu checksum của
   `database/schema/collections.json` thay đổi. `bootstrap.ts` và
   `services/projections/projection.py` cũng so sánh checksum cũ, nên **chỉ
   sửa db-init không đủ**.
3. 13 projection process, 5 domain-events process và hai ASR-job process
   bị cấu hình xuất các image riêng dù dùng cùng Dockerfile.

## Thay đổi trong bản vá

- Một lệnh `tsc -p tsconfig.docker.json` biên dịch tất cả 8 entrypoint API +
  `audio-worker-main.ts`. 9 container ứng dụng chạy các entrypoint riêng
  từ **một image**, vẫn giữ từng DB, endpoint và biến môi trường độc lập.
- Các image chung của projection, domain-event, ASR jobs và nhóm PDF-AI
  tùy chọn được tái sử dụng. Tổng cấu hình build **38 -> 13**, tổng số
  service **giữ nguyên 45**.
- `db-init` có Dockerfile riêng, COPY schema vào image để một thay đổi schema
  khiến `up --build` phát hiện và chạy lại job.
- Tạo collection/index thiếu; cập nhật JSON Schema validator ở chế độ `warn`;
  lưu checksum mới trong `schema_manifest_current`. Giữ nguyên dữ liệu, marker
  `initial_schema_v1`, `projectionStartTime` và resume checkpoints.
- Các API/worker kiểm tra checksum hiện hành thay vì bắt buộc checksum gốc.
- Tắt provenance/SBOM cho image build **cục bộ** (cần Compose >= 2.39).

Lưu ý: Docker *build image trước*, sau đó mới khởi động MongoDB, chạy db-init,
và chờ db-init thành công để **start** các service. Đây là thứ tự chuẩn của
`docker compose up -d --build`.

## Cách áp dụng vào project hiện tại

**Không xóa hoặc ghi đè `.env`, `storage`, Mongo volume hay dữ liệu cũ.**

Giải nén `vocalearn-build-db-patch.zip` vào **thư mục gốc** của project, cho
phép ghi đè các file mã nguồn được liệt kê. Nếu tải file vào Downloads:

```powershell
cd D:\Code\do_an\do_an_tot_nghiep
Expand-Archive -Path "$HOME\Downloads\vocalearn-build-db-patch.zip" -DestinationPath . -Force
```

Nên sao lưu MongoDB trước khi thay đổi schema trên dữ liệu quan trọng.

Trong `.env` **hiện có**, thêm dòng này nếu chưa có để tránh tải SSD 100%
trong lần build đầu tiên (không cần thay đổi lệnh triển khai):

```dotenv
COMPOSE_PARALLEL_LIMIT=2
```

Chạy:

```powershell
docker compose version
docker compose config --quiet
docker compose up -d --build
docker compose ps -a
docker compose logs db-init --tail=100
```

Nếu vẫn chậm, xem lệnh build chi tiết:

```powershell
docker compose --parallel 2 --progress plain up -d --build
```

## Khi schema thay đổi

Thay `database/schema/collections.json` rồi chạy lại `up -d --build`.
Job db-init sẽ tạo phần thiếu và cập nhật validators/indexes mà không xóa
collection hay dữ liệu trước đó. Có thể xem marker mới qua:

```powershell
docker compose exec mongo mongosh --quiet --eval 'db.getSiblingDB("identity_db").database_versions.findOne({_id:"schema_manifest_current"})'
```

Nếu database **tự bị sửa ngoài Compose** nhưng file manifest chưa thay đổi,
có thể ép db-init chạy lại:

```powershell
docker compose up -d --force-recreate db-init
docker compose up -d --build
```

**Không tự động** đổi tên field, backfill, đổi kiểu dữ liệu hiện có, xóa index,
hoặc giải quyết trùng dữ liệu khi thêm `unique` index. Các trường hợp này cần
migration có kiểm soát và backup trước khi chạy. Nếu không tạo được index,
`db-init` sẽ lỗi thay vì tự xóa documents.

## Mức độ kiểm chứng

Đã đạt các test giả lập khởi tạo DB/migration, YAML tĩnh, định tuyến Nginx và
phân tích cú pháp 647 file TypeScript/TSX. **Chưa chạy full Docker build,
NestJS typecheck hay MongoDB thật** trong môi trường kiểm tra hiện tại, vì
không có Docker daemon hoặc bộ dependencies hoàn chỉnh. Xem log trên máy
triển khai để xác định có lỗi khác sau bước build trước đó hay không.
