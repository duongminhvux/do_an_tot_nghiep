# BÁO CÁO PHÂN TÍCH & KẾT NỐI DỮ LIỆU THỰC TẾ TRANG CHI TIẾT NGƯỜI DÙNG

> **Ngày cập nhật:** 30/09/2026  
> **Trạng thái:** Backend API & Frontend đã kết nối **100% dữ liệu thực tế** từ MongoDB (đã loại bỏ toàn bộ mock data).

---

## 1. TỔNG QUAN HIỆN TRẠNG HỆ THỐNG

Trang chi tiết người dùng (`/users/[id]`) trong hệ thống Quản trị (`apps/admin-web`) đã được nâng cấp toàn diện:
- **API Server (`apps/api`)**: Endpoint `GET /admin/users/:id` và `PATCH /admin/users/:id/notes`.
- **Dữ liệu thực tế**: Truy vấn trực tiếp từ 5 collections MongoDB:
  1. `users` (Thông tin tài khoản, avatar, trạng thái, ngày tạo, ghi chú quản trị).
  2. `userlessonwords` (Tổng số từ vựng đã học).
  3. `userlessonprogresses` (Tiến độ bài học/khóa học, trạng thái COMPLETED/IN_PROGRESS).
  4. `learningsessions` (Các phiên học để tính tổng thời lượng học tập).
  5. `userwordreviews` (Nhật ký ôn tập từ vựng, số lần trả lời đúng/sai để tính tỷ lệ chính xác).

---

## 2. CHI TIẾT CÁC TRƯỜNG DỮ LIỆU ĐÃ HIỂN THỊ THỰC TẾ

| Khu vực trên giao diện | Trường hiển thị | Nguồn dữ liệu trong Database | Tình trạng hiện tại |
| :--- | :--- | :--- | :--- |
| **Header Profile** | Avatar | `users.avatarUrl` | Đã hỗ trợ Google Avatar (`referrerPolicy="no-referrer"`) + fallback chữ cái đầu. |
| | Tên người dùng | `users.name` | Dữ liệu thật từ DB. |
| | Email | `users.email` | Dữ liệu thật từ DB (có nút Copy email). |
| | Trạng thái tài khoản | `users.status` | `active` (Hoạt động) hoặc `banned` (Bị khóa). |
| | Ngày đăng ký | `users.createdAt` | Định dạng chuẩn giờ Việt Nam (UTC+7). |
| **4 Thẻ Thống kê (Metric Cards)** | **Từ đã học** | `userlessonwords.countDocuments({ userId })` | Đếm số bản ghi từ vựng thực tế của user. |
| | **Khóa học/Bài học hoàn thành** | `userlessonprogresses.countDocuments({ userId, status: 'COMPLETED' })` | Đếm số bài học user đã hoàn thành 100%. |
| | **Thời gian học** | Tổng `endedAt - startedAt` từ `learningsessions` | Tính tổng số phút/giờ học thực tế từ các session. |
| | **Streak hiện tại** | Dựa trên ngày hoạt động gần nhất từ `learningsessions` & `userlessonprogresses` | Tính số ngày học liên tiếp thực tế. |
| **Tab 1: Tổng quan** | Thông tin cá nhân | `users` (`bio`, `phone`, `lastActive`, `role`) | Dữ liệu thực tế từ collection `users`. |
| | Ghi chú quản trị (Notes) | `users.notes` | Đã có API `PATCH /admin/users/:id/notes`, lưu và hiển thị trực tiếp. |
| | Biểu đồ tiến độ (Donut) | Tính từ trung bình tiến độ các bài học trong `userlessonprogresses` | Nếu chưa học bài nào sẽ hiển thị 0% và trạng thái chưa hoàn thành bài nào. |
| | Danh sách tiến độ bài học | Truy vấn `userlessonprogresses` kết hợp populate `Lesson` | Có giao diện Empty State nếu user chưa học bài nào. |
| | Hoạt động gần đây | Tổng hợp từ các sự kiện: tạo tài khoản, đăng nhập cuối, học bài, ôn tập từ | Sắp xếp giảm dần theo thời gian, có Empty State nếu chưa có hoạt động. |
| **Tab 2: Lịch sử hoạt động** | Timeline nhật ký | Tổng hợp chuỗi sự kiện thực tế từ DB | Chuyển đổi toàn bộ mốc thời gian sang giờ Việt Nam (UTC+7). |
| **Tab 3: Tiến độ học tập chi tiết** | Tỷ lệ trả lời chính xác | `correctCount / (correctCount + incorrectCount)` từ `userwordreviews` | Tính tỷ lệ phần trăm chính xác thực tế từ các lần ôn tập flashcard. |
| | Điểm số trung bình | Quy đổi thang điểm 10 từ tỷ lệ chính xác | Thang điểm 10 thực tế, tự động phân loại Đạt / Xuất sắc. |
| | Tổng thời gian học | Lấy từ `learningsessions` | Hiển thị cả số giờ và quy đổi ra số phút. |
| | Danh sách bài học/khóa học | Lấy từ `userlessonprogresses` | Hiển thị thẻ từng bài học và thanh tiến độ thực tế. |
| **Tab 4: Khác & Quản trị** | Phương thức đăng nhập, xác thực email, ngày tạo, lần truy cập cuối | `users.personalDetail`, `users.createdAt`, `users.lastActive` | Đầy đủ dữ liệu thật. |
| | Khóa / Mở khóa tài khoản | `PATCH /admin/users/:id/status` | Tích hợp Modal xác nhận và cập nhật trạng thái tức thì. |
| | Xóa vĩnh viễn tài khoản | `DELETE /admin/users/:id` | Tích hợp Modal cảnh báo và xóa user khỏi DB. |

