# VocaLearn — Đợt 1: Tối ưu truy vấn PostgreSQL và API Gateway

Ngày rà soát: 27/10/2026. Nguồn: `project(20261027-111317).zip`.

**Phạm vi:** sửa query, read-model, gateway và regression test. Không sửa giao diện,
Dockerfile/build image, không xóa database hoặc chuyển đổi kiến trúc microservice.

## Đã thực hiện

1. `apps/api/src/postgres/compat.ts`: truy vấn `find/findOne` có filter SQL an toàn
   và sort theo số/ngày sẽ đẩy `WHERE`, `ORDER BY`, `LIMIT`, `OFFSET` xuống PostgreSQL.
   Các phép collation văn bản hoặc filter không thể chuyển chính xác vẫn dùng adapter
   cũ. `$in` dùng kiểu SQL gốc (UUID, boolean...) thay vì ép text, tránh vô hiệu hóa index.
   Regex dạng `new RegExp()` được chuyển thành pattern SQL hợp lệ; filter của request
   không nối trực tiếp vào câu SQL. `countDocuments` tôn trọng publication scope.
2. `apps/api/src/postgres/compat.ts`: tối ưu pipeline đơn giản `$match` + `$group`
   với `{$sum:1}` thành `GROUP BY` và `COUNT(*)`, giúp danh sách bộ/lesson giảm tải.
   Các pipeline phức tạp (`$lookup`, `$facet`, `$unwind`...) chưa chuyển toàn bộ.
3. `apps/api/src/modules/vocabulary/groups/vocabulary-groups.service.ts`: bỏ chuỗi
   tải lessons rồi tất cả lesson-words để đếm. Dùng một truy vấn join/group trên các
   collection của trang hiện tại, giữ nguyên DTO trả về và điều kiện publication.
4. `apps/api/src/internal/read-models.module.ts`: thêm endpoint POST query/count
   lọc có tham số, trả dữ liệu trang tối đa 2000 hàng, từ chối sort/filter SQL không
   hỗ trợ (422), kiểm soát token và không tiết lộ credential của Identity.
   `compat.ts` sử dụng các endpoint này cho foreign page/count, với fallback tạm thời
   để giữ tương thích.
5. `infra/gateway/nginx.conf` + `scripts/dev-gateway.mjs`: thêm tám endpoint
   `/gateway/{role}-ready` tới `/api/health/ready` của từng service. Giữ health
   liveness và các tuyến hiện tại; chặn `_internal` tại Gateway.
6. `docker-compose.yml`: Gateway chờ đủ tám service `service_healthy`; Next.js
   web/admin chờ Gateway healthy; bổ sung healthcheck riêng cho Nginx.
7. `scripts/check-client-gateway-routes.cjs`: giải quyết ba false positive do
   `PublicationKind` template bằng cách mở rộng đúng union type từ shared-types.
8. Bổ sung kiểm tra static Gateway, contract query, và smoke network.

## Đã chạy trong môi trường phân tích

- `node scripts/check-gateway-contract.cjs`: **PASS**, 41 trường hợp route, 51
  tiền tố controller, 8 role readiness.
- `node scripts/check-client-gateway-routes.cjs`: **PASS**, 288 biến thể URL client,
  không có route không khớp.
- `node tests/pg-compat-smoke.cjs`: **PASS** (mock SQL, không có PostgreSQL thật).
- `node tests/read-model-sql-contract.cjs`: **PASS** (mock HTTP/controller & SQL).
- `node tests/schema-contracts.cjs`: **PASS** (cấu trúc entity/SQL tĩnh).
- `docker-compose.yml`: YAML hợp lệ, các điều kiện healthcheck hợp lý.

**Chưa xác minh:** Node/Nest TypeScript build toàn bộ vì ZIP không có node_modules,
không có pnpm-lock.yaml và môi trường kiểm tra không có Docker/PostgreSQL đang chạy.
Không khẳng định latency đã giảm bao nhiêu phần trăm, không khẳng định mọi API E2E
đã thông. Chạy các smoke test bên dưới trên máy có môi trường thực trước khi triển khai.

## Kiểm tra trên máy chạy dự án

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps -a
docker compose exec -T gateway nginx -t
docker compose exec -T identity-service node scripts/smoke-network.mjs
docker compose exec -T identity-service node scripts/smoke-postgres-stack.mjs
```

Kiểm tra thêm với user/admin thực: đăng nhập, tìm kiếm nhóm, phân trang nhóm/collection,
TOEIC, upload/Range, refresh token, Arena WebSocket, và worker RabbitMQ.
Chạy `EXPLAIN (ANALYZE, BUFFERS)` trên bản sao PostgreSQL trước khi thêm index.

## Tồn tại cần xử lý ở đợt sau

- `GET /api/_internal/read-models/:table` vẫn giữ để tương thích với phép aggregate
  và lookup phức tạp, có thể trả nhiều hàng. Cần chuyển từng caller sang owner DTO
  hoặc read projection (không xóa vội vì sẽ gây lỗi).
- `compat.ts` còn update/delete theo từng hàng cho nhiều thao tác, `$lookup` phức tạp
  vẫn trong bộ nhớ. Chuyển các đường nóng sang repository SQL riêng sau khi đo hiệu năng.
- `find` với sort ngôn ngữ, regex/phép lọc phi SQL dùng fallback để giữ output cũ.
- Chưa sửa Docker image nặng, FE bundle và component lớn — đúng phạm vi yêu cầu.
- Chưa sửa schema/index migration: dữ liệu hiện có phải được bảo vệ; tạo migration
  và cập nhật schema contracts sau khi có `EXPLAIN` trên database thật.

**An toàn:** giữ nguyên `.env` bản gốc nhưng chứa secret. Không commit hoặc chia sẻ
file ZIP này công khai; cân nhắc rotate credential nếu đã lộ ra bên ngoài.
