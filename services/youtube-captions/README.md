# YouTube dictation

Trong admin: **Dictation → Tạo bài → YouTube + phụ đề**. Dán link YouTube,
chọn khoảng thời gian nếu cần, rồi lấy phụ đề. Ưu tiên phụ đề tiếng Anh do tác giả
video cung cấp; nếu không có thì dùng phụ đề tự động. Mỗi bài tối đa 200 đoạn.

Admin có thể nghe từng đoạn, sửa chữ/mốc thời gian, xóa đoạn không cần thiết và lưu
bài nháp. Tiếp tục kiểm tra nội dung và xuất bản bằng luồng kiểm duyệt hiện có.
Video phát trực tiếp qua YouTube IFrame Player API, không tải video/audio về server.
Nếu video không cho nhúng hoặc bị gỡ, trình phát báo lỗi để chọn video khác.

Phụ đề tự động có thể sai. Cần đối chiếu trước khi xuất bản. Khi YouTube không có
phụ đề tiếng Anh hoặc chặn yêu cầu, có thể nhập file SRT/VTT kèm đúng link video.
Mốc thời gian luôn là vị trí trên video gốc. Thời gian hiển thị phụ đề được cắt tại
mốc bắt đầu cue kế tiếp trước khi ghép, tránh các đoạn nghe chồng nhau.
Ưu tiên mốc từng từ từ phụ đề YouTube. Câu có dấu câu được tách theo dấu kết thúc;
phụ đề tự động thiếu dấu câu dùng Ollama local để xác định ranh giới câu, không
cắt ép theo số từ hoặc số giây. Kết quả mô hình chỉ dùng chọn ranh giới: toàn bộ
chữ và thứ tự từ phải khớp nguồn, không dùng chữ do mô hình viết lại.
Nếu nguồn chỉ có mốc theo cue, mốc từng từ trong cue được ước lượng.

Trong trang sửa bài, **Chia lại theo câu** lấy lại phụ đề và đưa kết quả vào bảng
chỉnh sửa; kiểm tra rồi bấm **Lưu segment** để áp dụng. Nên chia lại trước khi
xuất bản vì tiến độ học được gắn theo số thứ tự đoạn.
Khi phát hoặc tua video, phụ đề đang chọn và ô nhập chuyển theo đúng câu tại vị trí
đó. Phần đã gõ được giữ khi chuyển câu trong phiên học. Bấm một phụ đề sẽ phát
đúng câu đó và dừng ở cuối câu. Phát bằng nút YouTube hoặc tua đến câu khác
cũng tự dừng khi hết câu đang nghe, giữ nguyên ô nhập để người học điền.

Dịch vụ này chỉ nằm trong mạng Docker, không mở cổng công khai. API admin kiểm tra
link và chỉ gửi video ID hợp lệ; không tải URL tùy ý. Cấu hình nội bộ:
`YOUTUBE_CAPTIONS_URL=http://youtube-captions:8004`.
Với phụ đề cần khôi phục dấu câu, cấu hình `CAPTION_OLLAMA_URL` (mặc định
`http://ollama:11434`) và `CAPTION_SENTENCE_MODEL` (mặc định `qwen2.5:7b`),
đồng thời tải model vào Ollama. Nếu Ollama chạy trên máy Windows bên ngoài mạng
Compose, dùng `http://host.docker.internal:11434`. Khi không thể xác định ranh giới
an toàn, dịch vụ báo lỗi để thử lại hoặc nhập SRT/VTT có dấu câu.

Nguồn YouTube được lưu trong metadata PostgreSQL của bài học; phụ đề lưu thành
dictation segments. Không cần migration. Chấm điểm tại `POST /dictation/:id/progress/check`:
server chuẩn hóa hoa/thường, dấu câu rồi tính khoảng cách chỉnh sửa theo từ;
điểm là `max(0, 100 × (1 − số thao tác sai/thiếu/thừa / số từ chuẩn))`, làm tròn số nguyên.
Chỉ không còn lỗi mới tính đúng cả câu. Điểm gần nhất và cao nhất được lưu vào tiến độ
từng đoạn. Endpoint cũ gửi boolean không được dùng để chấm bài YouTube.

