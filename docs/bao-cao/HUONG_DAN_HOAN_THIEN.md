# Hướng dẫn hoàn thiện bản báo cáo VocaLearn

Bản báo cáo được viết theo khung `KhungQuyenBaoCao_Version3.docx.pdf` gồm hai trang do bạn cung cấp. Khung được dùng làm yêu cầu bố cục; những mục nói về upload GitHub, slide hoặc video là danh mục bàn giao, không phải các thao tác đã được thực hiện.

## Các tệp

- `BAO_CAO_TOT_NGHIEP_VOCALEARN.docx`: bản Word để chỉnh sửa và nộp sau khi hoàn thiện.
- `BAO_CAO_TOT_NGHIEP_VOCALEARN.md`: nội dung nguồn, thuận tiện tìm/sửa và quản lý phiên bản.
- `tao_ban_word.py`: công cụ chuyển nội dung nguồn thành Word, gồm style, bảng, mục lục và số trang.
- `KIEM_TRA_BAO_CAO.json`: kết quả kiểm tra cấu trúc nội dung và gói Word; không phải kết quả chạy lại ứng dụng.

## Phần đã để trống theo yêu cầu

Tên trường, khoa, ngành, tên đề tài chính thức, sinh viên, MSSV, lớp/khóa, giảng viên, địa điểm/năm trên bìa đều để dòng chấm. Chữ ký và liên kết sản phẩm bàn giao cũng để trống. Không suy ra tên sinh viên từ tài khoản Windows.

Phần nội dung sử dụng tên sản phẩm **VocaLearn** theo mã nguồn. Bạn có thể điền tên đề tài chính thức khác trên bìa mà không cần đổi tên sản phẩm.

## Hình cần vẽ và chụp

Trong Word hoặc Markdown, tìm `[CẦN VẼ` và `[CẦN CHỤP`. Có **23 vị trí sơ đồ** và **9 vị trí ảnh sản phẩm**; một vị trí có thể cần nhiều hình con. Mỗi ghi chú nêu tác nhân, lớp/bảng, mũi tên, trạng thái hoặc màn hình cần thể hiện.

Danh sách nhóm sơ đồ:

1. Hình 1.1–1.4: use case tổng quát và phân rã.
2. Hình 2.1–2.4: tổng quan, chu trình phát triển, kiến trúc owner và outbox/inbox.
3. Hình 3.1–3.4: lớp thực thể phân tích, hoạt động học và trạng thái attempt/Arena.
4. Hình 3.5–3.8: ERD các miền dữ liệu.
5. Hình 3.9: bộ class diagram theo mô-đun; nên tách hình con để dễ đọc.
6. Hình 3.10–3.15: sequence theo mô-đun; các hình có nhiều luồng nên tách a/b/c.
7. Hình B.1–B.9: ảnh giao diện sản phẩm.

Vẽ xong thì thay ghi chú bằng hình và caption, giữ số hiệu hoặc cập nhật đồng bộ danh mục hình. Các đường FK phải theo migration thật; quan hệ logic liên database dùng nét đứt/chú giải. Không biến JSONB snapshot thành một bảng vật lý chỉ để sơ đồ dễ bố trí.

## Định dạng Word

Khung PDF không nêu chi tiết font, cỡ chữ, lề, giãn dòng hoặc độ dài tối thiểu. Bản Word chọn định dạng làm việc: A4; Times New Roman; nội dung cỡ 13, giãn dòng 1,5; lề trái 3,5 cm, phải 2 cm, trên/dưới 2,5 cm; bảng dùng cỡ chữ nhỏ hơn. Đây là lựa chọn biên tập, không phải quy định được trích từ PDF. Nếu khoa có mẫu riêng, chỉnh style và page setup theo mẫu đó.

Mở Word, nhấn **Ctrl+A → F9** và chọn cập nhật toàn bộ mục lục nếu Word hỏi. Mục lục là field để Word tính số trang; các danh mục bảng/hình hiện liệt kê số hiệu và tên, cần thêm/cập nhật số trang sau khi chèn hình và dàn trang. Kiểm tra header/footer, trang trống, bảng bị đẩy trang và các dòng quá dài trước khi xuất PDF. Không coi số trang cache trong metadata DOCX là số trang thực tế.

Nếu chỉnh Markdown rồi xuất lại Word, các sửa trực tiếp trong Word có thể bị ghi đè. Chọn một bản làm nguồn chính hoặc lưu bản Word đã chỉnh với tên khác trước khi tái tạo.

## Số liệu và nguồn tham khảo

- Ngày biên soạn/đối chiếu mã nguồn: **07/11/2026**.
- Số liệu UI/WebSocket: chiến dịch **29/10/2026**, tổng 79 ca; 22 ca fixture được phân biệt với các bộ dùng backend/socket thật.
- Số liệu backend: 247 PASS/52 SKIP và 194 PASS thuộc các lượt/bộ có thể chồng lặp; báo cáo không cộng chúng thành tổng test độc lập.
- Schema reference: 138 bảng, 66 bảng có payload, 31 FK; không phải số liệu đếm trực tiếp database đang chạy lúc viết báo cáo.
- Không chạy lại stack, không tạo người dùng/nội dung, không thay đổi database để viết báo cáo này.
- Các số liệu đối chiếu nằm trong tài liệu audit của dự án; phần thực nghiệm đã nêu giới hạn và thời điểm. Trước bảo vệ nên chạy lại các bộ cần dùng trên môi trường QA, lưu commit, log và ảnh gốc.

Tài liệu tham khảo bên ngoài đã được tra cứu từ bài nghiên cứu hoặc tài liệu chính thức; chúng làm cơ sở phương pháp. Các chức năng và công thức riêng của VocaLearn được đối chiếu source, không gán kết quả của tài liệu bên ngoài thành kết quả thực nghiệm của đề tài.

## Những nhận định cần giữ đúng

- SRS hiện là bộ quy tắc riêng; không gọi là bản hiện thực chuẩn SM-2/FSRS.
- Gợi ý học dựa trên luật; không viết thành mô hình AI cá nhân hóa đã huấn luyện.
- Điểm TOEIC là ước lượng; không viết thành điểm ETS chính thức hoặc chứng chỉ.
- ASR hỗ trợ biên soạn transcript; không mặc định là chức năng chấm phát âm.
- Có JSONB hợp lệ và một số quan hệ chưa chuẩn hóa hoàn toàn; không viết “xóa toàn bộ JSONB”.
- Thư viện media là cây duyệt tham chiếu theo loại, không phải cây thư mục vật lý hoặc trình quét toàn bucket.
- Chưa có benchmark tải, đánh giá ASR/TTS đại diện hay nghiên cứu hiệu quả học trước–sau; không tự bổ sung số liệu tăng điểm, tốc độ hoặc số người đồng thời.

## Trước khi nộp

Điền bìa; đọc lại lời cảm ơn theo trải nghiệm thực; vẽ/chèn đủ hình; kiểm tra tên người và thuật ngữ; cập nhật mục lục; đối chiếu bản build sẽ trình diễn; bổ sung repository, bản build, slide, video và file UML có thật. Các README PostgreSQL V8 còn nội dung lịch sử nên không dùng thay contract hiện tại nếu mâu thuẫn source/migration mới hơn.

Đọc lại toàn bộ báo cáo để bảo đảm bạn hiểu và có thể giải thích thiết kế, quy tắc tính toán và giới hạn kết quả khi bảo vệ.
