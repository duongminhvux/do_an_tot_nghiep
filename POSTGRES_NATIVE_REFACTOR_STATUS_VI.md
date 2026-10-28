# Backend PostgreSQL native — trạng thái hoàn tất

Cập nhật ngày 28/10/2026. Toàn bộ 40 model với 116 vị trí injection còn lại ở commit `7f9045e` đã được chuyển sang truy vấn PostgreSQL native. Đã xóa `apps/api/src/postgres/compat.ts`, các schema decorator cũ và đăng ký `PgModelsModule.forFeature`.

## Kết quả audit source

Chạy `node scripts/audit-postgres-native.cjs --check-complete --output POSTGRES_NATIVE_AUDIT.json`.

| Chỉ số | Còn lại |
| --- | ---: |
| Import compat / driver Mongo | 0 |
| Model injection cũ | 0 |
| Toán tử truy vấn Mongo | 0 |
| Phương thức truy vấn document cũ | 0 |
| Khai báo kiểu/decorator/registry cũ | 0 |
| File `*.schema.ts` trong backend | 0 |
| File runtime còn vi phạm | 0 |

Audit kiểm tra toàn bộ 332 file TypeScript runtime, không dùng danh sách miễn trừ theo service. `$1`, `$2` trong SQL là tham số PostgreSQL hợp lệ. Các test kiểm tra việc từ chối giao thức cũ không phải consumer Mongo đang hoạt động.

## Phạm vi 40 model

| Nhóm | Model đã chuyển |
| --- | --- |
| Identity | `User` |
| Vocabulary | `Word`, `Collection`, `Lesson`, `LessonWord`, `Section` |
| Assessment | `Exam`, `ExamGroup`, `Question`, `Passage`, `PassageGroup`, `Attempt`, `PdfAiCorrectionEvent` |
| Dictation | `DictationLesson`, `DictationProgress`, `DictationSection`, `DictationSegment`, `DictationTopic` |
| Learning | `UserDailyActivity`, `UserLessonProgress`, `UserLessonWord`, `UserWordReview`, `UserSavedWord`, `VocabularyFolder`, `LearningSession`, `LearningSessionWord`, `LearningActivity`, `GameDefinition`, `MiniGameResult` |
| Arena | `ArenaInvitation`, `ArenaMatch`, `ArenaMatchPlayer`, `ArenaMatchQuestion`, `ArenaPlayerAnswer`, `ArenaProfile`, `ArenaRatingHistory`, `ArenaRoom`, `ArenaSettings`, `FriendRoom` |
| Activity logs | `ActivityLog` |

`AdminsService`, vocabulary groups và các service vocabulary đã chuyển ở lượt trước tiếp tục dùng SQL. Audio jobs và worker settings cũng đã bỏ `makePgModel`, dùng SQL trực tiếp.

## Cách triển khai hiện tại

- `postgres/connection.ts`: pool và giao dịch PostgreSQL; các repository, outbox và ghi XP trong cùng luồng dùng chung kết nối giao dịch.
- `postgres/sql.ts`, `postgres/records.ts`: câu SQL có tham số, ánh xạ cột, `INSERT`, `UPDATE ... RETURNING`, `ON CONFLICT`, `SELECT ... FOR UPDATE`. Không có bộ dịch filter/pipeline Mongo.
- Các file `rows/*.row.ts` chỉ chứa interface/enum TypeScript. Default ứng dụng được khai báo trong `record-defaults.ts`; kiểu cột, constraint, index và trigger thuộc migration SQL.
- API tiếp tục trả `_id` dạng chuỗi UUID để các client hiện tại sử dụng. Không còn `PgId`, document method, `save()`, `toObject()` hay `populate()` của model.
- Đọc dữ liệu giữa các service đi qua API nội bộ chuyên biệt của owner, xác thực token và role. Đã xóa endpoint read-model tổng quát nhận filter document và xuất cả bảng.
- Các danh sách/detail dành cho người học áp dụng điều kiện publication trong SQL. Tìm kiếm nội dung dùng tham số và coi ký tự `%` là văn bản.
- Lưu đáp án, giới hạn phát audio, chấm TOEIC, cộng điểm Arena, cập nhật thành viên phòng và SRS dùng khóa/giao dịch hoặc điều kiện cập nhật nguyên tử. Kết quả và sự kiện outbox được ghi cùng giao dịch.
- Đã thay các test dùng model giả/pipeline cũ bằng kiểm thử SQL; xóa smoke test chỉ dành cho bridge đã gỡ.

## Migration cần chạy khi triển khai

Migration mới: `database/postgres/migrations/assessment/0016_native_attempt_fields.sql`.

Migration chuyển các trường thường truy vấn của attempt và `group_order` của exam từ JSONB extension sang cột có kiểu, backfill giá trị hiện có và tạo index. Schema contract đã được tạo lại từ database PostgreSQL 17 tạm, khớp migration mới.

Chạy migration Assessment với cấu hình kết nối của môi trường triển khai trước khi khởi động phiên bản backend này:

```powershell
$env:SERVICE_ROLE = 'assessment'
node scripts/migrate.mjs
```

Database ứng dụng hiện có chưa được thay đổi trong lượt refactor; các kiểm thử server sử dụng container/database tạm riêng và tự dọn sau khi chạy.

## Kiểm chứng

| Kiểm tra | Kết quả |
| --- | --- |
| TypeScript toàn backend, bao gồm spec | PASS |
| TypeScript cả 9 role | PASS |
| Vitest toàn backend | 223 PASS, 0 FAIL, 40 SKIP khi không cấu hình database ngoài |
| Bộ tích hợp PostgreSQL 17 riêng: publication, mistakes, recommendations, Arena và các boundary liên quan | 167 PASS |
| TOEIC với nhiều kết nối PostgreSQL thật | PASS: giữ đủ đáp án, cho sửa TEST, khóa PRACTICE sau reveal, submit nhất quán |
| 41 row contract so với schema đã chạy migration | PASS |
| SQL/PGlite cho Vocabulary, Admin, audio và các domain còn lại | PASS |
| Owner API: xác thực, role, scope, giới hạn trang/ID và tham số SQL | PASS |
| Audit PostgreSQL native | PASS, không còn bridge/schema/query Mongo |
| Audit cấu hình tĩnh PostgreSQL tổng thể | 13 PASS, 0 FAIL |

Lệnh chạy lại:

```text
pnpm --filter api check-types
pnpm --filter api test
pnpm --filter api test:postgres-native
node scripts/audit-postgres-native.cjs --check-complete
node scripts/test-recommendations-postgres.mjs --publication --mistakes --arena
```

Lệnh kiểm thử PostgreSQL 17 cần Docker và tạo container tạm; không dùng database ứng dụng. Chưa chạy triển khai toàn bộ stack hoặc kiểm thử HTTP/WebSocket/Redis/RabbitMQ từ đầu đến cuối. `POSTGRES_OVERHAUL_AUDIT.json` là báo cáo tĩnh; các trường runtime chưa xác nhận bởi chính script đó vẫn được giữ `null`.