Kiểm thử parser: `python -m unittest test_captions test_sentence_split -v`.
Kiểm thử API/database: `pnpm --dir apps/api exec vitest run src/modules/dictation/youtube.postgres.spec.ts`.

Ô nhập chỉ cho điền từ hiện tại theo thứ tự. Space sang từ tiếp; Backspace khi
ô trống quay lại từ trước. Những từ chưa đến lượt chỉ hiện dấu `*`.
Menu nhỏ cạnh từ hỗ trợ hiện từng từ, tra từ điển và lưu từ.
Reveal có thể mở đúng một từ ẩn bất kỳ mà không đổi vị trí đang nhập. Look up
mở thẻ nghĩa ở cột bên phải (thẻ nổi trên điện thoại). Save mở hộp chỉnh từ/cụm từ,
IPA, nghĩa và ghi chú; dữ liệu được lưu riêng cho người học trong sổ từ.
Khi nguồn chính chỉ có audio hoặc thiếu một giọng, bổ sung IPA từ mục Pronunciation
trong phần English của Wiktionary, ưu tiên RP/General American và dạng đọc có trọng âm.
Không lấy IPA ở phần ngôn ngữ khác, định nghĩa hoặc dạng đọc yếu làm phiên âm chính.
Nếu IPA của danh từ số nhiều bị thiếu, chỉ suy ra đuôi /s/, /z/, /ɪz/ khi nguồn
liên kết tới dạng gốc và cách viết khớp dạng số nhiều đều. Thẻ ghi rõ dạng gốc;
không dùng audio số ít để đọc từ số nhiều và không suy ra các ngoại lệ đổi phụ âm.
Look up tự tra Free Dictionary API (IPA, loại từ, định nghĩa, audio) và MyMemory
(nghĩa tiếng Việt), không yêu cầu tạo mục từ admin. Ưu tiên dữ liệu cá nhân/đã
xuất bản; dữ liệu từ nguồn ngoài được cache tối đa 1.000 từ trong 24 giờ.
Nếu dịch nghĩa bị giới hạn/tạm lỗi, thẻ báo chưa có nghĩa tiếng Việt. Nguồn và giấy
phép giữ trong metadata; thẻ chỉ hiện loại từ, IPA và nghĩa tiếng Việt đã gộp trùng,
không trộn định nghĩa/ví dụ tiếng Anh hay dòng nguồn vào phần nghĩa. Audio lấy từ bản ghi Wikimedia Commons được nguồn từ điển
tham chiếu hoặc đường dẫn phát âm của dictionaryapi.dev; chỉ cho phép host/path
cố định, giới hạn kích thước, timeout và cache. Trình duyệt nhận audio qua API đã xác thực.
Từ chưa có trong từ điển đã xuất bản được lưu riêng trong sổ từ của người học,
kèm ngữ cảnh bài nghe, không tự tạo hay xuất bản mục từ chung. Có liên kết tra
Cambridge khi chưa có nghĩa. Bản xem trước admin không ghi điểm hoặc lưu từ.

Micro sử dụng Web Speech API của trình duyệt, chỉ bật khi người dùng bấm nút;
nhận dạng tiếng Anh và có xử lý từ chối quyền/không hỗ trợ. Một số trình duyệt
gửi âm thanh tới dịch vụ nhận dạng và cần mạng; đây không phải ASR local.
Gợi ý và nhập giọng nói ghi `hinted` vào tiến độ, không tự hoàn tất câu và không
được tính là đúng ngay lần đầu không hỗ trợ. Điểm kiểm tra vẫn do server tính.

Tham khảo: [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference)
và [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api).
