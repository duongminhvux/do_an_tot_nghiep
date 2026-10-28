# Backend PostgreSQL native — trạng thái hoàn tất

Cập nhật ngày 29/10/2026. Toàn bộ 40 model với 116 vị trí injection còn lại ở commit `7f9045e` đã được chuyển sang truy vấn PostgreSQL native. Đã xóa `apps/api/src/postgres/compat.ts`, các schema decorator cũ và đăng ký `PgModelsModule.forFeature`. Lượt rà soát bổ sung đã chuyển cả hai Python job store sang SQL trực tiếp; kết quả ngày 28/10 trước đây chỉ xác nhận phạm vi NestJS.

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

Audit hiện kiểm tra 341 file TypeScript runtime của NestJS và 30 file Python runtime trong `services`, không dùng danh sách miễn trừ theo service. `$1`, `$2` và `%s` trong SQL là tham số PostgreSQL hợp lệ. Các test kiểm tra việc từ chối giao thức cũ không phải consumer Mongo đang hoạt động. Kết quả này không bao gồm bản đóng gói source, tài liệu lịch sử hay snapshot trong `.tmp`.

## Rà soát bổ sung ngày 29/10/2026

- Loại bỏ các hàm Web không dùng gọi 9 endpoint/method không tồn tại, cùng các hàm quản trị vocabulary không dùng khác. Giữ các API đọc hiện có dành cho người học; API Admin giữ nguyên quyền. Xóa controller `words` public rỗng.
- `services/asr-jobs/pg_store.py` dùng lệnh SQL chuyên biệt cho tạo, đọc theo UUID, kích hoạt, retry, hoàn tất và thất bại. Bộ đếm tăng nguyên tử trong SQL; trạng thái/kết quả hoàn tất không bị retry hoặc lỗi đến muộn ghi đè. Không còn bộ dịch toán tử document hay đọc toàn bảng để lọc bằng Python.
- `services/job-broker/pg_store.py` chỉ đọc một audio job theo UUID, lấy `audio_jobs.state` làm nguồn trạng thái chính thay vì payload cũ. Cả hai store đã bỏ API `find_one`, `insert_one`, `update_one`.
- Hai smoke script chuyển sang owner API hiện tại. `smoke-attempt-resume.mjs` cần hai đối số `ATTEMPT_UUID OWNER_UUID`, đọc đúng một attempt của owner; không tải cả bảng.
- Bộ kiểm tra frontend kiểm tra cả HTTP method và endpoint NestJS. Có regression test xác nhận đúng 9 lời gọi cũ bị từ chối. Bổ sung route `admin/content-quality` còn thiếu ở gateway development.

Kiểm chứng riêng trong lượt này:

| Kiểm tra | Kết quả |
| --- | --- |
| TypeScript toàn API | PASS |
| Contract gateway | 42 route case, 52 prefix controller: PASS |
| Contract client URL và HTTP endpoint | 282 biến thể, 0 không khớp |
| Regression 9 lời gọi Web cũ | PASS; API đọc Admin vẫn khớp |
| Python worker với PostgreSQL 17 tạm | 6 PASS, gồm 20 cập nhật đồng thời trên nhiều kết nối |
| Audit NestJS và Python runtime | 0 vi phạm |
| Cú pháp Python worker và hai smoke script | PASS |

Chưa chạy HTTP smoke trên stack ứng dụng hoặc typecheck toàn Web trong lượt này; môi trường host chưa cài Next.js. Typecheck 9 role là kết quả lượt 28/10. Sau lượt củng cố schema, đã chạy lại toàn bộ Vitest: **247 PASS, 0 FAIL, 52 SKIP** (các suite cần database ngoài được kiểm tra riêng bằng PostgreSQL 17). Các kiểm thử SQL mới chỉ dùng container tạm và không thay đổi database ứng dụng.

## Củng cố schema quan hệ ngày 29/10/2026