---

## 3. CÁC VIỆC CẦN LÀM ĐỂ TOÀN BỘ CHỨC NĂNG CÓ DỮ LIỆU ĐẦY ĐỦ (ACTION PLAN)

Hiện tại, hệ thống Admin Web đã có đầy đủ logic hiển thị và API kết nối dữ liệu. **Tuy nhiên**, đối với người dùng mới đăng ký hoặc chưa tương tác nhiều trên ứng dụng học tập (Mobile App / Web App học viên), một số chỉ số sẽ hiển thị là `0` hoặc danh sách trống vì ứng dụng học viên chưa ghi nhận các hành vi này vào cơ sở dữ liệu.

Dưới đây là các đầu việc cần làm phía **Client học tập (Mobile/Web)** và **Hệ thống Backend học tập**:

### 1. Ghi nhận phiên học tập (`LearningSession`)
- **Mục đích**: Cung cấp dữ liệu cho `Thời gian học` và tính toán `Streak`.
- **Cần làm**:
  - Khi người dùng bắt đầu vào màn hình học từ vựng trên Mobile/Web học viên: Gửi request tạo phiên học `POST /learning/sessions/start` lưu `startedAt`.
  - Khi người dùng hoàn thành hoặc thoát bài học: Gửi request `POST /learning/sessions/end` cập nhật `endedAt`, `totalWords`, `completedWords`.

### 2. Cập nhật tiến độ bài học (`UserLessonProgress`)
- **Mục đích**: Cung cấp dữ liệu cho `Khóa học/Bài học hoàn thành`, biểu đồ tròn Donut và danh sách khóa học trong Tab Tiến độ.
- **Cần làm**:
  - Khi người dùng học các từ trong bài học: Cập nhật `progress` (%) và `completedItems` / `totalItems`.
  - Khi học xong 100% các từ trong bài: Đặt `status = 'COMPLETED'`, `completedAt = new Date()`.

### 3. Ghi nhận kết quả ôn tập từ vựng SRS (`UserWordReview`)
- **Mục đích**: Cung cấp dữ liệu cho `Từ đã học`, `Tỷ lệ trả lời chính xác`, `Điểm số trung bình` và danh sách hoạt động.
- **Cần làm**:
  - Khi người dùng lật thẻ flashcard hoặc làm bài tập kiểm tra từ vựng: Cập nhật bản ghi ôn tập từ vựng tương ứng (tăng `correctCount` nếu trả lời đúng, hoặc tăng `incorrectCount` nếu trả lời sai).

### 4. Ghi nhận lần đăng nhập cuối (`lastActive`)
- **Mục đích**: Hiển thị chính xác thời gian truy cập gần nhất của người dùng.
- **Cần làm**:
  - Trong middleware xác thực JWT của API hoặc API đăng nhập / làm mới token: Cập nhật `users.lastActive = new Date()`.

### 5. (Mở rộng tùy chọn) Bảng điểm Quiz / Bài kiểm tra riêng biệt
- **Hiện tại**: Điểm trung bình và độ chính xác đang được tính toán thông minh dựa trên kết quả ôn tập từ vựng (`UserWordReview`).
- **Nâng cấp sau này (nếu có)**: Nếu dự án có thêm tính năng làm bài thi trắc nghiệm (Exams/Quizzes), có thể tạo thêm collection `quizsubmissions` để lưu điểm từng bài thi (VD: 8.5/10, 9.0/10) và hiển thị thêm lịch sử làm bài thi vào Tab 3.

---

## 4. TỔNG KẾT & LƯU Ý VỀ COLLECTION & LESSON
- **Cấu trúc Dữ liệu Bộ từ vựng (Collection)**: Một Collection gồm nhiều bài học (Lessons). Ví dụ: Collection **Destination B1** chứa bài học **Unit 3 - Fun and Games**.
- **Hiển thị thông minh**: Hệ thống tự động liên kết `UserLessonProgress` ➔ `Lesson` ➔ `Collection` để hiển thị đầy đủ cả tên bộ sưu tập lẫn bài học (VD: `Destination B1 - Unit 3 - Fun and Games (18%)`).
- **Phân biệt Đang học và Hoàn thành**: Thẻ chỉ số hiển thị cả số bài học tham gia và trạng thái (VD: `0 hoàn thành, 1 đang học`), tránh gây nhầm lẫn khi người dùng đang học dở dang chưa đạt 100%.
- Toàn bộ code mock data (ví dụ Destination B2, Oxford 3000 hardcode, thời gian giả lập) đã được loại bỏ hoàn toàn.
- Nếu người dùng có dữ liệu học tập trong DB, trang sẽ tự động hiển thị đầy đủ, chính xác.
- Nếu người dùng là tài khoản mới, trang hiển thị trạng thái ban đầu sạch đẹp (0 bài học, 0 từ, Empty State thân thiện) thay vì crash hoặc hiện thông tin ảo.
- Tính năng ghi chú của Admin đã có thể lưu trực tiếp vào database MongoDB.
- Mọi mốc thời gian hiển thị chuẩn múi giờ Việt Nam (UTC+7 / `Asia/Ho_Chi_Minh`).
