# Tiến độ chuyển backend sang PostgreSQL native

**Chưa hoàn tất toàn bộ backend.** Các phần dưới đây đã được sửa và kiểm thử; `compat.ts` vẫn có consumer đang hoạt động nên chưa được xóa toàn bộ.

## Đã chuyển sang SQL trực tiếp

- Toàn bộ `VocabularyGroupsService`, `CollectionsService`, `LessonsService`, `WordsService`: đọc, tạo, sửa, soft-delete/restore, phân trang, tìm kiếm, thống kê, gán nhóm, sắp xếp, thêm/xóa từ trong bài học. Giữ phần `findAll` của groups đã có trong worktree và chuyển các phương thức còn lại.
- `AdminsService`: tìm tài khoản và đăng nhập đọc cột PostgreSQL; bỏ model injection, `toObject()` và schema admin cũ.
- Cập nhật audio thuộc Content/Assessment: câu lệnh SQL/JSONB nguyên tử; worker và owner nhận `{ fields: ... }`, không còn giao thức `$set` cho luồng ghi audio.
- Kết nối/pool/transaction chuyển sang `postgres/connection.ts`; `postgres/sql.ts` cung cấp tham số SQL và ánh xạ cột sang tên trường API. Các service vốn đã dùng SQL trực tiếp được chuyển import khỏi `compat.ts`.
- Module vocabulary không còn đăng ký model/schema. Các module khác còn đọc vocabulary qua bridge cũ vẫn giữ metadata cần dùng.

SQL thực hiện lọc, `JOIN`, `COUNT`, phân trang, bulk reorder và upsert trên database. Xóa group và tách collections, xóa section và tách lessonwords chạy chung transaction. Đổi từ và đánh dấu audio stale chạy cùng một `UPDATE`, chỉ tăng publication revision một lần. Publication gate cho learner vẫn được áp dụng.

Cột SQL là nguồn dữ liệu chính, kể cả `NULL`. Khi sửa, các bản sao tương ứng trong `payload` bị loại bỏ để reader cũ không khôi phục giá trị đã xóa. Hai trường `variations`/`related_words` của baseline vẫn là `TEXT` chứa JSON; code xử lý đúng dạng này, chưa thay đổi DDL hoặc migration đã phát hành.

## Đã gỡ phần schema/compat không còn tác dụng

- Xóa `modules/admins/schema/admin.schema.ts` và file re-export thừa `modules/learning/progress/user-daily-activity.schema.ts`.
- Xóa 56 lời gọi `Schema.index(...)` không tạo index trên PostgreSQL. Index thật vẫn thuộc migration SQL.
- Xóa 55 decorator `PgEntity` không có tác dụng, registry không được đọc, hook/schema API không có consumer và các alias Mongo cũ không dùng.
- Tách enum audio khỏi schema để các luồng SQL native không phải nạp schema decorator.

Các `PgField`/schema definition còn lại vẫn cung cấp default, validation, reference hoặc khôi phục kiểu ngày cho consumer cũ. Chưa xóa chúng khi consumer đó vẫn hoạt động.

## Audit còn lại

Chạy `node scripts/audit-postgres-native.cjs --output POSTGRES_NATIVE_AUDIT.json` để xuất vị trí cụ thể; thêm `--check-complete` để nhận exit code lỗi khi còn bridge cũ. Audit dùng AST và kiểu TypeScript, bỏ qua spec/comment và tham số SQL `$1`, `$2`.

| Chỉ số source runtime                                    | Hiện tại |
| -------------------------------------------------------- | -------: |
| Import từ compat                                         |      228 |
| Model injection                                          |      116 |
| Thuộc tính/toán tử truy vấn bắt đầu bằng `$`             |      974 |
| Lời gọi phương thức trên kiểu được khai báo trong compat |      980 |
| File còn tham chiếu hoặc truy vấn cũ                     |       97 |
| File SQL native đã đưa vào kiểm tra chống regression     |        8 |

Các con số này dùng cách đếm AST, không so trực tiếp với audit regex theo dòng trước đây. Receiver kiểu `any` cần rà soát thủ công thêm. So với `HEAD`, audit cùng công cụ ghi nhận 264 import, 128 injection, 1.106 toán tử, 1.158 lời gọi và 120 file; so sánh này cũng bao gồm thay đổi groups đã có sẵn trước lượt làm việc này.

Phần còn lại gồm Users, Assessment/Attempts/Exams/Questions, Arena, Dictation, Learning/Reviews/SavedWords/Sessions/Progress, Activity logs, Dashboard, Minigame và các read-model bridge. **Chưa đáp ứng điều kiện xóa toàn bộ `compat.ts`.**

## Kiểm chứng

- TypeScript `--noEmit`: PASS toàn source backend và cả 9 cấu hình role (identity, content, assessment, learning, arena, media-jobs, ai-import, notification, audio-worker).
- `node tests/postgres-native-content.cjs`: PASS. Thực thi SQL trên PostgreSQL WASM/PGlite với baseline/migration của dự án: CRUD, JOIN, JSONB, upsert, reorder, publication, rollback khi tách collection thất bại, audio path validation và admin authentication.
- `node tests/pg-compat-smoke.cjs`: PASS; dùng pool giả, chỉ xác nhận consumer cũ vẫn hoạt động.
- `node tests/read-model-sql-contract.cjs`: PASS.
- `node tests/schema-contracts.cjs`: PASS.
- Audit 8 file đã chuyển: PASS, không còn import/model/toán tử bridge cũ trong các file này.
- Vitest toàn backend: **335 PASS, 24 FAIL, 40 SKIP**. Các test FAIL đã tái hiện trên bản `HEAD` với cùng dependency; không có tên test thất bại mới. Test reorder dùng UUID ngẫu nhiên còn có thể dao động thêm một lỗi giữa các lần chạy.
- Chưa chạy deployment Docker, PostgreSQL server ngoài, HTTP/WebSocket end-to-end hoặc workflow Redis/RabbitMQ.

Dependency test PostgreSQL WASM được khai báo tại `apps/api/package.json`; chạy bằng `pnpm --filter api test:postgres-native`. Worker audio và owner phải cùng dùng phiên bản giao thức `{ fields: ... }` sau khi triển khai.