- Thêm **14 FK đã validate**: 12 ở Content (vocabulary và dictation), 2 ở Learning (session word → session, saved word → folder của đúng user). FK composite chặn section thuộc bài/topic khác và folder thuộc user khác. Không dùng FK xuyên database owner.
- Chuyển **6 trường business còn thiếu cột trong row contract** ra khỏi `payload`: `attempts.exam_publication_revision`, `attempts.exam_snapshot`, `arenamatches.ranked_state`, `arenamatches.audio_settings`, `activitylogs.description_key`, `activitylogs.description_args`. Backfill giữ dữ liệu và xóa đúng các key đã chuyển; trigger chống snapshot revision cũ, query leaderboard và đọc audio đã dùng cột mới.
- Bộ kiểm tra 41 row contract giờ yêu cầu mọi property gốc có cột SQL, kể cả property optional. JSONB có cấu trúc như snapshot, audio settings, state và metadata vẫn là kiểu cột hợp lệ. `SqlRecords` còn hỗ trợ payload extension; chưa loại bỏ toàn bộ JSONB hay khẳng định chuẩn hóa đầy đủ mọi quan hệ của 8 domain.
- Xóa section/folder theo thứ tự tháo liên kết rồi xóa cha trong giao dịch; FK ngăn thao tác tạo dữ liệu mồ côi. HTTP FK conflict trả 409 với thông điệp an toàn, không đưa tên bảng/key database vào response.
- Kiểm thử PostgreSQL 17 tạm: **9 kiểm tra adoption/FK/backfill/plan PASS**, xác minh schema fingerprint/checksum đủ 8 owner. Migration gặp orphan rollback và giữ dữ liệu cũ; không tự xóa hoặc sửa orphan.
- Bộ tích hợp PostgreSQL 17 mở rộng: **194 PASS**, gồm community, quality, publication, Arena, Learning, cùng kiểm thử lưu đáp án/chấm bài trên nhiều kết nối. SQL/PGlite cho service Content và các domain liên quan tiếp tục PASS.
- Đã chạy `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` cho lookup lesson words và lọc attempt theo revision, mỗi probe có 5.000 dòng fixture; xác nhận dùng index. Plan đầy đủ và thống kê schema thực tế nằm trong `POSTGRES_RELATIONAL_AUDIT.json`. Đây là kiểm chứng hai đường truy vấn bằng fixture, chưa phải benchmark workload production.

Schema mới trên 8 database reference có 138 bảng (gồm hạ tầng/projection lặp theo owner), 66 bảng có cột `payload`, 31 FK tổng cộng và 0 FK chưa validate. Số lượng `CREATE TABLE` hoặc bảng có JSONB tự nó không chứng minh mức chuẩn hóa; vẫn còn các quan hệ local ở Assessment/Arena cần thiết kế tiếp theo chính sách giữ lịch sử/xóa dữ liệu.

Trước triển khai, kiểm tra orphan bằng truy vấn chỉ đọc:

```powershell
node scripts/check-postgres-relations.mjs --all
```

Lệnh báo số lượng và tối đa 10 UUID mẫu mỗi quan hệ lỗi. Nếu có lỗi, sửa dữ liệu có chủ đích rồi chạy lại; migration mới sẽ từ chối orphan thay vì âm thầm xóa chúng. Các migration chưa được áp dụng vào database ứng dụng trong lượt này.

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

Các migration mới nhất cần triển khai sau lượt 29/10:

| Owner | Migration |
| --- | --- |
| Content | `0018_content_relations` |
| Learning | `0018_learning_relations` |
| Assessment | `0018_attempt_exam_snapshot` |
| Arena | `0018_match_state_columns` |
| Notification | `0018_activity_description_columns` |

Migration `assessment/0016_native_attempt_fields.sql` vẫn nằm trong chuỗi và sẽ được chạy nếu chưa áp dụng.

Migration chuyển các trường thường truy vấn của attempt và `group_order` của exam từ JSONB extension sang cột có kiểu, backfill giá trị hiện có và tạo index. Schema contract đã được tạo lại từ database PostgreSQL 17 tạm, khớp migration mới.

Dừng các writer của 5 owner thay đổi, kiểm tra orphan, chạy migration với cấu hình kết nối của môi trường triển khai, rồi khởi động lại bằng bản backend mới. Việc restart cũng làm mới cache ánh xạ cột trong `SqlRecords`:

```powershell
node scripts/migrate.mjs --all
```

Database ứng dụng hiện có chưa được thay đổi trong lượt refactor; các kiểm thử server sử dụng container/database tạm riêng và tự dọn sau khi chạy.

## Kiểm chứng

| Kiểm tra | Kết quả |
| --- | --- |
| TypeScript toàn backend, bao gồm spec | PASS |
| TypeScript cả 9 role | PASS, lượt 28/10 |
| Vitest toàn backend | 247 PASS, 0 FAIL, 52 SKIP khi không cấu hình database ngoài |
| Bộ tích hợp PostgreSQL 17 riêng: publication, mistakes, recommendations, Arena, community, quality và các boundary liên quan | 194 PASS |
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
