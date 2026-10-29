# Kiểm thử và sửa giao diện User/Admin — 29/10/2026

Đã sửa ba nhóm lỗi phát hiện trước đó, build production và cập nhật riêng hai frontend bằng `docker compose up -d --build --no-deps web admin-web`. Backend và gateway được giữ chạy trên Docker.

## Kết quả sau sửa

| Bộ kiểm thử Chrome | PASS | FAIL |
| --- | ---: | ---: |
| Hồi quy lỗi UI, phân trang và menu mobile bằng API giả lập | 22 | 0 |
| Backend thật, phòng 1v1, lời mời và Admin đóng phòng | 25 | 0 |
| Word Guess, Word Chain, Classic và phòng ba người | 12 | 0 |
| Ép lỗi 503 rồi Retry lấy lại dữ liệu backend thật | 11 | 0 |
| Rank: ghép trận, đáp án, mất mạng, đồng bộ, rời trận | 9 | 0 |
| **Tổng** | **79** | **0** |

Hai frontend build production kèm TypeScript đều PASS. Không ghi nhận lỗi JavaScript không được bắt trong các lượt chạy cuối. Kiểm tra desktop 1440×1000, mobile 390×844; có kiểm tra thông báo lỗi và Retry tiếng Việt/Anh trên mobile.

## Những lỗi đã sửa

1. **Lỗi API bị hiển thị thành danh sách rỗng/số liệu 0.** User Dictation và Tiến độ Dictation nay có thông báo lỗi và nút thử lại. Admin dashboard, người dùng, nhóm từ vựng, bộ sưu tập, từ điển, danh sách Dictation và Topic/Section dùng trạng thái lỗi tương ứng. Các truy vấn phụ của nhóm/bộ sưu tập cũng được kiểm tra, tránh hiện danh sách con rỗng khi request lỗi.
2. **Admin chi tiết Dictation quay loading mãi.** Tách `isLoading` khỏi `isError` và trường hợp không có lesson, hiển thị thông báo cùng nút thử lại khi tải thất bại.
3. **Bộ đếm từ vựng rỗng ghi 0–10 trên 0.** Pagination phân biệt `totalItems === 0` với trường hợp không cung cấp tổng; khoảng hiển thị nay là 0–0.

Bốn ca hồi quy từng thất bại đều PASS. 11 ca recovery xác nhận bấm thử lại nhận HTTP 200 từ backend Docker và hết trạng thái lỗi, không cần tải lại toàn trang.

## WebSocket thật đã kiểm tra

- Ba tài khoản QA đăng nhập qua form thật và xác thực Socket.IO qua gateway `/arena`. Các bộ live không giả lập API/sự kiện WebSocket.
- Tạo phòng 1v1 qua UI; người khác vào phòng; host nhận cập nhật thành viên; guest sẵn sàng làm nút bắt đầu của host khả dụng.
- Guest mất mạng: báo kết nối lại, khóa thao tác; nối mạng lại xác thực socket và khôi phục đúng phòng.
- Gửi lời mời tới mobile: từ chối chuyển sự kiện về host; chấp nhận chuyển người nhận tới đúng phòng.
- Admin đóng đúng phòng QA qua dialog nhập lý do; host và guest nhận thông báo, trở về Arena.
- **Word Guess:** đổi cấu hình, bắt đầu và gửi đáp án qua UI; đối thủ nhận cập nhật tiến độ, không thấy lượt đoán riêng; tải lại trang khôi phục lượt đoán.
- **Word Chain:** hai trình duyệt gửi hai từ hợp lệ, chuyển lượt và cập nhật lịch sử cho nhau.
- **Classic:** bắt đầu phòng và nhận câu hỏi ở cả hai trình duyệt.
- **Phòng nhiều người:** ba tài khoản vào phòng, sẵn sàng, cùng vào màn hình Word Guess, gồm mobile.
- **Rank:** tham gia/hủy queue; ghép hai tài khoản QA; vào cùng trận; gửi đáp án, nhận kết quả riêng; mất mạng khóa nhập, server tạm dừng/đồng bộ rồi tiếp tục; rời trận qua dialog khiến đối thủ nhận kết thúc và màn hình chiến thắng.

Các thao tác chính dùng UI. Lời mời và một số thao tác chuẩn bị/dọn dữ liệu dùng ACK trên transport thật do ứng dụng tạo; sự kiện đi qua gateway/service thật. Không kiểm tra chất lượng âm thanh trong lượt này.

## Dữ liệu và dọn môi trường

Trước vòng game chỉ có một từ đã xuất bản, chưa đủ cho Rank/Classic và không có từ năm ký tự cho Word Guess. Bộ kiểm thử tạo bộ từ QA năm ký tự riêng, collection và lesson qua Admin API, liên kết lesson, validate rồi publish qua quy trình thật. Không sửa từ có sẵn.

Sau mỗi lượt, script rời phòng/trận, unpublish và xóa mềm từ/lesson/collection QA, xóa mềm tài khoản QA qua Admin API. Đã kiểm tra trực tiếp:

- Tài khoản QA còn hoạt động: **0**.
- Từ, lesson, collection QA còn khả dụng: **0**.
- Phòng QA mở và trận QA chưa kết thúc: **0**.
- Hàng đợi matchmaking: **0**.

Lịch sử trận QA, bản ghi đã xóa mềm và audit xuất bản được giữ theo cơ chế hệ thống. Không xóa lịch sử hoặc dữ liệu thật để làm sạch báo cáo.

## Bằng chứng và chạy lại

- `UI_QA_AUDIT.json`: kết quả từng ca sau sửa, phạm vi thật/giả lập và sự kiện socket.
- `.tmp/ui-qa/fixed/`, `live/`, `live-games/`, `live-ranked/`, `recovery/`: báo cáo gốc, ảnh Chrome. Một số ảnh chụp cuối bước là màn hình sau khi bước đã dọn phòng; assertion và sự kiện ghi riêng trong báo cáo.
- `tests/ui-browser-smoke.cjs`: hồi quy API giả lập. Đặt `WEB_QA_URL=http://localhost:3000`, `ADMIN_QA_URL=http://localhost:3001`; lọc ca bằng `QA_ONLY`.
- `tests/ui-live-bootstrap.cjs`: chạy trong Identity, chuyển stdout vào file session bị git ignore `.tmp/ui-qa/live-session.json`; không in/commit token. Tạo tài khoản QA qua Admin API, không gửi email. File session đã được xóa sau vòng cuối.
- `tests/ui-live-websocket.cjs`: mặc định kiểm tra phòng/lời mời/Admin; `QA_LIVE_MODE=games` kiểm tra các game; `QA_LIVE_MODE=ranked` kiểm tra Rank. Mỗi lượt cần bootstrap mới vì cuối lượt xóa mềm tài khoản.
- `tests/ui-error-recovery.cjs`: ép lỗi API đọc rồi Retry lấy dữ liệu thật; cần bootstrap trước mỗi lượt.

Script dùng `playwright-core` tại `.tmp/ui-qa/node_modules/` và Chrome trên máy. Các bộ live tạo dữ liệu QA và lịch sử trận theo quy trình thật; chỉ chạy trên môi trường kiểm thử phù hợp.
