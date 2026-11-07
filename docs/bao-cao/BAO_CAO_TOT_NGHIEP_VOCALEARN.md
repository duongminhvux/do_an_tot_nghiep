# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP

Trường: ..............................................................................................

Khoa/Viện: ..........................................................................................

Ngành/Chuyên ngành: ............................................................................

Tên đề tài: ...........................................................................................

............................................................................................................

Sinh viên thực hiện: ...............................................................................

Mã số sinh viên: .....................................................................................

Lớp/Khóa: .............................................................................................

Giảng viên hướng dẫn: ...........................................................................

Địa điểm, năm: ......................................................................................

<!-- PAGEBREAK -->

# LỜI CẢM ƠN

Em xin gửi lời cảm ơn đến quý thầy cô đã giảng dạy, truyền đạt kiến thức chuyên môn và phương pháp nghiên cứu trong suốt quá trình học tập. Những kiến thức về phân tích thiết kế hệ thống, cơ sở dữ liệu, lập trình web và kiểm thử phần mềm là nền tảng để em thực hiện đồ án này.

Em xin cảm ơn giảng viên hướng dẫn đã góp ý về hướng triển khai, nội dung nghiên cứu và cách trình bày kết quả. Các ý kiến hướng dẫn giúp em từng bước hoàn thiện hệ thống, nhận diện những điểm còn hạn chế và trình bày sản phẩm một cách có căn cứ.

Em cũng xin cảm ơn gia đình, bạn bè và những người đã hỗ trợ, động viên trong quá trình thực hiện đồ án. Do kinh nghiệm và thời gian thực hiện còn hạn chế, báo cáo khó tránh khỏi thiếu sót. Em mong nhận được góp ý của quý thầy cô để tiếp tục hoàn thiện kiến thức và sản phẩm.

Sinh viên thực hiện

........................................................................

<!-- PAGEBREAK -->

# MỤC LỤC

LỜI CẢM ƠN

DANH MỤC CÁC KÝ HIỆU VÀ CHỮ VIẾT TẮT

DANH MỤC CÁC BẢNG

DANH MỤC CÁC HÌNH VẼ

ĐẶT VẤN ĐỀ

CHƯƠNG 1. TỔNG QUAN BÀI TOÁN VÀ XÁC ĐỊNH YÊU CẦU

1.1. Xác định yêu cầu hệ thống

1.2. Khảo sát các nghiên cứu và giải pháp liên quan

CHƯƠNG 2. PHƯƠNG PHÁP TIẾP CẬN VÀ GIẢI PHÁP XÂY DỰNG HỆ THỐNG

2.1. Mô hình tổng quát hệ thống

2.2. Phương pháp xây dựng phần mềm

2.3. Mô hình phát triển phần mềm

2.4. Kiến trúc phần mềm

2.5. Lựa chọn công nghệ

2.6. Các phương pháp xử lý nghiệp vụ

CHƯƠNG 3. PHÂN TÍCH, THIẾT KẾ VÀ THỰC NGHIỆM HỆ THỐNG

3.1. Phân tích hệ thống

3.2. Thiết kế hệ thống

3.3. Kiểm thử và thực nghiệm

KẾT LUẬN VÀ KIẾN NGHỊ

TÀI LIỆU THAM KHẢO

PHỤ LỤC A. CÀI ĐẶT VÀ TRIỂN KHAI

PHỤ LỤC B. HÌNH ẢNH SẢN PHẨM

PHỤ LỤC C. ĐỐI CHIẾU NỘI DUNG VỚI MÃ NGUỒN

<!-- PAGEBREAK -->

# DANH MỤC CÁC KÝ HIỆU VÀ CHỮ VIẾT TẮT

| Ký hiệu | Tên đầy đủ | Ý nghĩa trong báo cáo |
| --- | --- | --- |
| ACK | Acknowledgement | Xác nhận đã nhận/xử lý thông điệp hoặc thao tác |
| AI | Artificial Intelligence | Trí tuệ nhân tạo; được tích hợp qua các dịch vụ hỗ trợ nội dung |
| API | Application Programming Interface | Giao diện giao tiếp giữa các thành phần phần mềm |
| ASR | Automatic Speech Recognition | Nhận dạng tiếng nói thành văn bản |
| CSDL | Cơ sở dữ liệu | Thành phần lưu trữ dữ liệu có tổ chức |
| DTO | Data Transfer Object | Đối tượng đầu vào/đầu ra có cấu trúc |
| ERD | Entity–Relationship Diagram | Sơ đồ thực thể và quan hệ |
| FK | Foreign Key | Khóa ngoại |
| HTTP | Hypertext Transfer Protocol | Giao thức trao đổi request/response |
| JSONB | Binary JSON | Kiểu dữ liệu JSON được PostgreSQL hỗ trợ lưu trữ và truy vấn |
| JWT | JSON Web Token | Token sử dụng trong xác thực |
| OAuth | Open Authorization | Cơ chế ủy quyền được dùng trong đăng nhập Google |
| PK | Primary Key | Khóa chính |
| QA | Quality Assurance | Hoạt động bảo đảm chất lượng; ở đây gồm dữ liệu và tài khoản kiểm thử |
| REST | Representational State Transfer | Phong cách thiết kế API dựa trên tài nguyên |
| S3 | Simple Storage Service API | Giao diện lưu trữ đối tượng được SeaweedFS hỗ trợ tương thích |
| SQL | Structured Query Language | Ngôn ngữ truy vấn cơ sở dữ liệu quan hệ |
| SRS | Spaced Repetition System | Cơ chế ôn tập giãn cách |
| TOEIC | Test of English for International Communication | Dạng bài luyện tập nghe và đọc được hệ thống hỗ trợ |
| TTS | Text-to-Speech | Tổng hợp tiếng nói từ văn bản |
| UI | User Interface | Giao diện người dùng |
| UML | Unified Modeling Language | Ngôn ngữ mô hình hóa thống nhất |
| UUID | Universally Unique Identifier | Định danh được sử dụng cho bản ghi |
| XP | Experience Points | Điểm kinh nghiệm học tập trong hệ thống |

<!-- PAGEBREAK -->

# DANH MỤC CÁC BẢNG

| Số hiệu | Tên bảng |
| --- | --- |
| 1.1 | Thuật ngữ nghiệp vụ |
| 1.2 | Tác nhân và phạm vi thao tác |
| 1.3 | Yêu cầu chức năng |
| 1.4 | Yêu cầu phi chức năng và cách đánh giá |
| 1.5 | Đối tượng nghiệp vụ và thuộc tính chính |
| 1.6 | Quan hệ giữa các đối tượng nghiệp vụ |
| 1.7 | Đối chiếu giải pháp liên quan và định hướng của đề tài |
| 2.1 | Phân chia dịch vụ và quyền sở hữu dữ liệu |
| 2.2 | Công nghệ và vai trò sử dụng |
| 2.3 | Quy tắc cập nhật lịch ôn từ vựng |
| 3.1 | Danh sách ca sử dụng được phân tích |
| 3.2 | Các bảng dữ liệu tiêu biểu theo miền |
| 3.3 | Thiết kế tương tác các màn hình người học |
| 3.4 | Thiết kế tương tác các màn hình quản trị |
| 3.5 | Trách nhiệm các lớp và thành phần xử lý |
| 3.6 | Thiết kế luồng tuần tự theo mô-đun |
| 3.7 | Ma trận kiểm thử và điều kiện đạt |
| 3.8 | Kết quả kiểm chứng PostgreSQL đã được lưu trong dự án |
| 3.9 | Kết quả kiểm thử giao diện và WebSocket ngày 29/10/2026 |
| 3.10 | Giới hạn của thực nghiệm và công việc bổ sung |
| A.1 | Địa chỉ truy cập trong môi trường phát triển |
| C.1 | Đối chiếu nội dung báo cáo với mã nguồn và bằng chứng |

<!-- PAGEBREAK -->

# DANH MỤC CÁC HÌNH VẼ

Các hình dưới đây được đặt chỗ bằng ghi chú văn bản tại vị trí sử dụng. Sau khi vẽ hoặc chụp giao diện, thay ghi chú bằng hình tương ứng và cập nhật số trang trong Word.

| Số hiệu | Tên hình |
| --- | --- |
| 1.1 | Use case tổng quát của hệ thống VocaLearn |
| 1.2 | Phân rã use case học từ vựng và ôn tập |
| 1.3 | Phân rã use case Dictation và luyện TOEIC |
| 1.4 | Phân rã use case Arena và quản trị |
| 2.1 | Mô hình tổng quát hệ thống |
| 2.2 | Chu trình phát triển lặp và tăng trưởng |
| 2.3 | Kiến trúc dịch vụ và quyền sở hữu database |
| 2.4 | Luồng ghi dữ liệu và truyền sự kiện qua outbox/inbox |
| 3.1 | Mô hình lớp thực thể nghiệp vụ |
| 3.2 | Biểu đồ hoạt động học từ vựng và cập nhật lịch ôn |
| 3.3 | Biểu đồ trạng thái bài làm TOEIC |
| 3.4 | Biểu đồ trạng thái trận Arena |
| 3.5 | ERD miền Content |
| 3.6 | ERD miền Assessment |
| 3.7 | ERD miền Learning |
| 3.8 | ERD miền Arena và quan hệ tham chiếu giữa các dịch vụ |
| 3.9 | Biểu đồ lớp thiết kế theo mô-đun |
| 3.10 | Biểu đồ tuần tự xác thực và làm mới token |
| 3.11 | Biểu đồ tuần tự học từ vựng và ôn tập |
| 3.12 | Biểu đồ tuần tự xử lý và luyện Dictation |
| 3.13 | Biểu đồ tuần tự lưu đáp án và nộp bài TOEIC |
| 3.14 | Biểu đồ tuần tự Arena và khôi phục kết nối |
| 3.15 | Biểu đồ tuần tự xuất bản, media và nhập PDF |
| B.1 | Màn hình đăng nhập và trang chủ người học |
| B.2 | Màn hình học từ vựng, ôn tập và sổ lỗi |
| B.3 | Màn hình Dictation và tiến độ luyện nghe |
| B.4 | Màn hình làm bài TOEIC và xem kết quả |
| B.5 | Màn hình phòng Arena và trận đấu |
| B.6 | Dashboard quản trị và danh sách có phân trang |
| B.7 | Màn hình biên tập và xuất bản nội dung |
| B.8 | Màn hình quản lý media theo cây thư mục |
| B.9 | Màn hình mobile và trạng thái lỗi có thử lại |

<!-- PAGEBREAK -->

# ĐẶT VẤN ĐỀ

## Lý do lựa chọn đề tài

Quá trình tự học tiếng Anh thường gồm nhiều hoạt động có mối liên hệ với nhau: tiếp cận từ mới, nghe cách phát âm, ghi nhớ nghĩa, luyện nhận diện trong ngữ cảnh và tự đánh giá qua bài tập. Khi các hoạt động này được thực hiện bằng những công cụ riêng biệt, người học phải tự tổng hợp lịch ôn và kết quả của mình. Trong phạm vi bài toán của đề tài, sự phân tán đó đặt ra nhu cầu xây dựng một môi trường học tập có thể kết nối nội dung, tiến độ và lịch sử hoạt động.

Một khó khăn khác là việc duy trì nhịp học. Danh sách từ vựng hoặc đề luyện tập chỉ cung cấp tài nguyên; hệ thống còn cần giúp người học biết nội dung nào nên ôn lại, hoạt động nào đã hoàn thành và những lỗi nào còn lặp lại. Vì vậy, sản phẩm kết hợp học từ vựng, luyện nghe chép chính tả, làm bài TOEIC, sổ lỗi và một số hình thức trò chơi. Các chức năng này chia sẻ định danh người học nhưng có đặc điểm dữ liệu và tương tác khác nhau.

Ở phía quản trị, học liệu không chỉ là văn bản. Một bài học có thể tham chiếu ảnh, âm thanh phát âm, audio toàn bài và audio theo câu. Một đề luyện tập có nhiều câu hỏi, nhóm đoạn đọc và nội dung nghe. Nếu thiếu công cụ biên tập, kiểm tra chất lượng và quản lý media, người quản trị khó theo dõi tài nguyên nào đang được sử dụng. Đề tài do đó xem quản trị nội dung là một phần của hệ thống, đồng thời phân biệt quyền quản trị với quyền học tập.

VocaLearn là sản phẩm được xây dựng để giải quyết bài toán trên. Hệ thống có hai ứng dụng web dành cho người học và quản trị viên; backend tổ chức thành các dịch vụ theo miền nghiệp vụ, sử dụng PostgreSQL, giao tiếp HTTP và sự kiện, đồng thời tích hợp các tác vụ xử lý âm thanh. Báo cáo tập trung trình bày cách phân tích, thiết kế, hiện thực và kiểm chứng sản phẩm này.

## Mục tiêu nghiên cứu và xây dựng

Mục tiêu tổng quát là xây dựng một hệ thống web hỗ trợ tự học tiếng Anh, cho phép người học luyện tập theo nhiều hình thức, lưu tiến độ và nhận phản hồi; đồng thời cung cấp môi trường quản trị học liệu có phân quyền.

Các mục tiêu cụ thể gồm: tổ chức kho từ vựng dùng chung; xây dựng luồng học và ôn giãn cách; triển khai Dictation theo từng đoạn; lưu và chấm bài luyện TOEIC; hỗ trợ trò chơi và Arena thời gian thực; tổng hợp hoạt động học tập; xây dựng trang quản trị nội dung, xuất bản và media; chuyển lớp lưu trữ sang truy vấn PostgreSQL trực tiếp; thiết lập cấu hình triển khai và kiểm thử phù hợp với sản phẩm.

## Đối tượng và phạm vi

Đối tượng nghiên cứu là quy trình học và quản lý học liệu tiếng Anh trên môi trường web, cùng các phương pháp tổ chức dữ liệu, xử lý giao dịch, giao tiếp thời gian thực và tích hợp xử lý âm thanh phục vụ các quy trình đó.

Phạm vi sản phẩm gồm giao diện tiếng Việt/tiếng Anh, tài khoản người học và quản trị, từ vựng, Dictation, bài luyện TOEIC nghe–đọc, Arena, minigame, tiến độ, sổ lỗi, gợi ý dựa trên luật, quản trị học liệu, media và công cụ hỗ trợ nhập nội dung. Các thành phần AI sử dụng mô hình có sẵn để hỗ trợ tác vụ; đề tài không huấn luyện một mô hình ngôn ngữ hoặc nhận dạng tiếng nói mới.

Hệ thống không được trình bày như một đơn vị tổ chức thi hoặc cấp chứng chỉ TOEIC. Điểm quy đổi trong sản phẩm là điểm tham khảo theo bảng ước lượng được khai báo trong mã nguồn. Báo cáo cũng không kết luận về mức tăng trình độ tiếng Anh của người học vì chưa có nghiên cứu can thiệp với nhóm đối chứng và dữ liệu đánh giá trước–sau.

## Phương pháp thực hiện và cơ sở số liệu

Đề tài sử dụng phân tích hướng đối tượng để xác định tác nhân, ca sử dụng, lớp thực thể và luồng tương tác; chia hệ thống theo miền nghiệp vụ; triển khai theo các vòng lặp chức năng; và kiểm chứng bằng kiểm thử đơn vị, tích hợp PostgreSQL, kiểm tra contract API và kiểm thử trình duyệt.

Nội dung hiện thực trong báo cáo được đối chiếu với mã nguồn tại thời điểm biên soạn ngày 07/11/2026. Số liệu kết quả kiểm thử được trích từ các báo cáo lưu trong repository, chủ yếu ngày 29/10/2026; chúng là kết quả lịch sử có phạm vi xác định, không phải một lần chạy lại toàn bộ hệ thống vào ngày biên soạn. Các yêu cầu chưa có phép đo tương ứng được trình bày là tiêu chí hoặc hướng kiểm chứng tiếp theo.

## Bố cục báo cáo

Chương 1 xác định bài toán, yêu cầu, mô hình nghiệp vụ và các nghiên cứu liên quan. Chương 2 trình bày phương pháp xây dựng, kiến trúc và giải pháp kỹ thuật. Chương 3 phân tích các kịch bản, thiết kế dữ liệu và tương tác, sau đó tổng hợp kết quả kiểm thử cùng giới hạn thực nghiệm. Phần cuối nêu kết luận, kiến nghị, tài liệu tham khảo và phụ lục triển khai.

<!-- PAGEBREAK -->

# CHƯƠNG 1. TỔNG QUAN BÀI TOÁN VÀ XÁC ĐỊNH YÊU CẦU

## 1.1. Xác định yêu cầu hệ thống

### 1.1.1. Miền bài toán và thuật ngữ

Miền bài toán là hỗ trợ tự học tiếng Anh và quản trị học liệu số. Người học sử dụng nội dung đã được phép công bố, thực hiện bài tập và xem kết quả cá nhân. Quản trị viên tạo, tổ chức, kiểm tra và xuất bản nội dung. Các tác vụ tổng hợp/nhận dạng âm thanh hoặc nhập tài liệu được tách thành xử lý nền để tránh kéo dài các request tương tác thông thường.

Bảng 1.1. Thuật ngữ nghiệp vụ

| Thuật ngữ | Định nghĩa sử dụng trong hệ thống |
| --- | --- |
| Người học | Tài khoản sử dụng chức năng học, luyện tập và xem tiến độ của chính mình |
| Quản trị viên | Tài khoản có quyền quản lý người dùng, học liệu, cấu hình và hoạt động hệ thống |
| Nhóm từ vựng | Cấp tổ chức các bộ sưu tập để người học tìm nội dung theo chủ đề |
| Bộ sưu tập | Tập hợp các bài học từ vựng có chủ đề hoặc mục tiêu liên quan |
| Bài học từ vựng | Đơn vị học gồm các từ được liên kết từ kho từ dùng chung |
| Từ điển dùng chung | Kho từ chứa nghĩa, từ loại, ví dụ, phát âm và tài nguyên media |
| Phiên học | Một lượt học có trạng thái và các thao tác trên từng từ |
| Lượt ôn | Hoạt động đánh giá mức ghi nhớ từ để cập nhật lịch ôn tiếp theo |
| Topic/Section Dictation | Hai cấp tổ chức nội dung Dictation trước khi tới bài và câu |
| Segment | Đoạn/câu trong bài Dictation, có văn bản và thông tin phát audio |
| Attempt | Một lượt làm bài luyện TOEIC của một người học |
| Snapshot | Bản chụp dữ liệu cần thiết tại một thời điểm để giữ tính ổn định của lịch sử |
| Publication revision | Số phiên bản công bố của tài nguyên học tập |
| Arena | Không gian thi đấu từ vựng thời gian thực giữa các người học |
| Rank | Chế độ ghép trận có cập nhật điểm xếp hạng |
| Friend room | Phòng chơi cùng người khác, hỗ trợ các chế độ trò chơi đã cấu hình |
| Sổ lỗi | Danh sách nội dung từng trả lời sai và trạng thái ôn lại |
| Media | Tệp ảnh hoặc âm thanh được các đối tượng học liệu tham chiếu |
| Job | Công việc xử lý nền có định danh, trạng thái và kết quả |
| Outbox/Inbox | Bản ghi gửi/nhận sự kiện để phối hợp xử lý bền vững giữa các dịch vụ |

### 1.1.2. Mục tiêu nghiệp vụ

Mục tiêu thứ nhất là tạo được hành trình học có thể tiếp tục giữa nhiều lần truy cập. Các hành động như học một từ, hoàn thành câu Dictation hoặc lưu đáp án TOEIC phải gắn với tài khoản và tài nguyên cụ thể. Khi mở lại trang, người học cần thấy dữ liệu đã lưu theo chính sách của chức năng.

Mục tiêu thứ hai là cung cấp phản hồi đủ rõ để người học chọn hoạt động tiếp theo. Lịch ôn phản ánh mức tự đánh giá ghi nhớ; sổ lỗi phản ánh sai sót đã ghi nhận; dashboard phản ánh hoạt động và XP. Gợi ý học chỉ được diễn giải dựa trên dữ liệu thực có, tránh kết luận yếu điểm khi chưa đủ mẫu.

Mục tiêu thứ ba là kiểm soát vòng đời nội dung. Nội dung nháp, nội dung đang xử lý và nội dung đã xuất bản có các vai trò khác nhau. Người quản trị cần kiểm tra dữ liệu và media trước khi công bố. Việc sửa học liệu không được làm thay đổi tùy ý kết quả của lượt làm bài đã tạo từ phiên bản trước.

Mục tiêu thứ tư là bảo đảm nhất quán dữ liệu trong các tình huống thực tế: hai thao tác cùng lưu đáp án, request bị lặp, worker thực hiện lại công việc hoặc người chơi mất kết nối. Giải pháp cần kiểm soát các tình huống này ở backend và cơ sở dữ liệu, thay vì chỉ dựa vào khóa nút trên giao diện.

### 1.1.3. Tác nhân và phạm vi chức năng

Bảng 1.2. Tác nhân và phạm vi thao tác

| Tác nhân | Chức năng trong phạm vi | Giới hạn |
| --- | --- | --- |
| Khách truy cập | Xem trang giới thiệu, đăng ký, đăng nhập, khởi tạo khôi phục mật khẩu | Không đọc tiến độ riêng hoặc sửa học liệu |
| Người học | Học/ôn từ, lưu từ vào thư mục, luyện Dictation, làm TOEIC, chơi game, tham gia Arena, xem tiến độ và sổ lỗi | Chỉ sửa dữ liệu cá nhân trong phạm vi được cấp; không gọi thao tác quản trị |
| Quản trị viên | Quản lý người dùng; từ vựng, bài học, đề; chất lượng và xuất bản; cấu hình; media; giám sát Arena | Thao tác cần kiểm tra quyền tại API, không chỉ ẩn nút phía client |
| Google OAuth | Cung cấp kết quả xác thực cho luồng đăng nhập Google | Phụ thuộc cấu hình ứng dụng và môi trường bên ngoài |
| Hệ thống email | Chuyển email phục vụ xác minh/khôi phục theo cấu hình | Không thay thế việc kiểm tra hạn dùng mã ở backend |
| Dịch vụ xử lý nền | Nhận job âm thanh/tài liệu, tạo đầu ra và cập nhật trạng thái | Chỉ sử dụng API/credential nội bộ được cấu hình |

PostgreSQL, Redis và RabbitMQ là hạ tầng kỹ thuật. Trong use case tổng quát không coi chúng là người sử dụng sản phẩm. Chúng được thể hiện ở sơ đồ kiến trúc hoặc tuần tự kỹ thuật khi cần giải thích cách thực thi.

### 1.1.4. Yêu cầu chức năng

Bảng 1.3. Yêu cầu chức năng

| Mã | Yêu cầu | Kết quả nghiệp vụ mong đợi |
| --- | --- | --- |
| FR-01 | Đăng ký, đăng nhập, xác minh, khôi phục mật khẩu và quản lý phiên | Tài khoản hợp lệ truy cập đúng phạm vi quyền |
| FR-02 | Tổ chức nhóm, bộ sưu tập, bài học, section và kho từ | Nội dung có cấu trúc và từ có thể tái sử dụng qua liên kết |
| FR-03 | Học từ vựng theo phiên | Lưu hành động trên từng từ và tiến độ của phiên |
| FR-04 | Ôn tập theo lịch và mức AGAIN/HARD/GOOD/EASY | Cập nhật lần ôn, trạng thái ghi nhớ và hạn ôn tiếp theo |
| FR-05 | Lưu từ cá nhân, thư mục và sổ lỗi | Người học quản lý đúng dữ liệu thuộc tài khoản mình |
| FR-06 | Luyện Dictation theo đoạn và tiếp tục tiến độ | Ghi nhận câu đã làm, sai, phát lại và việc xem đáp án |
| FR-07 | Quản trị Dictation từ văn bản hoặc audio tải lên | Tạo bài có audio, phân đoạn và trạng thái xử lý rõ ràng |
| FR-08 | Làm bài TOEIC theo chế độ và phần đã chọn | Lưu đáp án, trạng thái, thời gian và snapshot của attempt |
| FR-09 | Chấm bài, xem kết quả và lịch sử TOEIC | Có số đúng/sai/chưa trả lời, kết quả theo phần và điểm tham khảo |
| FR-10 | Tham gia minigame | Lưu kết quả chơi theo người dùng và trò chơi |
| FR-11 | Arena: phòng, lời mời, sẵn sàng, bắt đầu, trả lời và xếp hạng | Các client nhận trạng thái do server xác nhận |
| FR-12 | Xử lý mất kết nối và rời trận Arena | Khóa thao tác không hợp lệ, đồng bộ lại hoặc kết thúc theo chính sách |
| FR-13 | Trang chủ học tập, XP, chuỗi ngày học và lịch sử | Tổng hợp từ các hoạt động được ghi nhận |
| FR-14 | Gợi ý hoạt động học dựa trên luật | Giải thích được bằng hạn ôn và kết quả trong phạm vi dữ liệu |
| FR-15 | Quản trị người dùng, học liệu, chất lượng và xuất bản | Dữ liệu được kiểm tra và phân quyền trước khi công bố |
| FR-16 | Quản lý media theo Audios/Images rồi tới miền nội dung | Tìm nội dung, xem tệp đang tham chiếu và vị trí sử dụng |
| FR-17 | Tích hợp tác vụ TTS, ASR và hỗ trợ nhập PDF | Theo dõi job, lỗi, thử lại và duyệt kết quả trước khi dùng |
| FR-18 | Giao diện hai ngôn ngữ, responsive, có loading/error/empty | Người dùng phân biệt được lỗi tải với trường hợp chưa có dữ liệu |

### 1.1.5. Yêu cầu phi chức năng

Bảng 1.4. Yêu cầu phi chức năng và cách đánh giá

| Mã | Yêu cầu | Cách đánh giá trong phạm vi đồ án |
| --- | --- | --- |
| NFR-01 | Bảo vệ dữ liệu cá nhân và quyền quản trị | Kiểm tra request chưa đăng nhập, sai vai trò, sai chủ sở hữu |
| NFR-02 | Nhất quán thao tác cập nhật | Kiểm thử giao dịch, cập nhật đồng thời, khóa hàng và idempotency |
| NFR-03 | Truy vấn có giới hạn và tham số hóa | Rà soát SQL, kiểm tra limit/page, thử tham số và xem plan tiêu biểu |
| NFR-04 | Khả năng tiếp tục sau lỗi kết nối | Kiểm tra retry giao diện, reload bài làm và resync Arena |
| NFR-05 | Dễ bảo trì và tách trách nhiệm | Đối chiếu module, DTO, service, owner database và contract |
| NFR-06 | Trải nghiệm nhất quán | Kiểm tra desktop/mobile, tiếng Việt/Anh và phân trang dùng chung |
| NFR-07 | Tái lập môi trường triển khai | Docker Compose, migration và health check; cấu hình CPU/CUDA rõ ràng |
| NFR-08 | Truy vết lỗi và tác vụ nền | Log, trạng thái job, activity log và outbox/inbox |

Các tiêu chí như số người dùng đồng thời, độ trễ p95, dung lượng học liệu tối đa và thời gian phục hồi sau sự cố chưa có số đo tổng thể trong bằng chứng hiện có. Vì vậy, chúng chưa được sử dụng như cam kết năng lực vận hành của sản phẩm.

### 1.1.6. Quy trình nghiệp vụ

**Quy trình tài khoản.** Người dùng gửi thông tin đăng ký, hệ thống kiểm tra dữ liệu và tạo tài khoản theo chính sách xác minh. Khi đăng nhập, backend kiểm tra thông tin hoặc tiếp nhận kết quả Google OAuth, sau đó cấp token và thông tin hồ sơ phù hợp vai trò. Các request tiếp theo sử dụng danh tính đã xác thực. Khi phiên cần làm mới, client gọi API refresh; khi đăng xuất, cookie refresh được xử lý theo luồng tài khoản tương ứng.

**Quy trình học từ vựng.** Người học chọn nhóm, bộ sưu tập rồi bài học. Hệ thống chỉ cung cấp nội dung được phép đọc và lấy các từ qua quan hệ liên kết. Người học xem nghĩa, ví dụ, ảnh, phát âm, thực hiện hành động học và tự đánh giá mức ghi nhớ. Backend ghi nhận thao tác vào phiên học và cập nhật các dữ liệu tiến độ/lịch ôn tương ứng. Kết thúc phiên, hệ thống ghi hoạt động để tổng hợp lịch sử học tập.

**Quy trình ôn tập và sổ lỗi.** Hệ thống lấy các từ đến hạn của người học, đối chiếu nội dung còn được công bố và hiển thị phiên ôn. Sau mỗi mức đánh giá, lịch ôn được cập nhật. Các kết quả sai từ những nguồn được hỗ trợ được tập hợp vào sổ lỗi; việc xem hoặc đánh dấu ôn lại luôn gắn với chủ sở hữu. Sổ lỗi không thay thế lịch sử gốc của bài làm.

**Quy trình tạo và luyện Dictation.** Quản trị viên tổ chức topic, section và bài học; nhập văn bản để tổng hợp giọng nói hoặc tải audio phục vụ nhận dạng/phân đoạn. Kết quả xử lý cần được xem lại, chỉnh nội dung, kiểm tra tài nguyên và xuất bản. Người học chọn bài, nghe từng đoạn, nhập câu trả lời, nhận phản hồi và có thể nghe lại hoặc xem đáp án theo luồng giao diện. Hệ thống lưu các lần thử và việc reveal để không đánh đồng một câu tự làm đúng với một câu đã mở lời giải.

**Quy trình làm TOEIC.** Người học chọn đề, chế độ và phần muốn làm. Backend tạo attempt gắn với snapshot của phiên bản nội dung phù hợp. Trong khi làm, các đáp án và trạng thái điều hướng được lưu theo chính sách; giới hạn phát audio và việc xem lời giải được kiểm soát ở server. Khi nộp, backend xác định trạng thái hợp lệ, chấm từ dữ liệu ổn định và ghi kết quả cùng sự kiện cần thiết. Người học xem kết quả cá nhân và lịch sử.

**Quy trình Arena.** Người học kết nối tới namespace Arena, tạo/vào phòng hoặc tham gia hàng đợi Rank. Server kiểm tra quyền thành viên, trạng thái và cấu hình; nhận tín hiệu sẵn sàng trước khi bắt đầu. Trong trận, đáp án được gửi tới server để kiểm tra và tính điểm. Client nhận kết quả riêng và cập nhật công khai theo loại dữ liệu. Khi mất kết nối, trạng thái server và chính sách reconnect quyết định tạm dừng, đồng bộ, tiếp tục hay kết thúc trận.

**Quy trình quản trị và media.** Quản trị viên tìm kiếm/phân trang danh sách, tạo hoặc chỉnh sửa học liệu, kiểm tra chất lượng rồi thực hiện thao tác xuất bản. Trong thư viện media, quản trị viên chọn loại Audios hoặc Images, chọn Dictation/Vocab/Games/TOEIC, chọn bài/đề/trò chơi và xem các tệp được nội dung đó tham chiếu. Cây này là cách duyệt theo nghiệp vụ; nó không phải phép liệt kê trực tiếp toàn bộ thư mục vật lý trong bucket.

### 1.1.7. Đối tượng và thuộc tính nghiệp vụ

Bảng 1.5. Đối tượng nghiệp vụ và thuộc tính chính

| Đối tượng | Thuộc tính tiêu biểu | Ý nghĩa |
| --- | --- | --- |
| User | email, username, authProvider, isVerified, isBanned, isDeleted | Danh tính và trạng thái tài khoản người học |
| Admin | định danh, thông tin đăng nhập và trạng thái theo bảng admins | Tài khoản thực hiện chức năng quản trị |
| VocabularyGroup | tên, slug, thứ tự | Tổ chức các bộ sưu tập |
| Collection | tên, slug, ảnh bìa và thông tin tổ chức bài | Đơn vị nhóm bài học |
| Lesson/Section | tên, thứ tự, quan hệ cha và trạng thái nội dung | Tổ chức bài và các phần trong bài |
| Word | word, level, ipa, audio, image, parts, variations, publicationStatus | Nội dung từ điển dùng chung |
| LessonWord | lessonId, wordId, sectionId và thứ tự theo triển khai | Liên kết từ vào bài học |
| LearningSession | người học, bài/nguồn học và trạng thái phiên | Theo dõi một lượt học |
| UserWordReview | userId, wordId, reviewCount, intervalDays, nextReviewAt, status | Trạng thái ôn một từ của một người học |
| VocabularyFolder/UserSavedWord | chủ sở hữu, folderId, wordId | Kho từ cá nhân |
| DictationLesson | title, level, topicId, sectionId, sourceText, audioSource, status, fullAudioUrl | Nội dung và quá trình chuẩn bị bài Dictation |
| DictationSegment | bài cha, chỉ mục, nội dung và thời điểm/audio đoạn | Đơn vị luyện nghe |
| DictationProgress | userId, lessonId, currentSegment, segmentProgress, completed | Tiến độ của một người học trên một bài |
| Exam/ExamGroup | tên, slug, nhóm, thứ tự, durationMinutes, publicationRevision | Tổ chức và phiên bản đề luyện tập |
| Question | examId, part, section, content, options, correctAnswer, explanation | Câu hỏi của đề |
| Passage/PassageGroup | nội dung đoạn, nhóm và tham chiếu media | Dữ liệu dùng chung cho các câu hỏi liên quan |
| Attempt | userId, examId, mode, questionSnapshot, answers, status, resultVersion | Bài làm độc lập của người học |
| ArenaRoom/Invitation | thành viên, cấu hình phòng, người gửi/nhận, trạng thái | Điều phối trước khi vào trận |
| ArenaMatch | type, friendMode, status, questionCount, rankedState, runtimePolicy | Trạng thái và chính sách một trận |
| ArenaMatchPlayer/Answer | matchId, userId, kết quả/đáp án theo bảng tương ứng | Dữ liệu tham gia và trả lời |
| ArenaProfile/RatingHistory | người học, rating, thay đổi và trận liên quan | Xếp hạng và lịch sử biến động |
| LearningActivity | userId, module, type, sourceKey, xp, occurredAt, metadata | Hoạt động học đã ghi nhận |
| LearningMistake | nguồn nội dung, wrongCount, reviewedCount, lastWrongAt | Tổng hợp lỗi và trạng thái ôn |
| AudioJob/AsrJob | định danh, state, đầu vào, kết quả, thông tin thử lại | Theo dõi xử lý nền |
| Media asset/reference | URL/key, loại tệp và vị trí tham chiếu | Kết nối tệp vật lý với nội dung sử dụng |

Tên thuộc tính ở bảng trên dùng dạng nghiệp vụ/TypeScript. Thiết kế vật lý sử dụng các tên cột SQL tương ứng. Không mặc định mọi thuộc tính trong một object đều là một cột đơn: một số nhóm dữ liệu có cấu trúc, như nghĩa của từ và snapshot, sử dụng JSONB có chủ đích.

### 1.1.8. Quan hệ giữa các đối tượng

Bảng 1.6. Quan hệ giữa các đối tượng nghiệp vụ

| Quan hệ | Bội số nghiệp vụ | Ghi chú về thực hiện |
| --- | --- | --- |
| Nhóm từ vựng – bộ sưu tập – bài học | Tổ chức phân cấp theo nội dung | Thể hiện quan hệ theo các FK/ID thực tế, không suy ra từ đường dẫn giao diện |
| Lesson – Word | Nhiều–nhiều qua LessonWord | Một từ được dùng trong nhiều bài, một bài chứa nhiều từ |
| Lesson – Section – LessonWord | Một bài có nhiều section và liên kết từ | FK composite kiểm soát section đúng bài |
| User – UserWordReview – Word | Một người có nhiều bản ghi ôn; mỗi cặp user/word có trạng thái riêng | Word nằm ở Content, review nằm ở Learning |
| User – VocabularyFolder – UserSavedWord | Một người có nhiều thư mục và từ đã lưu | Liên kết thư mục phải thuộc đúng người học |
| DictationTopic – Section – Lesson – Segment | Một–nhiều theo từng cấp | Kiểm soát quan hệ topic/section/bài trong Content |
| User – DictationProgress – DictationLesson | Một tiến độ theo cặp người học/bài | Dữ liệu người học tham chiếu bằng UUID |
| Exam – Question | Một đề có nhiều câu hỏi | Passage/group phục vụ câu hỏi dùng chung đoạn |
| User – Attempt – AttemptAnswer | Một người có nhiều lượt làm; lượt làm có nhiều đáp án | Snapshot giữ bối cảnh nội dung của attempt |
| ArenaMatch – ArenaMatchPlayer | Một trận có nhiều người tham gia theo chế độ | Các ràng buộc trạng thái nằm trong service/giao dịch |
| ArenaMatch – ArenaMatchQuestion – ArenaPlayerAnswer | Một–nhiều theo trận và câu | Không đưa đáp án bí mật vào payload công khai |
| User – LearningActivity | Một người có nhiều hoạt động | sourceKey hỗ trợ tránh ghi nhận lặp |
| Nội dung – Media | Một nội dung dùng nhiều tệp; một tệp có thể được tái sử dụng | Thư viện gom URL trùng và giữ các vị trí sử dụng |

Quan hệ logic không đồng nghĩa với khóa ngoại vật lý. Khi hai đối tượng thuộc hai database owner khác nhau, hệ thống dùng UUID, API nội bộ hoặc projection/sự kiện để phối hợp; không tạo FK xuyên database PostgreSQL. Ngay trong cùng database, phạm vi FK hiện có phải dựa trên migration thực tế, không thể suy ra rằng toàn bộ quan hệ đã được ràng buộc.

### 1.1.9. Mô hình use case tổng quát và phân rã

Use case tổng quát đặt ranh giới “Hệ thống VocaLearn”, trong đó có các nhóm quản lý tài khoản, học từ vựng, luyện nghe, làm bài, giải trí học tập, theo dõi tiến độ và quản trị. Tác nhân Người học và Quản trị viên tương tác với các nhóm chức năng tương ứng. Khách truy cập chỉ tham gia các luồng công khai; Google OAuth và hệ thống email được thể hiện như các hệ thống ngoài ở những luồng cần tích hợp.

> [CẦN VẼ — Hình 1.1] Biểu đồ use case tổng quát. Bên trái đặt Khách và Người học; bên phải đặt Quản trị viên, Google OAuth và Email. Trong ranh giới VocaLearn đặt 8 nhóm use case: Tài khoản; Học/ôn từ; Dictation; TOEIC; Minigame/Arena; Tiến độ/sổ lỗi/gợi ý; Quản trị nội dung/xuất bản; Quản trị tài khoản/cấu hình/media. Nối tác nhân tới đúng nhóm. Không nối người học tới thao tác xuất bản hoặc sửa học liệu.

Phân rã học từ vựng gồm duyệt nội dung, mở bài, bắt đầu phiên, xem nội dung từ, ghi hành động, hoàn thành phiên, ôn từ đến hạn và quản lý từ đã lưu. Lưu tiến độ là một phần của những nghiệp vụ thực sự phát sinh thay đổi, không phải mọi thao tác xem từ. Nhánh ôn tập mở rộng thành chọn mức AGAIN/HARD/GOOD/EASY và cập nhật lịch ôn.

> [CẦN VẼ — Hình 1.2] Phân rã use case Từ vựng. Vẽ Người học với Duyệt bài, Học theo phiên, Ôn từ đến hạn, Lưu từ vào thư mục, Xem sổ lỗi. “Học theo phiên” include Ghi nhận hành động và Hoàn thành phiên theo cách phân rã của đồ án; “Ôn từ” include Đánh giá ghi nhớ và Cập nhật lịch ôn. Giải thích include là hành vi bắt buộc trong ca sử dụng đã xác định; không dùng include để biểu diễn thứ tự màn hình.

Phân rã Dictation tách quản trị bài và luyện nghe. Quản trị có nhập văn bản/tải audio, xử lý, biên tập đoạn, kiểm tra và xuất bản. Người học có nghe đoạn, nhập câu trả lời, nghe lại, xem đáp án và xem tiến độ. Phân rã TOEIC có chọn đề/chế độ, tạo attempt, lưu đáp án, điều hướng, nộp và xem kết quả.

> [CẦN VẼ — Hình 1.3] Hai cụm use case Dictation và TOEIC. Với Dictation, tách “Chuẩn bị bài” của Admin và “Luyện nghe” của User. Với TOEIC, tách “Quản trị đề” và “Làm bài”. Xem đáp án trong luyện tập là nhánh có điều kiện; ghi rõ không áp dụng tùy ý cho chế độ kiểm tra. Đánh dấu kiểm tra chủ sở hữu và phiên bản nội dung ở phần đặc tả, không biến thành tác nhân.

Arena được phân rã thành tạo/vào phòng, gửi/nhận lời mời, cấu hình, sẵn sàng, bắt đầu, trả lời, khôi phục kết nối, rời trận và xem xếp hạng. Quản trị được phân rã thành quản lý tài khoản, nội dung, chất lượng, xuất bản, cấu hình, phòng/trận và media. Việc tách nhóm giúp mô hình không biến thành sơ đồ quá nhiều nút khó đọc.

> [CẦN VẼ — Hình 1.4] Phân rã use case Arena và Admin trên hai trang hoặc hai khung riêng. Nhánh Arena có User và Admin đóng phòng; nhánh media có Chọn loại → Chọn miền → Chọn nội dung → Xem tài nguyên, được mô tả như luồng của “Duyệt media”. Dùng ghi chú cho điều kiện host, thành viên, trạng thái phòng và vai trò Admin.

## 1.2. Khảo sát các nghiên cứu và giải pháp liên quan

### 1.2.1. Ôn tập giãn cách

Cepeda và cộng sự tổng hợp các nghiên cứu về luyện tập phân tán và ghi nhớ, chỉ ra vai trò của khoảng cách giữa các lần học đối với khả năng nhớ lại [1]. Kết quả này là cơ sở tham khảo cho việc bố trí những lần ôn thay vì lặp liên tục trong một thời điểm. Trong đề tài, mỗi từ của một người học có thời điểm ôn tiếp theo; lịch được cập nhật theo mức tự đánh giá.

Hệ thống không hiện thực toàn bộ một mô hình trí nhớ được huấn luyện. Các hệ số giãn cách hiện tại là quy tắc xác định trong mã nguồn. Vì vậy, báo cáo chỉ sử dụng nghiên cứu về ôn phân tán như cơ sở lựa chọn hướng thiết kế, không suy ra rằng bộ quy tắc cụ thể của VocaLearn đã được thực nghiệm chứng minh tối ưu.

### 1.2.2. Truy hồi chủ động và phản hồi sau bài tập

Roediger và Karpicke nghiên cứu tác động của việc kiểm tra trí nhớ đối với khả năng lưu giữ dài hạn [2]. Đối với thiết kế sản phẩm, hướng tiếp cận này gợi ý rằng người học cần tự tạo câu trả lời và nhận phản hồi, thay vì chỉ đọc nội dung. VocaLearn áp dụng ý tưởng này qua phiên học từ, nhập câu Dictation, bài TOEIC và các trò chơi hỏi–đáp.

Sổ lỗi bổ sung khả năng quay lại nội dung đã sai. Tuy nhiên, số lỗi và tần suất ôn chỉ mô tả hành vi trên hệ thống; chúng chưa đủ để khẳng định mức tiến bộ ngôn ngữ ngoài môi trường bài tập. Đề tài giữ sự phân biệt giữa kết quả chức năng phần mềm và hiệu quả sư phạm cần nghiên cứu thêm.

### 1.2.3. Anki và hoạt động Dictation của H5P

Tài liệu Anki giới thiệu hai nguyên tắc ghi nhớ chủ động và ôn tập giãn cách, đồng thời hỗ trợ nội dung đa phương tiện [3]. Đây là tham khảo cho luồng xem câu hỏi, tự nhớ, lật/xem đáp án và đánh giá mức ghi nhớ. VocaLearn không sao chép thuật toán lập lịch của Anki; phạm vi hệ thống còn bao gồm Dictation, TOEIC, Arena và quản trị học liệu tích hợp.

H5P mô tả hoạt động Dictation gồm nghe audio, nhập văn bản nghe được và đánh giá câu trả lời [4]. Từ cách tổ chức đó, đề tài lựa chọn đơn vị luyện là đoạn/câu có transcript và audio. VocaLearn bổ sung lưu tiến độ theo tài khoản, cấu trúc topic/section, xử lý âm thanh và quy trình quản trị riêng. So sánh này chỉ xét các chức năng được tài liệu chính thức mô tả, không đánh giá toàn bộ năng lực của các nền tảng liên quan.

### 1.2.4. Nhận dạng tiếng nói phục vụ biên soạn học liệu

Nghiên cứu Whisper trình bày hướng nhận dạng tiếng nói từ giám sát yếu trên dữ liệu quy mô lớn [5]. Dự án sử dụng faster-whisper, một hiện thực chạy suy luận bằng CTranslate2 [6], để hỗ trợ tạo transcript và thông tin thời gian từ audio. Vai trò của ASR là hỗ trợ biên soạn, không thay thế việc duyệt của quản trị viên. Sai khác do tiếng ồn, tên riêng hoặc giọng đọc có thể làm đầu ra chưa phù hợp với mục tiêu bài học.

Đề tài không sử dụng kết quả nhận dạng đầu vào để khẳng định có chức năng chấm phát âm người học. Hai nghiệp vụ này khác nhau về dữ liệu, mô hình đánh giá và tiêu chí kiểm chứng.

### 1.2.5. Định hướng giải pháp của đề tài

Bảng 1.7. Đối chiếu giải pháp liên quan và định hướng của đề tài

| Hướng tham khảo | Giá trị được tham khảo | Cách áp dụng trong VocaLearn | Phạm vi chưa được chứng minh |
| --- | --- | --- | --- |
| Ôn tập phân tán | Bố trí thời gian ôn và nhớ lại | Lưu nextReviewAt cho từng cặp người học/từ | Bộ hệ số hiện tại tối ưu với từng người học |
| Truy hồi chủ động | Tự tạo câu trả lời trước phản hồi | Từ vựng, Dictation, TOEIC, trò chơi | Mức cải thiện điểm thực tế sau sử dụng |
| Anki | Luồng ôn thẻ và tự đánh giá | Bốn mức đánh giá và danh sách từ đến hạn | Tương đương thuật toán/lợi ích của Anki |
| H5P Dictation | Nghe, nhập transcript, nhận phản hồi | Bài theo segment, lưu tiến độ và lịch sử | Hơn/kém toàn diện so với H5P |
| Whisper/faster-whisper | Hỗ trợ chuyển audio thành văn bản | Tác vụ ASR cho biên soạn | Độ chính xác ASR trên tập audio đại diện riêng |

Đóng góp chính của đề tài nằm ở việc tổ chức một sản phẩm có nhiều hình thức luyện tập, dữ liệu tiến độ liên kết theo người học, công cụ quản trị học liệu và thiết kế backend có ranh giới dữ liệu rõ. Phần thực nghiệm tập trung kiểm chứng các luồng này và tính đúng đắn của cơ chế lưu trữ, không trình bày đây là một nghiên cứu tạo thuật toán AI mới.

<!-- PAGEBREAK -->

# CHƯƠNG 2. PHƯƠNG PHÁP TIẾP CẬN VÀ GIẢI PHÁP XÂY DỰNG HỆ THỐNG

## 2.1. Mô hình tổng quát hệ thống

Hệ thống có hai cổng tương tác: ứng dụng người học và ứng dụng quản trị. Cả hai gửi request đến API Gateway. Gateway chuyển tiếp đến dịch vụ chịu trách nhiệm nghiệp vụ và chuyển tiếp kết nối Socket.IO đến Arena. Phía backend có các dịch vụ danh tính, nội dung, đánh giá, thi đấu, học tập, tác vụ media, nhập nội dung AI và thông báo.

Mỗi dịch vụ nghiệp vụ có database PostgreSQL riêng theo quyền sở hữu. Trong cấu hình Docker, các database này có thể cùng nằm trên một tiến trình PostgreSQL; vì thế sự tách biệt hiện tại là database và credential, không phải tám máy chủ vật lý độc lập. Những tác vụ nặng như TTS/ASR và nhập PDF được thực hiện qua các dịch vụ Python và worker. RabbitMQ truyền công việc/sự kiện; Redis phục vụ các dữ liệu vận hành của Arena; SeaweedFS lưu tệp qua API tương thích S3.

> [CẦN VẼ — Hình 2.1] Mô hình tổng quát. Hàng trên: Browser User, Browser Admin. Hàng hai: Next.js User và Next.js Admin → Nginx Gateway. Hàng ba: 8 backend role. Hàng dưới: PostgreSQL (8 database), Redis, RabbitMQ, Media Bridge → SeaweedFS. Bên cạnh đặt TTS, ASR và cụm PDF-AI tùy chọn. Dùng mũi tên khác nhau cho HTTP, Socket.IO và hàng đợi; kèm chú giải. Google/Email là hệ thống ngoài.

## 2.2. Phương pháp xây dựng phần mềm

### 2.2.1. Phân tích hướng đối tượng kết hợp phân chia theo miền

Phương pháp phân tích bắt đầu từ tác nhân và kết quả nghiệp vụ cần đạt. Mỗi chức năng quan trọng được mô tả bằng tiền điều kiện, luồng chính, ngoại lệ và hậu điều kiện. Từ đó xác định các thực thể và dịch vụ cần tham gia. Các thực thể có cùng trách nhiệm và nhu cầu thay đổi gần nhau được gom theo miền.

Danh tính được tách khỏi tiến độ học tập vì vòng đời mật khẩu/xác minh khác với phiên học và lịch ôn. Nội dung được tách khỏi đánh giá vì một đề được biên tập nhiều lần nhưng attempt cần giữ bối cảnh lúc bắt đầu. Arena được tách khỏi các request học thông thường do có trạng thái phòng/trận và tương tác thời gian thực. Việc chia miền là cơ sở xác định quyền sở hữu dữ liệu, không chỉ cách chia thư mục.

### 2.2.2. Xây dựng contract trước các tương tác liên thành phần

Mỗi request cần có cấu trúc đầu vào, điều kiện xác thực, phạm vi dữ liệu và dạng lỗi dự kiến. Các DTO kiểm tra UUID, giới hạn trang, kiểu enum và thuộc tính được phép thay đổi. Các kiểu dùng chung giúp hai frontend và backend thống nhất nội dung trao đổi, nhưng không thay thế kiểm tra runtime tại biên API.

Đối với giao tiếp giữa dịch vụ, bên gọi sử dụng API chuyên biệt của owner. Không truyền SQL tùy ý hoặc nhận toàn bộ bảng rồi lọc ở client. Gateway chặn đường nội bộ ở cổng công khai; API nội bộ tiếp tục kiểm tra token và phạm vi role. Tư duy này được áp dụng cả khi chuyển lớp truy vấn cũ sang SQL trực tiếp.

### 2.2.3. Kiểm chứng theo mức rủi ro

Các hàm quy tắc được kiểm tra ở mức đơn vị; truy vấn và constraint được kiểm tra bằng PostgreSQL; thao tác có nguy cơ tranh chấp được kiểm tra trên nhiều kết nối; còn giao diện và sự kiện realtime được kiểm tra trong trình duyệt. Một trang render thành công không chứng minh backend đã lưu đúng; tương tự, SQL chạy đúng không chứng minh giao diện hiển thị và phục hồi lỗi phù hợp. Vì vậy, các lớp kiểm thử được sử dụng bổ sung cho nhau.

## 2.3. Mô hình phát triển phần mềm

Đề tài áp dụng cách phát triển lặp và tăng trưởng. Mỗi vòng lặp tập trung vào một nhóm chức năng có thể quan sát được: xác định luồng, thiết kế dữ liệu/API, hiện thực, kiểm thử rồi sửa lỗi. Khi dữ liệu hoặc ranh giới dịch vụ thay đổi, các kiểm thử hợp đồng và hồi quy được sử dụng để phát hiện ảnh hưởng tới chức năng đã có.

Các nhóm tăng trưởng thể hiện trong sản phẩm gồm nền tảng tài khoản và giao diện; nội dung từ vựng; phiên học/ôn tập; Dictation và âm thanh; TOEIC; Arena; tiến độ và sổ lỗi; quản trị/xuất bản/media; củng cố PostgreSQL và kiểm thử liên thành phần. Đây là cách hệ thống hóa quá trình triển khai theo chức năng. Báo cáo không gán lịch sprint, số thành viên hoặc thời lượng cụ thể khi không có tài liệu dự án chứng minh.

> [CẦN VẼ — Hình 2.2] Chu trình có 5 bước: Yêu cầu → Phân tích/thiết kế → Hiện thực → Kiểm thử → Đánh giá/cập nhật yêu cầu. Bên dưới vẽ các lần tăng trưởng theo nhóm chức năng đã nêu. Không ghi lịch tuần hoặc số sprint giả định.

## 2.4. Kiến trúc phần mềm

### 2.4.1. Monorepo và các ứng dụng

Mã nguồn được tổ chức trong monorepo. `apps/web` chứa ứng dụng người học; `apps/admin-web` chứa giao diện quản trị; `apps/api` chứa backend và các entrypoint dịch vụ. `packages/shared-types` cung cấp các contract/quy tắc dùng chung; `packages/ui` và các package cấu hình hỗ trợ tái sử dụng trong workspace. `services` chứa các dịch vụ Python; `database/postgres/migrations` quản lý thay đổi schema; `tests` và `scripts` chứa các công cụ kiểm chứng/triển khai.

Backend dùng chung codebase và image trong nhiều role nhưng khởi động qua entrypoint riêng. Do đó kiến trúc triển khai là các dịch vụ theo miền, còn nguồn chương trình vẫn có mức chia sẻ cao. Việc dùng nhiều container không tự chứng minh hệ thống đã có tất cả đặc tính vận hành của một nền tảng microservices quy mô lớn.

### 2.4.2. Phân chia dịch vụ và quyền sở hữu dữ liệu

Bảng 2.1. Phân chia dịch vụ và quyền sở hữu dữ liệu

| Dịch vụ/role | Database | Trách nhiệm tiêu biểu |
| --- | --- | --- |
| Identity | identity_db | Users, admins, xác thực và quản lý danh tính |
| Content | content_db | Từ vựng, bộ sưu tập, bài học, Dictation và publication của nội dung |
| Assessment | assessment_db | Đề/câu hỏi/đoạn, attempt, đáp án, kết quả và dữ liệu cộng đồng đề |
| Arena | arena_db | Phòng, lời mời, trận, người chơi, câu hỏi, rating và cấu hình thi đấu |
| Learning | learning_db | Phiên học, ôn tập, từ đã lưu, tiến độ, hoạt động, lỗi và minigame |
| Media Jobs | media_db | Audio/ASR jobs, media metadata và cấu hình hệ thống liên quan |
| AI Import | ai_import_db | Dữ liệu hỗ trợ pipeline nhập tài liệu và phản hồi chỉnh sửa |
| Notification | notification_db | Activity log, thông báo và tác vụ email theo module |

Vai trò audio worker sử dụng quyền sở hữu Media Jobs khi xử lý `media_db`. Đây là một tiến trình thực thi bổ sung, không phải database nghiệp vụ thứ chín. Dữ liệu hiển thị danh tính ở các miền khác có thể được cung cấp bằng projection, thay vì phát credential Identity cho mọi dịch vụ.

> [CẦN VẼ — Hình 2.3] Vẽ từng cặp service → database theo Bảng 2.1. Đặt 8 database bên trong một khung PostgreSQL server ở môi trường Compose. Mũi tên đọc liên miền đi qua owner HTTP hoặc sự kiện/projection; không vẽ service truy cập trực tiếp database của miền khác. Đánh dấu audio-worker dùng media_db.

### 2.4.3. Cấu trúc xử lý trong một dịch vụ

Một request đi qua xác thực/guard, DTO/validation, controller, service nghiệp vụ và lớp SQL/connection. Controller tiếp nhận và điều phối lời gọi; service kiểm tra điều kiện nghiệp vụ; PostgreSQL chịu trách nhiệm lưu trữ, khóa và constraint đã khai báo. Exception filter chuyển lỗi sang phản hồi HTTP thích hợp và tránh lộ chi tiết database không cần thiết.

Các file `*.row.ts` mô tả kiểu dữ liệu TypeScript. Chúng không phải schema tự tạo bảng trong runtime. Kiểu cột, index, foreign key, trigger và backfill được định nghĩa trong SQL migration. `SqlRecords` hỗ trợ các thao tác đọc/ghi và ánh xạ tên trường/cột; truy vấn chuyên biệt được viết SQL có tham số. Hệ thống không sử dụng ORM để mô phỏng lại truy vấn document của MongoDB trong đường chạy đã được audit.

### 2.4.4. Nhất quán giao dịch và truyền sự kiện

Đối với thao tác quan trọng đã tích hợp outbox, thay đổi nghiệp vụ và sự kiện được ghi trên cùng kết nối giao dịch PostgreSQL. Nếu một bước ghi thất bại, giao dịch rollback. Sau commit, relay lấy bản ghi outbox và phát lên RabbitMQ. Consumer xử lý dữ liệu cục bộ và đánh dấu inbox trong giao dịch của mình, sau đó mới ACK. Khi thông điệp được giao lại, khóa duy nhất/định danh nguồn giúp tránh áp dụng trùng đối với luồng đã được thiết kế như vậy.

RabbitMQ Work Queues là cơ sở tham khảo cho cách tách tác vụ cần thời gian khỏi request HTTP và xác nhận xử lý [10]. Tuy nhiên, broker không tự bảo đảm mọi tác dụng phụ nghiệp vụ chỉ xảy ra một lần. Trong hệ thống, tính lặp an toàn còn phụ thuộc transaction, inbox, ledger và điều kiện cập nhật của từng luồng.

> [CẦN VẼ — Hình 2.4] Sequence: Client → Service A → Transaction A. Trong cùng khung transaction vẽ UPDATE nghiệp vụ + INSERT outbox, rồi COMMIT. Relay → RabbitMQ → Consumer B → Transaction B: kiểm tra inbox, cập nhật dữ liệu/ledger, ghi inbox, COMMIT → ACK. Thêm nhánh lỗi rollback và nhánh message lặp không cộng XP lần hai. Ghi chú “áp dụng cho các luồng đã tích hợp”, không ghi “mọi thao tác đều exactly once”.

### 2.4.5. Kênh thời gian thực

Socket.IO được dùng cho Arena vì phù hợp với mô hình sự kiện, phòng nhận tin và ACK của thao tác. Mặc định của thư viện không đồng nghĩa sự kiện luôn được giao lại khi mất mạng [11]. Do đó ứng dụng có cơ chế xác thực lại, snapshot, revision và đồng bộ trạng thái do server quản lý, thay vì chỉ hiển thị lại các sự kiện client nhớ được.

Server quyết định quyền vào phòng, chuyển trạng thái, thời hạn và kết quả. Giao diện có thể hiển thị đồng hồ hoặc animation cục bộ, nhưng không được xem giá trị client gửi lên là kết quả đáng tin cậy. Payload công khai và payload riêng cần được phân biệt, đặc biệt với lượt đoán Word Guess và đáp án câu hỏi.

### 2.4.6. Lưu trữ media và dữ liệu có cấu trúc

Tệp ảnh/âm thanh được lưu tại SeaweedFS qua API tương thích S3. Database lưu URL/key, metadata và quan hệ tham chiếu. Luồng đọc công khai đi qua Gateway → Media Jobs → Media Bridge → object storage. Một số nhóm đường dẫn riêng tư bị chặn; cơ chế này chưa được trình bày như phân quyền riêng cho từng object trong mọi tình huống.

Thư viện media quản trị bắt đầu từ loại tệp, sau đó nhóm nghiệp vụ và tài nguyên cha. Danh sách lấy từ tham chiếu của bài/đề/trò chơi hiện có, không quét toàn bucket để tìm object. Cách tổ chức này trả lời được câu hỏi “bài học đang dùng tệp nào”, nhưng chưa trả lời đầy đủ “object nào trong storage không còn được tham chiếu”.

PostgreSQL lưu dữ liệu thường truy vấn bằng cột có kiểu; JSONB vẫn được dùng cho cấu trúc lồng và snapshot. Chính sách này tránh tách nhỏ máy móc mọi mảng/đối tượng, đồng thời cần tiếp tục rà soát các trường nghiệp vụ quan trọng còn dùng extension. PostgreSQL cung cấp constraint để ràng buộc dữ liệu [9]; việc có sử dụng PostgreSQL không tự bảo đảm mọi quan hệ trong ứng dụng đã có FK.

## 2.5. Lựa chọn công nghệ

Bảng 2.2. Công nghệ và vai trò sử dụng

| Công nghệ | Vai trò trong dự án | Cơ sở lựa chọn |
| --- | --- | --- |
| TypeScript | Ngôn ngữ chính của frontend/backend | Mô tả kiểu dữ liệu, chia sẻ contract trong monorepo |
| Next.js và React | Hai ứng dụng web | Tổ chức route/layout và giao diện theo component [7] |
| Tailwind CSS, Radix UI | Giao diện và thành phần tương tác | Tái sử dụng thành phần, responsive và thống nhất phong cách |
| TanStack Query, Axios | Giao tiếp API và quản lý server state | Quản lý tải dữ liệu, cache, trạng thái lỗi và retry theo cấu hình |
| Redux Toolkit | Một phần trạng thái client | Chia sẻ trạng thái ứng dụng nơi cần thiết |
| NestJS | Backend theo module/controller/service | Dependency injection, guard và validation phù hợp cách chia trách nhiệm [8] |
| pg, PostgreSQL 17 | Kết nối và lưu trữ nghiệp vụ | SQL trực tiếp, transaction, index, constraint, JSONB |
| Socket.IO | Arena thời gian thực | Sự kiện, room, ACK và tích hợp xác thực |
| Redis | Dữ liệu vận hành Arena | Hỗ trợ presence/queue/điều phối theo các service tương ứng |
| RabbitMQ | Hàng đợi và domain events | Tách xử lý nền và phối hợp bất đồng bộ |
| Python, FastAPI | Dịch vụ hỗ trợ âm thanh/media/AI | Tích hợp thư viện xử lý mô hình và HTTP nội bộ |
| faster-whisper/CTranslate2 | ASR | Suy luận nhận dạng tiếng nói và timestamp |
| Kokoro, PyTorch | TTS | Tạo phát âm/audio học liệu, hỗ trợ CPU hoặc CUDA theo cấu hình |
| SeaweedFS S3 | Lưu ảnh và âm thanh | Lưu tệp độc lập với PostgreSQL và truy cập qua bridge |
| Nginx | API Gateway | Phân tuyến HTTP, media và kết nối realtime |
| Docker Compose | Triển khai phát triển/kiểm thử | Khai báo các dịch vụ, volume, health và dependency |
| Vitest, Node test, Playwright/Chrome | Kiểm chứng | Kiểm thử quy tắc, SQL, UI và các luồng tương tác |

Các phiên bản cụ thể cần lấy từ manifest và image sử dụng khi bàn giao. Báo cáo không dùng phiên bản mới nhất trên Internet thay cho phiên bản đang khai báo trong dự án. Những thành phần Python tùy chọn và model cần được tính đến về dung lượng tải và khả năng chạy trên thiết bị triển khai.

## 2.6. Các phương pháp xử lý nghiệp vụ

### 2.6.1. Lập lịch ôn từ vựng theo bộ quy tắc

Mỗi cặp người học/từ có số lần ôn, số đúng/sai, khoảng cách tính bằng ngày, hạn ôn và trạng thái LEARNING hoặc MASTERED. Sau khi kiểm tra từ còn được phép học, backend tạo bản ghi nếu chưa có, khóa hàng tương ứng rồi tính lịch mới. Điều này tránh hai request đồng thời cùng đọc một giá trị cũ và ghi đè kết quả của nhau.

Bảng 2.3. Quy tắc cập nhật lịch ôn từ vựng

| Mức đánh giá | Khoảng cách mới và hạn ôn | Cập nhật tiêu biểu |
| --- | --- | --- |
| AGAIN | intervalDays = 0; ôn sau 10 phút | Tăng incorrectCount, về LEARNING |
| HARD | max(1, round((intervalDays hoặc 1) × 1,2)) ngày | Tăng reviewCount; giữ cách tính đúng/sai như implementation |
| GOOD | Từ 0 → 1 ngày; từ 1 → 3 ngày; còn lại round(intervalDays × 2,5) | Tăng correctCount; MASTERED khi reviewCount ≥ 4 và correctCount ≥ 3 |
| EASY | Từ 0 → 3 ngày; còn lại round(intervalDays × 3,5) | Tăng correctCount; MASTERED khi reviewCount ≥ 2 |

Ví dụ một từ mới được đánh giá GOOD liên tiếp có khoảng cách 1 ngày, 3 ngày rồi 8 ngày theo phép làm tròn đang dùng. Nếu chọn AGAIN, từ quay về lịch 10 phút. HARD trong implementation hiện tại không tự tăng incorrectCount hoặc correctCount; đây là chi tiết cần giữ khi mô tả để báo cáo không khác chương trình.

Thuật toán là SRS dựa trên luật của dự án, không phải khẳng định hiện thực chuẩn SM-2 hoặc FSRS. Hai luồng đánh giá trong phiên học và ôn độc lập cần được duy trì cùng chính sách khi thay đổi để tránh khác biệt hành vi.

### 2.6.2. Chấm bài TOEIC từ snapshot

Khi bắt đầu, attempt lưu dữ liệu phiên bản đề và câu hỏi cần thiết. Đáp án đúng dùng để chấm thuộc snapshot phía server. Việc chỉnh sửa câu hỏi hoặc xuất bản revision khác không được âm thầm thay thế nội dung của attempt đã tạo. Kiểm tra revision và snapshot giúp server từ chối trạng thái thiếu/không hợp lệ thay vì tự dựng lại bối cảnh bằng nội dung hiện hành.

Khi nộp, hệ thống tổng hợp đúng, sai, chưa trả lời và kết quả theo part/section; lưu phiên bản kết quả để kiểm soát thao tác lặp. Điểm quy đổi nghe/đọc sử dụng bảng tham khảo trong `toeic-score.mjs`. Với một bài chỉ có 30 câu, chương trình tra theo số câu đúng thực tế, không tự chuẩn hóa thành 100 câu để tạo cảm giác điểm cao tương đương đề đủ. Do bảng này không phải bảng quy đổi chính thức cho từng mã đề, giao diện và báo cáo cần gọi đây là điểm ước lượng.

### 2.6.3. Tính điểm và rating Arena

Đối với hàm tính điểm câu hỏi hiện có, đặt T là thời gian cho phép, t là thời gian trả lời đã giới hạn trong đoạn hợp lệ và w là số lần sai. Thưởng tốc độ bằng round(100 × (1 − t/T)) khi T > 0; trường hợp không có thời gian hợp lệ thì thưởng bằng 0. Điểm sau khi trả lời đúng bằng max(100, 100 + thưởng tốc độ − 15 × w). Việc chấp nhận đáp án và điều kiện gọi hàm vẫn do luồng trận kiểm soát.

Ví dụ T = 15.000 ms, t = 3.000 ms, w = 1 thì thưởng là 80 và điểm là 165. Công thức chỉ mô tả điểm câu hỏi của service tương ứng, không áp đặt cho mọi chế độ chơi như Word Guess hoặc Word Chain.

Rating dùng công thức Elo trong `ArenaRatingService`: E(A) = 1/(1 + 10^((R(B) − R(A))/400)); ΔR = round(K × (S − E(A))); rating mới lấy tối thiểu bằng 0. S có giá trị thắng 1, hòa 0,5 hoặc thua 0. K mặc định trong service là 32 và có thể được truyền theo cấu hình của luồng gọi. Rating là chỉ số thi đấu nội bộ, không được diễn giải như chứng chỉ trình độ tiếng Anh.

### 2.6.4. Gợi ý hoạt động dựa trên luật

Hệ thống ưu tiên từ đến hạn và xem các nguồn kết quả TOEIC/Dictation trong phạm vi cấu hình. Mặc định bộ luật có tối đa 3 gợi ý, yêu cầu tối thiểu 3 mẫu, tối thiểu 10 câu và ngưỡng chính xác yếu là dưới 70%. Các giá trị có thể thay đổi qua cấu hình được kiểm tra.

Gợi ý TOEIC lựa chọn phần có độ chính xác thấp khi đủ dữ liệu trong cửa sổ gần đây; gợi ý Dictation dựa trên kết quả đúng lần đầu. Khi chưa đủ bằng chứng, hệ thống đưa gợi ý bắt đầu hoặc duy trì thay vì khẳng định người học yếu một kỹ năng. Các nguồn không tải được được phân biệt với dữ liệu bằng 0; nếu toàn bộ nguồn cần thiết đều lỗi, API trả trạng thái lỗi phù hợp.

Đây là engine luật có thể giải thích bằng điều kiện, không phải mô hình machine learning được huấn luyện trên lịch sử người dùng. Hướng thiết kế phù hợp dữ liệu hiện có và giúp quản trị viên kiểm tra tác động của cấu hình.

### 2.6.5. Xử lý âm thanh và trạng thái job

TTS tạo giọng đọc từ văn bản. Với bài Dictation, dịch vụ có thể tổng hợp từng đoạn rồi ghép audio toàn bài cùng khoảng nghỉ, trả thông tin thời gian đoạn. ASR xử lý audio tải lên để hỗ trợ transcript và timestamp. Kết quả được đưa về luồng biên tập, lưu tệp ở object storage và cập nhật URL/metadata qua owner.

Tác vụ nền có các thao tác SQL chuyên biệt cho tạo, đọc, kích hoạt, thử lại, hoàn tất và thất bại. Audio worker dùng cơ chế claim/lease và điều kiện thế hệ phù hợp để tránh worker cũ ghi đè hoàn tất từ worker mới. Các bộ đếm thử lại được tăng nguyên tử trong SQL. Cần phân biệt độ đúng của điều phối job với chất lượng ngôn ngữ của audio sinh ra; chúng phải được đánh giá bằng các phép thử khác nhau.

<!-- PAGEBREAK -->

# CHƯƠNG 3. PHÂN TÍCH, THIẾT KẾ VÀ THỰC NGHIỆM HỆ THỐNG

## 3.1. Phân tích hệ thống

### 3.1.1. Danh sách ca sử dụng

Bảng 3.1. Danh sách ca sử dụng được phân tích

| Mã | Ca sử dụng | Tác nhân chính | Kết quả |
| --- | --- | --- | --- |
| UC-01 | Đăng nhập và sử dụng phiên | Người học/Quản trị viên | Được cấp quyền truy cập theo vai trò |
| UC-02 | Học bài từ vựng | Người học | Phiên học và tiến độ được ghi nhận |
| UC-03 | Ôn từ đến hạn | Người học | Lịch ôn của từ được cập nhật |
| UC-04 | Luyện một bài Dictation | Người học | Tiến độ từng đoạn được lưu |
| UC-05 | Tạo và xuất bản Dictation | Quản trị viên | Bài có nội dung/audio hợp lệ để công bố |
| UC-06 | Làm và nộp bài TOEIC | Người học | Attempt có kết quả ổn định theo snapshot |
| UC-07 | Chơi Arena cùng người khác | Người học | Các thành viên cùng tham gia một phiên/trận hợp lệ |
| UC-08 | Ghép Rank và khôi phục kết nối | Người học | Trận đồng bộ hoặc kết thúc theo chính sách |
| UC-09 | Xem tiến độ, sổ lỗi và gợi ý | Người học | Thấy dữ liệu đúng chủ sở hữu và đủ bối cảnh |
| UC-10 | Quản trị và xuất bản học liệu | Quản trị viên | Tài nguyên thay đổi theo quyền và vòng đời |
| UC-11 | Duyệt media theo loại và nội dung | Quản trị viên | Xem ảnh/audio hiện được tham chiếu |
| UC-12 | Nhập học liệu có hỗ trợ xử lý PDF | Quản trị viên | Nhận dữ liệu nháp để xem lại trước khi sử dụng |
| UC-13 | Quản lý tài khoản và can thiệp phòng | Quản trị viên | Trạng thái tài khoản/phòng thay đổi có kiểm soát |

### 3.1.2. Kịch bản UC-01: Đăng nhập và sử dụng phiên

**Mục đích:** xác lập danh tính và vai trò cho những request tiếp theo.

**Tiền điều kiện:** tài khoản tồn tại, đáp ứng điều kiện hoạt động; client sử dụng luồng đăng nhập người học hoặc quản trị tương ứng.

**Luồng chính:** (1) Người dùng nhập thông tin tại form. (2) Client kiểm tra dữ liệu cơ bản và gửi request. (3) Backend kiểm tra tài khoản và thông tin xác thực. (4) Backend tạo access token/refresh token, thiết lập cookie refresh theo luồng. (5) Client nhận hồ sơ và chuyển tới khu vực phù hợp. (6) Khi access token cần làm mới, client gọi API refresh và tiếp tục theo kết quả server.

**Ngoại lệ:** dữ liệu không hợp lệ; sai thông tin; tài khoản bị khóa/xóa; cookie không có hoặc refresh không hợp lệ; dịch vụ không truy cập được. Client hiển thị lỗi thích hợp, không chuyển tới trang quản trị chỉ dựa trên dữ liệu tự lưu.

**Hậu điều kiện:** người dùng hợp lệ có phiên theo vai trò. Mật khẩu không được đưa vào response. Nhánh Google OAuth phụ thuộc cấu hình callback và quyền của nhà cung cấp, cần kiểm thử riêng ngoài luồng đăng nhập local.

### 3.1.3. Kịch bản UC-02: Học bài từ vựng

**Mục đích:** tiếp cận các từ trong bài và lưu hoạt động học.

**Tiền điều kiện:** người học đã đăng nhập; bài và nội dung liên quan đáp ứng điều kiện publication; danh sách từ có thể được tải.

**Luồng chính:** (1) Chọn nhóm, bộ sưu tập và bài học. (2) Backend trả nội dung được phép đọc. (3) Bắt đầu phiên học. (4) Người học xem từ, nghĩa, ví dụ, ảnh và audio. (5) Gửi hành động/đánh giá theo giao diện. (6) Server xác minh người sở hữu phiên và cập nhật từ trong phiên. (7) Khi hoàn tất, server tổng hợp tiến độ và ghi nhận hoạt động theo luồng đã tích hợp.

**Ngoại lệ:** bài không còn được công bố; liên kết từ đã thay đổi; phiên không thuộc người học; audio lỗi; request ghi thất bại. Giao diện cần tách lỗi media khỏi lỗi lưu tiến độ, không tự tăng số từ hoàn thành chỉ vì đã bấm nút.

**Hậu điều kiện:** tiến độ phản ánh các thao tác đã được backend chấp nhận; từ dùng chung vẫn chỉ có một nguồn nội dung ở Content.

### 3.1.4. Kịch bản UC-03: Ôn từ đến hạn

**Tiền điều kiện:** người học đã đăng nhập; tồn tại từ có nextReviewAt đến hạn và nội dung được phép sử dụng.

**Luồng chính:** (1) Mở trang ôn. (2) Server truy vấn các review thuộc người học với hạn không lớn hơn thời điểm hiện tại, sắp xếp và giới hạn số lượng. (3) Người học tự nhớ câu trả lời, xem nội dung và chọn AGAIN/HARD/GOOD/EASY. (4) Server kiểm tra từ qua owner, khóa bản ghi review rồi cập nhật theo Bảng 2.3. (5) Ghi nhận outcome phục vụ sổ lỗi theo định danh nguồn. (6) Trả trạng thái mới và chuyển tới từ tiếp theo.

**Ngoại lệ:** từ không còn được công bố; request trùng/cạnh tranh; dữ liệu rating ngoài enum; mất kết nối. Những ngoại lệ này không được giải quyết bằng cách cập nhật review của người khác hoặc tạo nội dung từ ở Learning.

**Hậu điều kiện:** lịch và bộ đếm lưu trong database là dữ liệu được sử dụng cho lần truy cập sau.

### 3.1.5. Kịch bản UC-04: Luyện một bài Dictation

**Tiền điều kiện:** bài đã được phép cung cấp cho người học và có segment/audio phù hợp.

**Luồng chính:** (1) Mở bài, lấy các đoạn và tiến độ cá nhân. (2) Chọn đoạn, nghe audio. (3) Nhập nội dung nghe được và gửi kiểm tra. (4) Hệ thống phản hồi theo quy tắc đối chiếu hiện thực. (5) Người học có thể nghe lại hoặc xem đáp án. (6) Server cập nhật attempts, wrongAttempts, replayCount, revealed, firstTryCorrect và trạng thái đoạn theo hành động được ghi. (7) Khi đạt điều kiện hoàn thành, bài được ghi nhận vào tiến độ/hoạt động liên quan.

**Ngoại lệ:** không tải được audio; request lưu lỗi; không còn truy cập được bài; transcript chưa sẵn sàng. Nếu API lỗi, giao diện hiển thị lỗi và thử lại thay vì coi như tiến độ 0. Nếu đã reveal, kết quả cần giữ dấu vết reveal khi người học quay lại.

**Hậu điều kiện:** mở lại bài có thể tiếp tục theo tiến độ server. Chỉ số đúng lần đầu khác với hoàn thành sau nhiều lần thử hoặc sau khi xem đáp án.

### 3.1.6. Kịch bản UC-05: Tạo và xuất bản Dictation

**Tiền điều kiện:** tài khoản có quyền quản trị; topic/section và cấu hình xử lý phù hợp.

**Luồng chính:** (1) Tạo bài với tiêu đề, cấp độ và cấu trúc cha. (2) Nhập văn bản hoặc tải audio. (3) Gửi yêu cầu xử lý; backend tạo job và cập nhật trạng thái. (4) Worker gọi TTS/ASR, lưu đầu ra và phản hồi metadata. (5) Admin xem, sửa transcript, đoạn và tài nguyên. (6) Chạy kiểm tra nội dung/xuất bản. (7) Công bố bài khi đáp ứng yêu cầu.

**Ngoại lệ:** tệp sai định dạng, model không khởi động, xử lý thất bại, kết quả nhận dạng cần sửa hoặc quan hệ section/topic không hợp lệ. Hệ thống giữ lỗi xử lý để quản trị viên xem và thử lại; không tự đưa bài đang lỗi vào nội dung học công khai.

**Hậu điều kiện:** bài công bố có revision/trạng thái phù hợp; việc xử lý lại không được để một kết quả job cũ tùy ý ghi đè trạng thái mới.

### 3.1.7. Kịch bản UC-06: Làm và nộp bài TOEIC

**Tiền điều kiện:** người học đã đăng nhập; đề có thể sử dụng; các phần và chế độ yêu cầu hợp lệ.

**Luồng chính:** (1) Chọn đề và cấu hình bài làm. (2) Server xác định revision và tạo snapshot. (3) Client tải attempt, hiển thị câu hỏi/đoạn/audio theo quyền. (4) Người học chọn đáp án, đánh dấu và di chuyển giữa câu; server lưu trạng thái được phép. (5) Nhấn nộp bài hoặc đi qua điều kiện kết thúc hợp lệ. (6) Server khóa/kiểm tra trạng thái, chấm theo snapshot và lưu kết quả. (7) Client mở trang kết quả và lịch sử.

**Ngoại lệ:** attempt thuộc người khác; snapshot thiếu/cũ không hợp lệ; đã nộp; dữ liệu hết điều kiện cập nhật; request đồng thời; cố sửa đáp án đã reveal trong luồng PRACTICE. Bộ kiểm thử hiện có phân biệt TEST được sửa đáp án trước nộp và PRACTICE có khóa tương ứng sau reveal.

**Hậu điều kiện:** kết quả gắn với attempt và nội dung phiên bản đã chụp. Các request nộp lặp không được gây cộng kết quả/XP tùy ý; mức bảo đảm cần đối chiếu các guard giao dịch trong luồng tương ứng.

### 3.1.8. Kịch bản UC-07: Chơi Arena cùng người khác

**Tiền điều kiện:** người học đăng nhập, socket xác thực; dữ liệu câu hỏi/từ được phép dùng và đủ cho chế độ.

**Luồng chính:** (1) Host tạo phòng và chọn cấu hình. (2) Người khác vào phòng hoặc nhận lời mời. (3) Server cập nhật thành viên tới các client. (4) Người tham gia sẵn sàng; host bắt đầu khi đủ điều kiện. (5) Server tạo trạng thái trận và câu hỏi/tài nguyên. (6) Client gửi đáp án/hành động. (7) Server kiểm tra và phát cập nhật phù hợp. (8) Kết thúc, lưu người thắng/hòa, kết quả và dữ liệu lịch sử.

**Ngoại lệ:** phòng đóng/đầy; không phải host nhưng đổi cấu hình/bắt đầu; thành viên rời; thiếu từ hợp lệ; đáp án đến khi trạng thái không cho phép. Trong Word Guess, lượt đoán riêng không được phát đầy đủ cho đối thủ; trong Word Chain, server kiểm tra lượt và chuỗi từ.

**Hậu điều kiện:** các client cùng nhìn trạng thái chung được server xác nhận; dữ liệu riêng được gửi đúng người nhận.

### 3.1.9. Kịch bản UC-08: Ghép Rank và khôi phục kết nối

**Tiền điều kiện:** người học có thể tham gia chế độ Rank; hạ tầng realtime/queue hoạt động.

**Luồng chính:** (1) Người học vào hàng đợi. (2) Matchmaking ghép người chơi phù hợp theo implementation. (3) Các client nhận match-found, tải/sync trận và sẵn sàng. (4) Trận bắt đầu. (5) Khi một client mất kết nối, server cập nhật trạng thái theo chính sách đã chụp. (6) Client nối lại, xác thực, nhận snapshot/revision và gửi xác nhận đồng bộ. (7) Server tiếp tục hoặc kết thúc tùy điều kiện reconnect.

**Ngoại lệ:** hủy hàng đợi; client đã thuộc trận khác; nối lại quá hạn; cả hai mất kết nối; người chơi chủ động rời. Trong thời gian mất mạng hoặc chưa đồng bộ, giao diện khóa thao tác cần kết nối, tránh tạo cảm giác server đã nhận đáp án.

**Hậu điều kiện:** phòng/trận không phụ thuộc vào trạng thái tạm của một tab. Rating chỉ cập nhật theo kết quả được server chấp nhận cho chế độ tương ứng.

### 3.1.10. Kịch bản UC-09: Xem tiến độ, sổ lỗi và gợi ý

**Tiền điều kiện:** đã đăng nhập; dữ liệu hoạt động được ghi nhận theo các nguồn hỗ trợ.

**Luồng chính:** (1) Mở trang chủ/tiến độ. (2) Backend lấy dữ liệu đúng user, xử lý phạm vi ngày và múi giờ theo API. (3) Trả XP, lịch sử/heatmap hoặc số liệu chức năng. (4) Ở sổ lỗi, người học lọc và mở nội dung nguồn để ôn. (5) Engine gợi ý kết hợp lịch ôn và thống kê đủ mẫu, trả hành động cùng lý do.

**Ngoại lệ:** một nguồn gợi ý không khả dụng; toàn bộ nguồn lỗi; tham số ngày/múi giờ không phù hợp; nội dung nguồn đã bị gỡ. Client phân biệt “chưa có dữ liệu” với “không tải được dữ liệu”. Gợi ý không kết luận điểm yếu khi chưa đủ bằng chứng.

**Hậu điều kiện:** dữ liệu không bị lẫn giữa người dùng; báo cáo tiến độ không tự tạo hoạt động học mới chỉ vì người học mở trang.

### 3.1.11. Kịch bản UC-10: Quản trị và xuất bản học liệu

**Tiền điều kiện:** có phiên Admin hợp lệ; tài nguyên thuộc miền được thao tác.

**Luồng chính:** (1) Mở danh sách, tìm kiếm và chọn trang. (2) Tạo/sửa tài nguyên hoặc quan hệ cha–con. (3) Server kiểm tra DTO, quyền và điều kiện dữ liệu. (4) Admin chạy kiểm tra chất lượng/publication. (5) Hệ thống trả lỗi chặn/cảnh báo theo quy tắc. (6) Admin sửa và thực hiện publish/unpublish phù hợp. (7) Server ghi trạng thái, revision và audit của luồng xuất bản.

**Ngoại lệ:** FK không thỏa, trùng nội dung, thiếu media, tài nguyên đã xóa, revision đã thay đổi. Lỗi quan hệ được chuyển thành phản hồi nghiệp vụ an toàn; không trả trực tiếp tên constraint/key nội bộ cho người dùng cuối.

**Hậu điều kiện:** client người học đọc theo điều kiện publication hiện tại; attempt cũ vẫn được xử lý theo snapshot của nó.

### 3.1.12. Kịch bản UC-11: Duyệt media theo cây

**Tiền điều kiện:** đăng nhập Admin; các owner nội dung khả dụng.

**Luồng chính:** (1) Mở Quản lý media. (2) Chọn Audios hoặc Images. (3) Chọn Dictation, Vocab, Games hoặc TOEIC. (4) Tìm kiếm/phân trang bài, đề hoặc trò chơi; riêng Vocab có thể chọn loại lesson/collection/word. (5) Chọn tài nguyên. (6) API owner truy vấn các URL được tham chiếu, phân loại và gom trùng. (7) Giao diện hiển thị preview/playback, mở bản gốc, sao chép URL và các vị trí sử dụng.

**Ngoại lệ:** sai vai trò, pageSize vượt giới hạn, tài nguyên cha bị xóa, tệp URL không hợp lệ hoặc storage lỗi. Nếu cùng URL xuất hiện ở nhiều nơi, giao diện giữ một mục tệp kèm nhiều vị trí; không bỏ mất thông tin sử dụng.

**Hậu điều kiện:** chức năng duyệt là chỉ đọc; không tự di chuyển/xóa object hay tự quét các tệp mồ côi trong bucket.

### 3.1.13. Kịch bản UC-12 và UC-13: Hỗ trợ nhập và quản lý vận hành

**UC-12 — Nhập PDF.** Admin gửi tài liệu qua luồng import, hệ thống tạo công việc, xử lý để đề xuất nội dung/cấu trúc và media, rồi đưa kết quả về màn hình duyệt. Admin xem lại câu hỏi, lựa chọn, đáp án, đoạn và ảnh/audio trước khi lưu hoặc xuất bản. Tác vụ lỗi cần thể hiện trạng thái và khả năng xử lý lại theo pipeline. Không giả định mọi PDF đều được tách chính xác hoặc đầu ra AI được công bố tự động. Phần này phụ thuộc profile và model của môi trường triển khai.

**UC-13 — Tài khoản và phòng.** Admin tìm/phân trang danh sách người dùng, mở chi tiết và cập nhật trạng thái theo quyền; ở Arena, Admin có thể đóng phòng qua thao tác xác nhận/lý do của giao diện. Backend kiểm tra quyền và phát cập nhật tới người đang tham gia. Nếu request thất bại, danh sách không được thể hiện thao tác đã hoàn tất khi server chưa chấp nhận. Nhật ký được sử dụng để truy vết theo phạm vi luồng hiện có.

### 3.1.14. Mô hình lớp thực thể ở mức phân tích

Mô hình lớp phân tích tập trung vào ngữ nghĩa và quan hệ: User, Word, Lesson, LearningSession, Review, DictationLesson, Segment, Progress, Exam, Question, Attempt, Room, Match, Player và Activity. Ở mức này, chưa đặt framework, decorator hoặc connection pool vào lớp nghiệp vụ. Định danh liên miền chỉ biểu diễn tham chiếu; không coi chúng là quan hệ sở hữu vòng đời mạnh giữa mọi service.

> [CẦN VẼ — Hình 3.1] Entity class diagram chia thành các package Identity, Content, Assessment, Learning và Arena. Lấy thuộc tính tiêu biểu từ Bảng 1.5, quan hệ từ Bảng 1.6; ghi bội số rõ. Lesson–Word đi qua LessonWord. User–Review/Attempt/MatchPlayer/Activity dùng UUID. Đường nét đứt biểu diễn tham chiếu liên database; không vẽ composition giữa User và mọi dữ liệu lịch sử.

### 3.1.15. Phân tích động và trạng thái

Luồng học từ được mô hình bằng activity diagram vì trọng tâm là các quyết định: còn từ hay không, mức rating, lưu có thành công hay không và kết thúc phiên. Bài làm TOEIC cần mô hình trạng thái vì việc được lưu, reveal hay submit phụ thuộc trạng thái. Arena cần mô hình trạng thái phong phú hơn, gồm thời gian chờ, bắt đầu, chơi và khôi phục.

> [CẦN VẼ — Hình 3.2] Activity diagram: Chọn bài → Tải dữ liệu → Bắt đầu phiên → Chọn từ → Thực hiện học → Rating → Server lưu và cập nhật lịch → quyết định còn từ → Hoàn thành. Thêm nhánh API lỗi → Thông báo/Thử lại, không đi tới nút “đã lưu” khi thất bại. Có thể tách swimlane User, Web, Learning và Content.

> [CẦN VẼ — Hình 3.3] State diagram của attempt. Enum `ToeicAttemptStatus` trong `attempt.types.ts` gồm IN_PROGRESS, FINISHED và ABANDONED. Kiểm tra điều kiện chuyển trong attempt service trước khi nối mũi tên; mô tả IN_PROGRESS → FINISHED cho nộp bài hợp lệ và nhánh ABANDONED theo đúng hành vi hiện có. Thêm ghi chú về khóa cập nhật khi kết thúc, TEST/PRACTICE và reveal. Giá trị COMPLETED còn được row type chấp nhận cần được phân biệt là dữ liệu tương thích, không mặc định là trạng thái chuyển tiếp của mọi attempt mới. Chú thích snapshot không đổi theo việc sửa đề.

> [CẦN VẼ — Hình 3.4] State diagram Arena với các trạng thái khai báo: WAITING, COUNTDOWN, PLAYING, PAUSED, RESUMING, FINISHING, FINISHED, CANCELLED. Nối những chuyển tiếp thực có trong match/connection service; ghi trigger ready, start, answer/end, disconnect, sync, timeout/leave. Không hiểu mọi cặp trạng thái đều có thể chuyển qua lại. Đặt finishReason như nhãn nguyên nhân, không biến mỗi reason thành một trạng thái mới.

## 3.2. Thiết kế hệ thống

### 3.2.1. Nguyên tắc thiết kế dữ liệu

Dữ liệu được thiết kế theo owner, sử dụng UUID làm định danh, cột có kiểu cho thuộc tính thường truy vấn và JSONB cho cấu trúc lồng/snapshot phù hợp. PK, UNIQUE, CHECK, FK và index được khai báo bằng migration. Các luồng cạnh tranh dùng transaction và điều kiện cập nhật hoặc khóa hàng. Khi xóa đối tượng cha, service xử lý liên kết theo chính sách trước khi xóa; constraint tiếp tục chặn dữ liệu không hợp lệ.

Các mốc schema trong audit không chỉ được xác định bằng tên migration. Công cụ còn ghi checksum/fingerprint, giúp phát hiện database không khớp contract mong đợi. Bootstrap phục vụ cài mới; database đã có dữ liệu phải đi qua chuỗi migration, không dùng việc chỉnh file khởi tạo như cách cập nhật dữ liệu đang tồn tại.

Trong lớp API, `_id` tiếp tục là một khóa chuỗi UUID để tương thích client. Tên khóa này không có nghĩa hệ thống vẫn lưu document MongoDB. Phân biệt định dạng response và cơ chế truy vấn giúp tránh kết luận sai khi đọc mã nguồn frontend.

### 3.2.2. Thiết kế các bảng dữ liệu chính

Bảng 3.2. Các bảng dữ liệu tiêu biểu theo miền

| Database | Bảng | Nhóm cột tiêu biểu/kiểu | Ràng buộc và vai trò |
| --- | --- | --- | --- |
| identity_db | users | id UUID; email/username TEXT; auth_provider TEXT; is_verified/is_banned/is_deleted BOOLEAN | Danh tính người học; mật khẩu là giá trị băm khi dùng local |
| identity_db | admins | id UUID; thông tin đăng nhập/trạng thái theo schema | Danh tính quản trị, tách luồng xác thực |
| content_db | words | id UUID; word/slug/level TEXT; ipa/audio/parts JSONB; publication_status TEXT | Kho từ dùng chung; trạng thái và revision phục vụ publication |
| content_db | collections, vocabularygroups | id UUID; tên/slug/thứ tự và dữ liệu tổ chức | Cấu trúc duyệt từ vựng |
| content_db | lessons, sections | id UUID; collection_id/lesson_id UUID theo bảng; thông tin nội dung | Bài học và phần; constraint cha–con theo migration |
| content_db | lessonwords | id UUID; lesson_id, word_id, section_id UUID | FK tới bài/từ; quan hệ section đúng bài qua FK composite |
| content_db | dictationtopics, dictationsections | id UUID; quan hệ topic và thứ tự | Cấu trúc chủ đề Dictation |
| content_db | dictationlessons | id UUID; topic_id/section_id UUID; source_text TEXT; status TEXT; full_audio_url TEXT | Nội dung, audio và trạng thái chuẩn bị/công bố |
| content_db | dictationsegments | id UUID; lesson_id UUID; thông tin chỉ mục, transcript và thời gian | Đoạn luyện; FK và thứ tự theo schema |
| content_db | dictationprogresses | id UUID; user_id/lesson_id UUID; các mảng tiến độ JSONB; completed BOOLEAN | Tiến độ theo người học/bài; User thuộc database khác |
| assessment_db | examgroups, exams | id UUID; group_id UUID; duration_minutes; publication_status/revision | Tổ chức đề và phiên bản công bố |
| assessment_db | questions | id UUID; exam_id/passage_group_id UUID; part; content TEXT; options JSONB | Câu hỏi, đáp án, media và dữ liệu import |
| assessment_db | passages, passagegroups | id UUID; quan hệ nhóm và nội dung/media | Dữ liệu chung của nhiều câu |
| assessment_db | attempts | id UUID; user_id/exam_id UUID; mode/status TEXT; question_snapshot JSONB; exam_publication_revision; kết quả | Bài làm, snapshot và trường kết quả có kiểu |
| assessment_db | attemptanswers | khóa/attempt_id/question_id theo migration; đáp án và trạng thái | Ghi đáp án ở đường lưu/chấm hiện tại, khóa theo luồng nghiệp vụ |
| learning_db | learningsessions, learningsessionwords | id UUID; user_id/session_id/word_id UUID và trạng thái | FK local từ session word tới session |
| learning_db | userwordreviews | user_id/word_id UUID; review_count; interval_days; next_review_at TIMESTAMPTZ | UNIQUE cặp người/từ; lịch ôn do server cập nhật |
| learning_db | vocabularyfolders, usersavedwords | id UUID; user_id/folder_id/word_id UUID | Liên kết folder theo đúng chủ sở hữu |
| learning_db | userlessonprogresses, userlessonwords, userdailyactivities | user_id và các thông tin tiến độ/thời điểm | Phục vụ học và tổng hợp theo ngày |
| learning_db | learning_activities, learning_credit_ledger | user_id UUID; source_key TEXT; xp; occurred_at TIMESTAMPTZ | Ghi hoạt động/credit theo nguồn để kiểm soát lặp |
| learning_db | learning_mistakes, learning_item_outcomes | định danh nguồn; wrong_count/reviewed_count; thời điểm | Tập hợp lỗi, mẫu kết quả và trạng thái đã ôn |
| learning_db | user_active_time_state, user_active_time_slices | user_id, trạng thái/thời gian hoạt động | Dữ liệu đo thời gian hoạt động theo cơ chế riêng |
| learning_db | gamedefinitions, minigameresults | id, định danh game/user, cấu hình và kết quả | Minigame và lịch sử |
| arena_db | arenarooms, friendrooms, arenainvitations | định danh, thành viên/cấu hình và trạng thái | Lobby và điều phối lời mời |
| arena_db | arenamatches | id UUID; type/status TEXT; ranked_state/audio_settings JSONB; runtime_policy | Trạng thái bền vững và snapshot cấu hình |
| arena_db | arenamatchplayers, arenamatchquestions, arenaplayeranswers | match_id/user_id/question theo bảng | Dữ liệu tham gia và trả lời |
| arena_db | arenaprofiles, arenaratinghistories | user_id, rating và thông tin trước/sau trận | Profile thi đấu và lịch sử rating |
| media_db | audio_jobs, asr_jobs | id UUID; state; dữ liệu đầu vào/kết quả; lease/retry theo bảng | SQL chuyên biệt cho vòng đời job |
| media_db | media_assets, system_settings | metadata media và cấu hình | Không chứa toàn bộ byte của tệp S3 |
| ai_import_db | pdf_ai_correction_events | dữ liệu phản hồi/chỉnh sửa theo pipeline | Lưu theo owner AI Import |
| notification_db | activitylogs, notifications | danh tính tham chiếu, action/category; description_key/args và thời điểm | Log và thông báo; không dùng làm bảng mật khẩu |
| Mỗi owner | outbox_events, inbox_events và bảng hạ tầng | định danh sự kiện, payload, thời điểm và trạng thái | Điều phối sự kiện và quản lý xử lý lặp |

Bảng này là từ điển thiết kế rút gọn theo những trường quan trọng, không thay thế toàn bộ DDL. Khi cần tên cột, kiểu hay index đầy đủ, sử dụng SQL migration và `database/postgres/schema-spec.json`; không tạo thêm FK chỉ vì quan hệ logic xuất hiện trong sơ đồ.

### 3.2.3. Thiết kế ERD và ràng buộc

Ở miền Content, bảng nối LessonWord thể hiện quan hệ nhiều–nhiều của bài và kho từ. FK từ lessonwords tới lessons/words ngăn liên kết mồ côi; FK composite cho section bảo đảm phần được chọn thuộc đúng bài. Dictation có ràng buộc giữa topic, section, bài và đoạn theo các migration đã bổ sung.

Ở Learning, một folder của người A không được gán cho saved word của người B. Ràng buộc composite lưu ý cả folder_id và user_id giúp bảo vệ điều kiện này ngay ở database. Khi xóa folder, service tháo liên kết theo chính sách để giữ các từ cá nhân cần giữ. Các dòng session word không được trỏ tới session không tồn tại.

Ở Assessment/Arena, lịch sử làm bài và trận có chính sách giữ dữ liệu/snapshot riêng. Không áp dụng xóa dây chuyền một cách máy móc cho mọi quan hệ. Các FK còn thiếu cần được xem xét cùng yêu cầu giữ lịch sử, backfill và dữ liệu cũ; báo cáo không khẳng định hai miền này đã chuẩn hóa quan hệ hoàn toàn.

> [CẦN VẼ — Hình 3.5] ERD Content chia hai cụm Vocabulary và Dictation. Mỗi bảng hiển thị PK, ID liên quan và các cột nghiệp vụ chính. Đường FK liền lấy từ SQL thực tế, đường quan hệ logic nét đứt có chú giải. Với lessonwords và section, ghi rõ constraint composite. Đặt publication_status/revision ở các tài nguyên có trường này.

> [CẦN VẼ — Hình 3.6] ERD Assessment gồm examgroups, exams, questions, passagegroups, passages, attempts và attemptanswers. Ghi question_snapshot và exam_snapshot là JSONB của attempt, không vẽ chúng như các bảng vật lý riêng. user_id là tham chiếu Identity. Giữ đúng FK thực có trong schema; tên migration tham khảo 0016 và 0018.

> [CẦN VẼ — Hình 3.7] ERD Learning gồm session/sessionword, review, progress, folder/savedword, activities/credit ledger và mistakes/outcomes. Nhấn UNIQUE(user_id, word_id) ở review và tính đúng chủ folder. Word/lesson/user ở ngoài khung database chỉ là tham chiếu logic. Có thể chia thành hai hình con để chữ không quá nhỏ.

> [CẦN VẼ — Hình 3.8] ERD Arena gồm room/invitation/match/player/question/answer/profile/rating history/settings; ghi status, ranked_state và runtime_policy theo implementation. Thêm khung nhỏ giải thích tham chiếu liên owner qua UUID và API/sự kiện, phân biệt với FK. Không vẽ FK liên database tới users/words.

### 3.2.4. Thiết kế truy vấn và giao dịch

Các câu SQL đưa dữ liệu đầu vào qua tham số `$1`, `$2` ở Node hoặc `%s` ở psycopg. Tên bảng/cột động chỉ được lựa chọn từ tập đã kiểm soát hoặc cơ chế ánh xạ nội bộ; không nối trực tiếp giá trị người dùng vào câu SQL. Danh sách dùng WHERE, ORDER BY ổn định và LIMIT/OFFSET hoặc giới hạn chuyên biệt theo API.

Phân trang giao diện với trang p và kích thước n dùng offset = (p − 1) × n. Server kiểm tra p/n trong khoảng cho phép và trả dữ liệu/tổng tương ứng. Khi thay đổi bộ lọc hoặc kích thước trang, client đưa trang về vị trí phù hợp. Không nhầm “có nút phân trang” với “truy vấn database đã giới hạn”; một số màn hình dùng tập nhỏ đã tải có thể chia trang tại client, còn danh sách API lớn cần page/limit phía server.

Các thao tác ghi cần đọc rồi tính giá trị mới sử dụng transaction với khóa hàng ở những đường quan trọng như review và attempt. Khi phát sinh sự kiện, ghi business state và outbox trên cùng transaction của owner đối với luồng đã tích hợp. `UPDATE ... RETURNING` cho phép lấy đúng kết quả cập nhật; `ON CONFLICT` hỗ trợ tạo duy nhất hoặc upsert theo khóa xác định.

### 3.2.5. Thiết kế xác thực và quyền truy cập

Luồng local sử dụng mật khẩu băm; helper bcrypt của dự án đặt salt rounds là 10. Access token và refresh token được quản lý theo controller/cookie riêng cho user và admin. Guard kiểm tra request ở phía server. Quyền sở hữu được kiểm tra bằng userId lấy từ danh tính đã xác thực, không tin một userId bất kỳ trong body làm căn cứ sửa dữ liệu.

Các origin được cấu hình rõ cho User/Admin; chính sách HTTP kiểm tra origin và trust proxy phù hợp môi trường. Endpoint nội bộ cần token và phạm vi role, đồng thời bị chặn ở gateway công khai. Những cơ chế này là thiết kế bảo vệ hiện có, chưa thay thế kiểm thử xâm nhập hoặc đánh giá bảo mật toàn diện.

Tệp upload có kiểm tra định dạng/nội dung cơ bản; URL media được kiểm tra scheme và trường hợp không hợp lệ. Thư viện media chỉ cho Admin đọc. Không đưa bí mật `.env`, mật khẩu, JWT hoặc token nội bộ vào hình chụp và phụ lục báo cáo.

### 3.2.6. Thiết kế giao diện người học

Giao diện tổ chức theo các khu vực học tập. Menu Dictation có nhóm thu gọn chứa bài luyện và tiến độ tương ứng. Các màn hình cùng dùng cấu trúc loading, lỗi, rỗng và có dữ liệu. Trạng thái rỗng diễn đạt rằng tải thành công nhưng chưa có dữ liệu; trạng thái lỗi có thông tin và thao tác thử lại.

Bảng 3.3. Thiết kế tương tác các màn hình người học

| Màn hình | Thông tin/đầu vào | Tương tác chính | Trạng thái cần thể hiện |
| --- | --- | --- | --- |
| Đăng nhập/tài khoản | Email, mật khẩu, thông tin xác minh | Đăng nhập local/Google theo cấu hình, khôi phục | Gửi form, dữ liệu sai, phiên không hợp lệ |
| Trang chủ | XP, hoạt động, nhịp học, gợi ý | Mở hoạt động tiếp theo, xem lịch sử | Dữ liệu mới, không có hoạt động, nguồn lỗi |
| Danh sách từ vựng | Nhóm, collection, bài, tìm kiếm | Duyệt cấu trúc và mở bài | Loading, rỗng, không còn publication |
| Phiên học/ôn | Từ, nghĩa, ví dụ, ảnh, audio | Xem/nghe, trả lời, rating và chuyển từ | Đang lưu, lưu lỗi, hoàn thành |
| Từ đã lưu/sổ lỗi | Thư mục, từ, nguồn lỗi | Tạo thư mục, lọc và ôn lại | Không có mục, nguồn đã gỡ, sai quyền |
| Dictation | Transcript ẩn theo luồng, segment/audio, tiến độ | Nghe, nhập, kiểm tra, replay, reveal | Đúng/sai, đã reveal, audio lỗi, lưu lỗi |
| TOEIC | Đề, part, câu hỏi/đoạn/audio, đồng hồ | Chọn đáp án, đánh dấu, điều hướng, nộp | Đang làm, đã reveal theo chế độ, đã nộp, xung đột |
| Arena lobby | Presence, lời mời, phòng, queue | Tạo/vào phòng, cấu hình, sẵn sàng | Chờ, đủ điều kiện, lỗi tham gia |
| Arena match | Câu hỏi/trò chơi, điểm, lượt, kết nối | Trả lời, sync và rời trận | Playing, reconnect, paused, finished |

Các màn hình phải thích ứng với mobile. Bảng rộng được cuộn trong vùng chứa khi cần, trong khi phần điều hướng và nút hành động không làm toàn trang tràn ngang. Nội dung tiếng Việt/Anh được lấy từ hệ thống locale, bao gồm lỗi và nhãn phân trang.

### 3.2.7. Thiết kế giao diện quản trị

Quản trị dùng sidebar theo miền và màn hình danh sách/chi tiết. Các danh sách tái sử dụng phong cách phân trang từ Vocabulary: số trang, dấu rút gọn, trước/sau và bộ chọn số mục khi màn hình hỗ trợ. Tổng bằng 0 phải hiển thị phạm vi 0–0, không tạo khoảng dữ liệu không tồn tại. Phân trang chỉ hỗ trợ đọc; không tự làm thay đổi các bản ghi đang chọn hoặc quyền của thao tác.

Bảng 3.4. Thiết kế tương tác các màn hình quản trị

| Màn hình | Nội dung | Tương tác và điều kiện |
| --- | --- | --- |
| Dashboard | Số liệu tổng hợp | Hiển thị lỗi khi API lỗi, không thay lỗi bằng số 0 |
| Người dùng | Danh sách, trạng thái, chi tiết, log | Tìm/phân trang; cập nhật theo quyền; phản hồi rõ |
| Vocabulary | Nhóm, collection, bài, section, từ | Tạo/sửa/liên kết; từ điển tách khỏi danh sách bài |
| Dictation | Topic/section/bài/segment, audio job | Biên tập, xử lý, theo dõi lỗi và xuất bản |
| Assessment | Nhóm đề, đề, câu, đoạn, dữ liệu import | Phân trang, chỉnh nội dung và duyệt kết quả nhập |
| Chất lượng/xuất bản | Vấn đề nội dung, kết quả kiểm tra, revision | Sửa lỗi; publish/unpublish với điều kiện server |
| Arena | Phòng, trận, cấu hình âm thanh/xếp hạng | Giám sát và can thiệp theo thao tác được hỗ trợ |
| Media | Audios/Images → miền → nội dung → tệp | Preview, phát audio, xem gốc, copy URL và vị trí dùng |

Cây media có hai gốc Audios và Images. Mỗi gốc gồm Dictation, Vocab, Games và TOEIC. Ví dụ chọn Audios → Dictation → một bài sẽ chỉ hiển thị tài nguyên audio được bài đó tham chiếu. Chuyển sang Images giữ cùng cách duyệt nhưng lọc loại ảnh. Breadcrumb và tham số URL hỗ trợ quay lại trạng thái đã chọn.

### 3.2.8. Thiết kế tĩnh theo mô-đun

Bảng 3.5. Trách nhiệm các lớp và thành phần xử lý

| Mô-đun | Thành phần thực tế tiêu biểu | Trách nhiệm |
| --- | --- | --- |
| Xác thực | AuthController, AuthService, JwtAuthGuard, DTO và refresh-cookie | Tiếp nhận thông tin, xác thực, cấp/làm mới phiên |
| Từ vựng | Các controller/service trong vocabulary; content-reader; SqlRecords | Quản trị/đọc nội dung và quan hệ bài–từ |
| Phiên học/ôn | SessionsService, ReviewsService, các row/DTO | Kiểm tra phiên/người dùng, cập nhật hành động và lịch ôn |
| Dictation | Controller/service, row lesson/segment/progress; client ASR/TTS liên quan | Chuẩn bị bài, xử lý và lưu tiến độ |
| TOEIC | Các controller/service trong assessment/attempts và helpers snapshot/clock | Tạo attempt, lưu/chấm đáp án, thời gian và kết quả |
| Arena | ArenaGateway, ArenaMatchService, ArenaRankedConnectionService, ArenaRatingService, ArenaScoringService | Sự kiện, chuyển trạng thái, reconnect, điểm và rating |
| Tiến độ/gợi ý | LearningActivity module, RecommendationsService, buildRecommendations | Tổng hợp hoạt động và tạo gợi ý giải thích được |
| Chất lượng/xuất bản | content-quality, publication, các DTO/quy tắc | Kiểm tra dữ liệu và vòng đời công bố |
| Media library | Controller theo category, MediaLibraryService | Query owner, gom asset và vị trí tham chiếu |
| Hạ tầng SQL/sự kiện | PgConnection, SqlRecords, SQL helpers, DomainOutboxService | Kết nối, giao dịch, truy vấn và ghi sự kiện |
| Worker | Python pg_store, runner/worker và media bridge | Điều phối tác vụ và cập nhật kết quả có điều kiện |

Tên lớp/hàm là căn cứ để vẽ mô hình thiết kế, không yêu cầu nhồi toàn bộ method vào một sơ đồ. Nên vẽ theo từng module, giữ các method public liên quan tới ca sử dụng chính và thể hiện dependency qua constructor injection hoặc lời gọi API. Với ranh giới dịch vụ, thể hiện interface/client thay vì giả định mọi service đều có thể gọi trực tiếp một class trong cùng tiến trình.

> [CẦN VẼ — Hình 3.9] Bộ class diagram theo module, có thể dùng 6 hình con: Auth; Vocabulary/Learning; Dictation; Assessment; Arena; Admin publication/media. Mỗi hình có Controller hoặc Gateway → Service → SQL/OwnerClient. Đặt DTO/Row cạnh service; dùng dependency, không kế thừa sai. Tra đúng method public trong source trước khi đặt tên. Với Arena thêm Scoring/Rating/RankedConnection; với media thêm category owner.

### 3.2.9. Thiết kế động theo mô-đun

Bảng 3.6. Thiết kế luồng tuần tự theo mô-đun

| Nhóm | Các đối tượng tham gia | Điểm quyết định cần thể hiện |
| --- | --- | --- |
| Auth | User/Admin UI, Gateway, Auth, Identity DB | Credential hợp lệ, cookie refresh, lỗi phiên |
| Vocabulary/Review | Web, Learning, Content owner API, Learning DB | Publication, chủ sở hữu, khóa review, lịch mới |
| Dictation | Admin/Web, Content, Media Jobs, queue, TTS/ASR, storage | Job thành công/thất bại, biên tập, lưu progress |
| Assessment | Web, Gateway, Assessment, Assessment DB, outbox | Snapshot/revision, lưu đồng thời, trạng thái submit |
| Arena | Hai client, ArenaGateway, match service, Redis/Arena DB | Thành viên, trạng thái, payload riêng, reconnect/sync |
| Publication/Media/Import | Admin, owner, media bridge, storage hoặc PDF worker | Vai trò Admin, validation, giới hạn danh sách, đầu ra nháp |

> [CẦN VẼ — Hình 3.10] Hai sequence con: đăng nhập local và refresh. Đăng nhập: UI → AuthController → AuthService → users/admins → kiểm tra hash → tạo token/cookie → response. Refresh: UI gửi cookie → kiểm tra → response access token/cookie theo implementation. Dùng alt cho sai thông tin, cookie thiếu/hết hạn. Không vẽ cookie HttpOnly được JavaScript đọc trực tiếp.

> [CẦN VẼ — Hình 3.11] Sequence ôn từ: Web → ReviewsService → Content owner kiểm tra publication → Learning transaction: INSERT ON CONFLICT nếu cần, SELECT FOR UPDATE, tính lịch, UPDATE, ghi outcome → COMMIT → response. Nhánh lỗi rollback. Thêm hình con session học với SessionsService nếu cần bao quát UC-02. Giữ hai database tách nhau, không vẽ transaction phân tán giả.

> [CẦN VẼ — Hình 3.12] Hai sequence Dictation: (a) Admin tạo job → Media Jobs/RabbitMQ → worker → TTS hoặc ASR → Media Bridge/S3 → cập nhật qua owner → Admin duyệt; (b) Web lấy lesson/progress → nghe đoạn → gửi kết quả/replay/reveal → Content transaction → trả progress. Chú thích audio phát từ media URL và transcript cần duyệt.

> [CẦN VẼ — Hình 3.13] Sequence tạo/lưu/nộp attempt. Hiển thị snapshot lúc tạo; hai client request lưu khác câu đi tới transaction và khóa/điều kiện cập nhật; submit kiểm tra owner/status, chấm theo snapshot, ghi kết quả/outbox → COMMIT. Alt đã nộp, sai owner, snapshot không hợp lệ. Không đưa correctAnswer vào response làm bài chỉ để vẽ tiện.

> [CẦN VẼ — Hình 3.14] Sequence Arena gồm 2 client, Gateway, match/connection service, Redis và Arena DB. Nhánh join/ready/start/answer, kết quả riêng và broadcast chung; nhánh disconnect → PAUSED theo policy → reconnect/authenticate → snapshot → match-synced → tiếp tục hoặc kết thúc. Lấy tên event từ ArenaGateway như match:answer, match:answer-result, arena:match-sync, arena:match-synced. Tránh tự tạo tên event khác source.

> [CẦN VẼ — Hình 3.15] Ba sequence con: (a) Admin validate/publish → owner DB/audit/revision; (b) Admin chọn loại/category/item → controller owner → query tham chiếu → trả assets/usages → browser GET media qua bridge/S3; (c) PDF import → queue/worker → tạo dữ liệu/media nháp → Admin duyệt. Không vẽ thao tác xóa S3 hoặc xuất bản tự động nếu luồng hiện tại không hỗ trợ.

## 3.3. Kiểm thử và thực nghiệm

### 3.3.1. Mục tiêu và phạm vi thực nghiệm

Thực nghiệm kiểm tra tính đúng đắn của các chức năng quan trọng và cơ chế phối hợp giữa thành phần. Các câu hỏi chính gồm: dữ liệu có lưu đúng qua transaction không; quyền sở hữu và publication có được thực thi không; các cập nhật cạnh tranh có làm mất kết quả không; frontend có hiển thị đúng khi API lỗi; và người chơi có nhận, đồng bộ trạng thái realtime như dự kiến không.

Báo cáo dùng các bằng chứng đã lưu trong repository. Không thực hiện một chiến dịch benchmark hoặc đánh giá người học mới chỉ để có số liệu trình bày. Các kết quả bên dưới được gắn nguồn và phạm vi; không cộng các suite có thể chồng lặp thành một “tổng số test toàn hệ thống” thiếu ý nghĩa.

### 3.3.2. Dữ liệu và môi trường thực nghiệm

**Dữ liệu SQL.** Các kiểm thử tích hợp dùng PostgreSQL 17 tạm với schema/migration của các owner và fixture biệt lập. Bộ kiểm tra quan hệ tạo trường hợp cha hợp lệ, bản ghi mồ côi, section sai bài và folder sai người. Hai probe query plan dùng 5.000 dòng fixture cho mỗi hướng truy vấn được ghi trong audit. Dữ liệu fixture không được diễn giải thành số học liệu/người dùng thật.

**Dữ liệu giao diện.** Bộ fixture tạo phản hồi API có các tình huống có dữ liệu, rỗng, lỗi và nhiều trang. Ví dụ danh sách Dictation có 23 bản ghi để kiểm tra chuyển trang và đổi số mục. Đây là dữ liệu giả lập cho kiểm thử UI, không chứng minh danh sách đó đang có trong database đang vận hành.

**Dữ liệu live.** Các lượt kiểm thử Docker/Chrome tạo tài khoản và nội dung QA biệt lập qua API quản trị, sử dụng chúng cho phòng, lời mời, game và Rank. Khi dữ liệu từ đã xuất bản không đủ cho chế độ cần kiểm tra, script bổ sung bộ từ QA qua quy trình validate/publish thật. Sau lượt chạy, tài khoản/nội dung được xóa mềm hoặc thu hồi theo API; lịch sử trận và audit được giữ theo chính sách.

**Môi trường.** Báo cáo UI ghi desktop 1440×1000 và mobile 390×844, frontend build production, Chrome tự động hóa và backend/gateway Docker. Báo cáo không có thông số CPU/RAM/GPU đầy đủ cho mọi lượt nên không suy ra khả năng chịu tải theo cấu hình phần cứng. Các tác vụ ASR/TTS có cấu hình CPU/CUDA, nhưng chưa có benchmark so sánh hai chế độ được sử dụng trong kết quả này.

### 3.3.3. Phương pháp và ma trận kiểm thử

Bảng 3.7. Ma trận kiểm thử và điều kiện đạt

| Nhóm/yêu cầu | Tình huống | Kết quả mong đợi | Loại bằng chứng |
| --- | --- | --- | --- |
| FR-01, NFR-01 | Thiếu/sai token, sai vai trò, phiên hết điều kiện | Từ chối phù hợp, không lộ dữ liệu/mật khẩu | Unit/API/role tests |
| FR-02, FR-15 | Tài nguyên nháp, gỡ công bố, quan hệ sai | User không đọc sai publication; constraint chặn quan hệ không hợp lệ | SQL/publication tests |
| FR-03/04, NFR-02 | Hai cập nhật review/session cạnh tranh | Bộ đếm/lịch không bị ghi đè từ dữ liệu cũ | PostgreSQL nhiều kết nối |
| FR-05 | Folder thuộc user khác, mở lỗi của người khác | Từ chối, không gán chéo người | FK/owner tests |
| FR-06/07 | Replay, reveal, lỗi job, mở lại bài | Lưu đúng tiến độ và trạng thái, có phục hồi lỗi | Unit/SQL/UI |
| FR-08/09 | Lưu đáp án song song, sửa TEST, reveal PRACTICE, submit lặp | Giữ đủ đáp án; khóa đúng trạng thái; kết quả nhất quán | PostgreSQL concurrency |
| FR-11 | Join/ready/start/answer, lời mời và Admin đóng phòng | Hai/ba trình duyệt nhận đúng thay đổi | Chrome + socket thật |
| FR-12 | Mất mạng, sync lại, rời trận | Khóa UI, đồng bộ hoặc kết thúc theo policy | Live ranked suite |
| FR-13/14 | Có dữ liệu, chưa đủ mẫu, một nguồn lỗi | Không khẳng định yếu điểm thiếu căn cứ; tách lỗi khỏi số 0 | Rules/API/UI tests |
| FR-16 | Hai loại media, bốn miền, URL trùng, sai quyền | Đúng tham chiếu; gom trùng giữ usages; chỉ Admin đọc | SQL/browser media suite |
| FR-18, NFR-06 | 23 mục, đổi trang/kích thước, mobile, hai ngôn ngữ | Số mục và trạng thái đúng; không tràn ngang toàn trang | UI regression |
| NFR-03 | Tham số SQL, giới hạn trang và query plan | Không dùng filter document; limit/plan đúng ở ca kiểm chứng | Source audit/EXPLAIN |

Kiểm thử hộp đen được dùng cho hành vi API/UI; kiểm thử theo cấu trúc được dùng cho quy tắc, SQL và migration. Fault injection tạo lỗi API có chủ đích để kiểm tra hồi phục, sau đó nút Retry lấy lại dữ liệu từ backend thật trong các ca recovery. Kiểm thử WebSocket dùng transport ứng dụng thật ở các bộ live, không thay event server bằng dữ liệu tự phát từ script.

### 3.3.4. Kết quả chuyển đổi và kiểm chứng PostgreSQL

Bảng 3.8. Kết quả kiểm chứng PostgreSQL đã được lưu trong dự án

| Nội dung | Kết quả được ghi nhận | Nguồn/phạm vi |
| --- | --- | --- |
| Rà soát đường chạy Mongo-style | 341 file TS runtime và 30 file Python; 0 vi phạm theo bộ quy tắc audit | POSTGRES_NATIVE_AUDIT.json |
| Nhóm model chuyển đổi | 40 model, 116 vị trí injection cũ đã chuyển | POSTGRES_NATIVE_REFACTOR_STATUS_VI.md |
| Unit/Vitest backend | 247 PASS, 0 FAIL, 52 SKIP ở lượt không cấu hình một số DB ngoài | Trạng thái refactor ngày 29/10/2026 |
| Tích hợp PostgreSQL 17 mở rộng | 194 PASS | Bộ tích hợp riêng được mô tả trong trạng thái refactor |
| Contract dữ liệu | 41 row contract có yêu cầu cột gốc tương ứng | Trạng thái refactor/schema contracts |
| Quan hệ/backfill/query plan | 9 kiểm tra được ghi nhận đạt | POSTGRES_RELATIONAL_AUDIT.json |
| FK và schema reference | 138 bảng, 31 FK, 0 FK chưa validate | Tổng theo 8 owner trong relational audit |
| Payload extension | 66 bảng reference có cột payload | Relational audit; gồm bảng hạ tầng/projection theo owner |
| Kiểm chứng plan | Hai hướng truy vấn có fixture 5.000 dòng và sử dụng index | Plan JSON của lesson words và attempt revision |
| Python job stores | SQL trực tiếp; bộ riêng ghi 6 PASS, có 20 cập nhật đồng thời | Trạng thái refactor ngày 29/10/2026 |

Audit xác nhận không còn import compat/driver Mongo, model injection, toán tử/phương thức document và schema cũ trong phạm vi runtime mà script quét. Đây là kết quả theo quy tắc tĩnh, không chứng minh mọi truy vấn đã tối ưu. Việc giữ các cột JSONB hoặc khóa response `_id` không làm phủ định SQL native, nhưng cũng không chứng minh schema đã chuẩn hóa hoàn toàn.

Kết quả FK cho thấy hệ thống có cơ chế chặn một số dạng dữ liệu mồ côi và quan hệ sai cha. Các migration kiểm tra trước dữ liệu lỗi, rollback và giữ nguyên dữ liệu khi không thể áp dụng an toàn. Hai query plan có index là bằng chứng cục bộ cho hai truy vấn và tập fixture cụ thể, không phải số đo thời gian phản hồi của toàn ứng dụng.

Các số 247 và 194 thuộc các cách chạy có điều kiện khác nhau; một phần phạm vi có thể trùng nhau. Do vậy không cộng chúng thành 441 test độc lập hoặc dùng số SKIP như test đã đạt. Tương tự, trạng thái audit database tạm không tự chứng minh mọi migration đã áp dụng trên một volume triển khai bất kỳ.

### 3.3.5. Kết quả kiểm thử giao diện và WebSocket

Bảng 3.9. Kết quả kiểm thử giao diện và WebSocket ngày 29/10/2026

| Bộ kiểm thử Chrome | PASS | FAIL | Tính chất dữ liệu/giao tiếp |
| --- | --- | --- | --- |
| Hồi quy UI, phân trang và menu mobile | 22 | 0 | API fixture; không dùng để chứng minh tích hợp backend |
| Backend thật, phòng, lời mời và Admin đóng phòng | 25 | 0 | Backend Docker và Socket.IO thật |
| Word Guess, Word Chain, Classic, phòng ba người | 12 | 0 | Game và socket thật, có chuẩn bị dữ liệu QA |
| Gây lỗi 503 rồi Retry | 11 | 0 | Lỗi đọc có chủ đích, Retry lấy lại backend thật |
| Rank: ghép trận, đáp án, mất mạng, sync, rời | 9 | 0 | Hai tài khoản, trận và socket thật |
| Tổng của chiến dịch được báo cáo | 79 | 0 | Chỉ tổng 5 bộ ở bảng này |

Nguồn là `UI_QA_REPORT_VI.md` và `UI_QA_AUDIT.json`. Hai frontend build production cùng kiểm tra TypeScript được ghi nhận đạt. Báo cáo không ghi nhận JavaScript exception không được bắt trong các lượt cuối. Trạng thái thất bại ở baseline là 4 ca thuộc 3 nhóm lỗi; sau sửa, những ca hồi quy tương ứng đạt trong chiến dịch này.

Các lỗi tiêu biểu gồm API thất bại bị hiển thị thành danh sách rỗng/số 0; trang chi tiết Dictation loading mãi khi lesson không tải được; và phân trang rỗng hiển thị 0–10/0. Cách sửa tách loading/error/empty, thêm Retry và xử lý total = 0 bằng điều kiện rõ. Các ca recovery kiểm tra sau Retry có phản hồi HTTP 200 từ backend thật, thay vì chỉ đóng thông báo lỗi.

Ở realtime, kiểm thử ghi nhận cập nhật thành viên và sẵn sàng giữa nhiều trình duyệt, lời mời chấp nhận/từ chối, Admin đóng phòng, game nhiều người và reconnect. Đối với Rank, script đi qua queue, vào cùng trận, trả lời, mất mạng, tạm dừng/đồng bộ rồi tiếp tục hoặc rời trận. Một số thao tác chuẩn bị và dọn dữ liệu dùng ACK trên transport thật của ứng dụng; do đó không mô tả toàn bộ 79 ca là thao tác chuột thuần túy.

### 3.3.6. Thư viện media và phân trang quản trị

Mã nguồn có bộ `tests/media-library.postgres.cjs` với 21 kiểm tra SQL trên ba owner và `tests/media-library.browser.cjs` với 10 kiểm tra trình duyệt/live stack, bao gồm vai trò, tham số, phân trang, ảnh, WAV, clipboard, mobile và recovery. README của Media Bridge ghi nhận các lượt kiểm chứng này. Chúng là chiến dịch riêng, không nằm trong tổng 79 ở Bảng 3.9. Trước khi dùng các ảnh/kết quả của một lượt cụ thể khi bảo vệ, cần giữ hoặc tạo lại báo cáo gốc trong môi trường QA.

Phân trang Admin hiện dùng chung thành phần giao diện Vocabulary hoặc adapter của thành phần đó. Các màn hình có thể giữ page size và cách lấy dữ liệu riêng nhưng thống nhất cách hiển thị nút số, dấu rút gọn và trước/sau. Việc tái sử dụng giảm sai lệch giao diện; kiểm chứng vẫn cần kiểm tra số mục thực nhận, reset trang khi đổi size và vị trí item sau chỉnh sửa. Không lấy số lượng component được tái sử dụng làm bằng chứng tốc độ truy vấn.

### 3.3.7. Phân tích kết quả

Các kết quả cho thấy những luồng được kiểm tra đã xử lý đúng điều kiện và dữ liệu thử. Sự kết hợp unit, PostgreSQL thật và Chrome giúp phát hiện lỗi ở nhiều lớp: luật tính toán; ràng buộc dữ liệu và tranh chấp; hiển thị lỗi/phân trang; phối hợp realtime. Quá trình sửa API contract và chuyển SQL làm rõ trách nhiệm owner, trong khi snapshot và transaction bảo vệ các dữ liệu lịch sử và kết quả quan trọng.

Các kết quả này chưa đủ để tuyên bố hệ thống không còn lỗi. Phạm vi 79 ca chủ yếu bao phủ các tình huống giao diện/realtime được lựa chọn; 0 FAIL không tương đương bao phủ toàn bộ nhánh chương trình. Các báo cáo runtime trước đây cũng không thay thế chạy lại trên bản build và dữ liệu mới trước khi bàn giao.

### 3.3.8. Giới hạn thực nghiệm và nguy cơ ảnh hưởng kết luận

Bảng 3.10. Giới hạn của thực nghiệm và công việc bổ sung

| Giới hạn | Ảnh hưởng | Hướng bổ sung |
| --- | --- | --- |
| Fixture nhỏ và có kiểm soát | Chưa phản ánh phân bố dữ liệu vận hành | Tạo tập dữ liệu đại diện, nhiều kích thước và độ lệch |
| Chưa có benchmark tải toàn hệ thống | Không kết luận p95/throughput/số người đồng thời | Kịch bản tải HTTP/socket/job, ghi phần cứng và metrics |
| Một số suite có SKIP | Không tính các ca đó là đạt | Cấu hình dependency để chạy và lưu log |
| Chỉ có hai probe query plan | Không đại diện mọi query | Mở rộng truy vấn nóng, index và thống kê bằng dữ liệu gần thực tế |
| ASR/TTS chưa có đánh giá chất lượng đại diện | Không kết luận transcript/giọng nói luôn tốt | Tập audio nhiều giọng/tiếng ồn, WER và đánh giá nghe phù hợp |
| Chưa có thực nghiệm người học trước–sau | Không kết luận hiệu quả sư phạm | Thiết kế nghiên cứu, đồng ý tham gia và chỉ số đánh giá |
| Chưa kiểm thử bảo mật/khôi phục toàn diện | Chưa có bằng chứng chịu tấn công hoặc phục hồi thảm họa | Rà quyền, upload, token, backup và diễn tập restore |
| Báo cáo kiểm thử có mốc lịch sử | Có thể khác trạng thái triển khai hiện tại | Ghi commit, migration và chạy hồi quy trước bàn giao |

Độ tin cậy của kết luận được tăng bằng việc lưu script, dữ liệu fixture và báo cáo có phạm vi. Những bảng trong báo cáo giữ nguyên sự phân biệt giữa phân tích thiết kế, chức năng hiện có, kết quả đã ghi nhận và đề xuất tương lai.

<!-- PAGEBREAK -->

# KẾT LUẬN VÀ KIẾN NGHỊ

## Kết quả đạt được

Đề tài đã xây dựng sản phẩm VocaLearn với hai giao diện người học và quản trị. Các chức năng chính gồm tổ chức học liệu, học/ôn từ vựng, Dictation, luyện TOEIC, Arena/minigame, tiến độ, sổ lỗi và gợi ý dựa trên luật. Phía quản trị hỗ trợ quản lý nội dung, quy trình chất lượng/xuất bản, tài khoản, cấu hình và thư viện media theo loại tệp rồi tới nội dung sử dụng.

Về thiết kế, hệ thống phân chia trách nhiệm theo tám miền dữ liệu, sử dụng PostgreSQL trực tiếp, giữ snapshot cho dữ liệu lịch sử quan trọng và áp dụng transaction/khóa/điều kiện cập nhật ở những luồng cạnh tranh. Các thành phần xử lý âm thanh được tích hợp qua dịch vụ và công việc nền. Cấu hình Docker hỗ trợ CPU mặc định và lựa chọn CUDA rõ ràng khi môi trường đáp ứng.

Về kiểm chứng, repository lưu kết quả rà soát SQL native, kiểm thử quan hệ và backfill, các bộ PostgreSQL tích hợp và chiến dịch 79 kiểm tra giao diện/WebSocket. Những bằng chứng này hỗ trợ kết luận rằng các tình huống đã chạy đạt yêu cầu tương ứng, đồng thời chỉ rõ phạm vi chưa được đánh giá. Đóng góp thực hành của đồ án là gắn việc xây dựng chức năng với contract, dữ liệu, kiểm thử và công cụ quản trị có thể đối chiếu trong mã nguồn.

## Hạn chế

Thiết kế quan hệ chưa hoàn toàn chuẩn hóa trên mọi miền; payload JSONB extension và một số quan hệ cần tiếp tục rà soát. Việc phân chia dịch vụ làm tăng chi phí vận hành, cấu hình và phục hồi lỗi. Chưa có đủ dữ liệu để đánh giá toàn diện tải đồng thời, chất lượng ASR/TTS, mức cải thiện học tập hoặc khả năng khôi phục khi nhiều thành phần cùng lỗi. Gợi ý học hiện là bộ luật, còn điểm TOEIC chỉ mang tính tham khảo.

Thư viện media phản ánh các tham chiếu hiện tại và hỗ trợ xem tài nguyên, chưa là hệ thống quản lý vòng đời toàn bucket. Các nội dung nháp/đầu ra AI vẫn cần người quản trị duyệt. Bộ kiểm thử được lưu cần tiếp tục cập nhật khi API, giao diện hoặc migration thay đổi.

## Kiến nghị và hướng phát triển

Hướng ưu tiên là củng cố các quan hệ dữ liệu còn thiếu theo chính sách giữ lịch sử; mở rộng đo đạc truy vấn nóng và kiểm thử cạnh tranh; chuẩn hóa quan sát vận hành, retry và đối soát sự kiện. Trước khi triển khai công khai cần kiểm thử bảo mật, sao lưu/khôi phục và giới hạn sử dụng tài nguyên cho upload, job và kết nối realtime.

Về học tập, có thể nghiên cứu lập lịch cá nhân hóa dựa trên dữ liệu đủ lớn, đánh giá gợi ý bằng thực nghiệm người dùng và đo chất lượng nhận dạng/tổng hợp giọng nói bằng tập kiểm tra có tiêu chí. Các hướng này cần được triển khai như công việc nghiên cứu tiếp theo, không đưa vào danh sách kết quả đã hoàn thành của phiên bản hiện tại.

Về quản trị, có thể bổ sung đối soát tệp không còn được tham chiếu, lịch sử sử dụng media, dung lượng và công cụ dọn có kiểm soát. Về quy trình phát triển, nên tự động hóa kiểm thử contract, migration và các luồng trình duyệt quan trọng trong CI trên môi trường biệt lập, lưu kèm phiên bản nguồn và artifact để kết quả có thể tái lập.

<!-- PAGEBREAK -->

# TÀI LIỆU THAM KHẢO

[1] N. J. Cepeda, H. Pashler, E. Vul, J. T. Wixted và D. Rohrer, “Distributed Practice in Verbal Recall Tasks: A Review and Quantitative Synthesis,” Psychological Bulletin, tập 132, số 3, tr. 354–380, 2006. DOI: 10.1037/0033-2909.132.3.354. Bản tác giả: https://www.evullab.org/pdf/CepedaPashlerVulWixtedRohrer-PB-2006.pdf.

[2] H. L. Roediger III và J. D. Karpicke, “Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention,” Psychological Science, tập 17, số 3, tr. 249–255, 2006. DOI: 10.1111/j.1467-9280.2006.01693.x. Thông tin bài gốc: https://pubmed.ncbi.nlm.nih.gov/16507066/.

[3] Anki, “Background,” Anki Manual. https://docs.ankiweb.net/manual/background. Truy cập ngày 07/11/2026.

[4] H5P, “Dictation Tutorial.” https://h5p.org/tutorial-dictation. Truy cập ngày 07/11/2026.

[5] A. Radford, J. W. Kim, T. Xu, G. Brockman, C. McLeavey và I. Sutskever, “Robust Speech Recognition via Large-Scale Weak Supervision,” arXiv:2212.04356, 2022. https://arxiv.org/abs/2212.04356.

[6] SYSTRAN, “faster-whisper.” Kho mã nguồn và tài liệu chính thức. https://github.com/SYSTRAN/faster-whisper. Truy cập ngày 07/11/2026.

[7] Vercel, “Next.js Documentation.” https://nextjs.org/docs. Truy cập ngày 07/11/2026.

[8] NestJS, “Documentation.” https://docs.nestjs.com/. Truy cập ngày 07/11/2026.

[9] PostgreSQL Global Development Group, “PostgreSQL 17 Documentation — Constraints.” https://www.postgresql.org/docs/17/ddl-constraints.html. Truy cập ngày 07/11/2026.

[10] RabbitMQ, “Work Queues — Python Tutorial.” https://www.rabbitmq.com/tutorials/tutorial-two-python. Truy cập ngày 07/11/2026.

[11] Socket.IO, “Delivery Guarantees,” tài liệu phiên bản 4.x. https://socket.io/docs/v4/delivery-guarantees/. Truy cập ngày 07/11/2026.

[12] VocaLearn, Mã nguồn sản phẩm, docker-compose.yml và các entrypoint dịch vụ trong apps/api/src/entrypoints. Tài liệu nội bộ của đồ án, đối chiếu ngày 07/11/2026.

[13] VocaLearn, POSTGRES_NATIVE_REFACTOR_STATUS_VI.md, POSTGRES_NATIVE_AUDIT.json và POSTGRES_RELATIONAL_AUDIT.json. Tài liệu kiểm chứng nội bộ, trạng thái refactor ngày 29/10/2026.

[14] VocaLearn, UI_QA_REPORT_VI.md và UI_QA_AUDIT.json. Báo cáo kiểm thử giao diện và WebSocket ngày 29/10/2026.

[15] VocaLearn, services/media-bridge/README.md, tests/media-library.postgres.cjs và tests/media-library.browser.cjs. Tài liệu và công cụ kiểm thử quản lý media, đối chiếu ngày 07/11/2026.

<!-- PAGEBREAK -->

# PHỤ LỤC A. CÀI ĐẶT VÀ TRIỂN KHAI

## A.1. Thiết lập môi trường

Chuẩn bị mã nguồn và một môi trường Docker hoạt động. Trên Windows, Docker Desktop cần được cấu hình phù hợp với backend chạy container Linux; chế độ GPU cần driver và hỗ trợ GPU trong Docker/WSL2 theo hướng dẫn Docker/NVIDIA hiện hành. Không yêu cầu CUDA cho lệnh CPU mặc định.

Nếu chạy các ứng dụng Node trực tiếp trên host, sử dụng Node.js từ 24 trở lên và pnpm phù hợp với packageManager trong package.json. Các dịch vụ Python được đóng gói theo requirements/Dockerfile riêng. Cấu hình tập trung ở file `.env` tại root, không tự tạo nhiều `.env` với giá trị khác nhau ở các service.

Không công bố `.env` thật trong repository hoặc phụ lục. Bản cài đặt cần khai báo các nhóm cấu hình: mật khẩu PostgreSQL owner, JWT và token nội bộ, Redis/RabbitMQ, S3, URL User/Admin, email/OAuth nếu dùng, ASR/TTS và profile tùy chọn. Các giá trị phải được người triển khai cung cấp; báo cáo không chèn credential đã có của môi trường phát triển.

## A.2. Cài đặt bằng Docker Compose ở chế độ CPU

Thực hiện tại root repository trong PowerShell:

```powershell
Copy-Item .env.example .env
# Điền cấu hình hợp lệ trong .env trước khi chạy tiếp.
docker compose config --quiet
docker compose up -d --build
docker compose ps -a
```

Không ghi đè `.env` đã cấu hình khi nâng cấp. PostgreSQL khởi tạo database trên volume mới; service `schema-migrate` áp dụng migration trước khi các ứng dụng phụ thuộc bắt đầu. Dữ liệu hiện có cần sao lưu và kiểm tra chuỗi migration, không xóa volume để né lỗi schema. Admin bootstrap mặc định có kiểm soát; đọc cấu hình seed trước khi bật và sử dụng công cụ `seed-admin.mjs` theo trợ giúp của phiên bản nguồn nếu cần tạo quản trị viên.

Bảng A.1. Địa chỉ truy cập trong môi trường phát triển

| Thành phần | Địa chỉ mặc định | Ghi chú |
| --- | --- | --- |
| Web người học | http://localhost:3000 | Route có locale, ví dụ /vi và /en |
| Web quản trị | http://localhost:3001 | Đăng nhập bằng tài khoản Admin |
| API Gateway | http://localhost:5000 | Cổng dùng cho các API công khai theo route |
| Media công khai | http://localhost:5000/media/... | URL có key cụ thể; không phải màn hình duyệt bucket |
| TTS health | http://localhost:8001/health | Phụ thuộc mapping của Compose đang dùng |
| ASR health | http://localhost:8002/health | Phụ thuộc mapping của Compose đang dùng |
| Admin media library | http://localhost:3001/vi/media | Chỉ hiển thị sau xác thực đúng vai trò |

Các port là mặc định từ dự án. Khi triển khai máy chủ thật cần thay origin/domain, TLS và chính sách cookie/proxy phù hợp; không mặc định cấu hình localhost là cấu hình production hoàn chỉnh.

## A.3. Chạy CUDA có chọn lọc

Chỉ bật service cần GPU trong `.env`, ví dụ:

```dotenv
ASR_DEVICE=cuda
ASR_COMPUTE_TYPE=float16
KOKORO_DEVICE=cuda
TORCH_VERSION=2.7.1
TORCH_CUDA_VARIANT=cu126
```

```powershell
node scripts/docker-up.mjs --cuda --check
node scripts/docker-up.mjs --cuda
# Hoặc để wrapper tự chọn theo .env:
pnpm dev:docker:auto
```

Lệnh `docker compose up -d --build` cơ bản luôn chọn CPU cho ASR/TTS theo cấu hình hiện tại. Wrapper CUDA thêm các override tương ứng cho từng service và kiểm tra GPU trước khi build. Nếu chỉ một service đặt cuda, service còn lại giữ CPU. Tham khảo DOCKER.md để xem lệnh tương đương và cấu hình hỗ trợ.

TTS tách layer cài Torch/TorchAudio và kiểm tra phiên bản/biến thể; BuildKit cache giúp tránh tải lại khi chỉ thay đổi code và cache vẫn tồn tại. Cache model và cache package có vòng đời khác nhau; không tuyên bố mọi lần build đều không cần Internet. ASR dùng faster-whisper/CTranslate2, không yêu cầu PyTorch chỉ để chạy nhận dạng.

## A.4. Kiểm tra sau triển khai

```powershell
docker compose logs --tail 100 schema-migrate identity-service content-service
Invoke-RestMethod http://localhost:8001/health
Invoke-RestMethod http://localhost:8002/health
node scripts/check-gateway-contract.cjs
node scripts/check-client-gateway-routes.cjs
node scripts/audit-postgres-native.cjs --check-complete
```

Kiểm tra đăng nhập User/Admin, mở một bài từ vựng, lưu tiến độ, mở Dictation, tạo/lưu/nộp một attempt thử và kết nối Arena. Các bài kiểm thử live có thể tạo dữ liệu QA và lịch sử; cần đọc script, dùng môi trường phù hợp và dọn theo quy trình. Không chạy thử các thao tác tạo/xóa dữ liệu trên môi trường thật chỉ để hoàn thiện hình báo cáo.

Với nâng cấp quan hệ, có thể kiểm tra dữ liệu mồ côi bằng `node scripts/check-postgres-relations.mjs --all`, sau đó dùng quy trình migration với credential được cấu hình. Khi phát hiện orphan, cần xử lý có chủ đích; không sửa số liệu hoặc xóa dữ liệu để migration chạy qua mà không có đánh giá.

## A.5. Bàn giao và sao lưu

Mã nguồn cần đi kèm hướng dẫn cấu hình không có bí mật, Dockerfile/Compose, migration, script kiểm thử và phiên bản build đã dùng. Sao lưu phải bao gồm cả PostgreSQL và object storage vì URL trong database không tự khôi phục được byte tệp. Cần kiểm tra khả năng restore trên môi trường biệt lập trước khi xem bản sao lưu là sử dụng được.

Các sản phẩm nộp theo khung gồm: file UML, source code và bản build/cài đặt phù hợp, slide và báo cáo, video giới thiệu sản phẩm đang chạy. URL repository, tag/commit bàn giao, file slide và video để trống cho đến khi có artifact thực tế; không ghi rằng đã nộp hoặc đã upload khi chưa thực hiện.

Repository/phiên bản bàn giao: ................................................................

Liên kết file UML: ..................................................................................

Liên kết bản build: ..................................................................................

Liên kết slide: ........................................................................................

Liên kết video: ........................................................................................

<!-- PAGEBREAK -->

# PHỤ LỤC B. HÌNH ẢNH SẢN PHẨM

Các vị trí sau dành cho ảnh chụp bản build sử dụng khi bảo vệ. Nên chụp dữ liệu minh họa hợp lệ và che email, thông tin cá nhân không cần thiết. Không dùng hình mô phỏng để khẳng định chức năng đã chạy thật. Mỗi ảnh nên có chú thích nêu thao tác hoặc trạng thái đang minh họa.

> [CẦN CHỤP — Hình B.1] Màn hình đăng nhập User và trang chủ sau đăng nhập; minh họa XP, hoạt động gần đây và gợi ý. Nếu tài khoản chưa có dữ liệu, tạo dữ liệu QA đúng quy trình hoặc giữ trạng thái rỗng thật, không sửa ảnh để thêm số liệu.

> [CẦN CHỤP — Hình B.2] Ba hình con: bài từ vựng có ảnh/audio; trang ôn với bốn mức rating; sổ lỗi hoặc thư mục từ đã lưu. Ghi tên nội dung minh họa, không đưa mật khẩu/token.

> [CẦN CHỤP — Hình B.3] Bài Dictation với các đoạn, điều khiển nghe và câu trả lời; màn hình tiến độ; menu Dictation đang mở chứa hai mục. Có thể dùng hai trạng thái trước/sau một câu để giải thích phản hồi.

> [CẦN CHỤP — Hình B.4] Màn hình làm TOEIC và kết quả cùng attempt QA. Chú thích rõ chế độ, số câu và “điểm ước lượng” nếu có; không chú thích như chứng chỉ TOEIC thật.

> [CẦN CHỤP — Hình B.5] Hai client cùng phòng Arena, trạng thái ready, màn hình trận và trạng thái reconnect nếu cần. Ghi rõ loại game/chế độ; tránh dùng ảnh lobby để chứng minh trận đã kết thúc.

> [CẦN CHỤP — Hình B.6] Dashboard Admin và một danh sách nhiều trang. Cần thấy số trang, dấu … khi đủ trang, nút trước/sau và tổng số mục đúng. Chọn dữ liệu QA hoặc nội dung không nhạy cảm.

> [CẦN CHỤP — Hình B.7] Màn hình biên tập bài/đề và kiểm tra publication. Minh họa thông báo validation và trạng thái sau thao tác phù hợp; không chỉ chụp toast mà thiếu tài nguyên liên quan.

> [CẦN CHỤP — Hình B.8] Cây Audios/Images với bốn nhóm con. Chụp một nội dung có audio đang phát và một nội dung có ảnh preview; có vị trí sử dụng hoặc URL. Không thay ảnh này bằng giao diện liệt kê raw S3 bucket.

> [CẦN CHỤP — Hình B.9] Giao diện mobile 390×844 và trạng thái lỗi/Retry tiếng Việt hoặc Anh. Nếu lỗi được tạo bằng công cụ QA, ghi rõ là tình huống thử lỗi có chủ đích.

<!-- PAGEBREAK -->

# PHỤ LỤC C. ĐỐI CHIẾU NỘI DUNG VỚI MÃ NGUỒN

Bảng C.1. Đối chiếu nội dung báo cáo với mã nguồn và bằng chứng

| Nội dung | Vị trí đối chiếu trong repository | Lưu ý sử dụng |
| --- | --- | --- |
| Hai ứng dụng giao diện | apps/web; apps/admin-web; package.json của từng app | Manifest mô tả version khai báo, không chứng minh build đang chạy |
| Tám backend role | apps/api/src/entrypoints/*.ts; docker-compose.yml | Không dùng AppModule rỗng để suy ra composition root |
| Owner dữ liệu | apps/api/src/postgres/ownership.ts; database/postgres/migrations | Không sử dụng read-model generic cũ trong tài liệu lịch sử như contract hiện tại |
| Pool/giao dịch/SQL | apps/api/src/postgres/connection.ts, sql.ts, records.ts | JSONB extension vẫn tồn tại; không ghi “toàn bộ JSONB đã xóa” |
| Mật khẩu và phiên | apps/api/src/common/bcrypt.ts; modules/auth; refresh-cookie.ts | Không lấy việc có dependency argon2 để khẳng định mọi mật khẩu dùng Argon2 |
| Nội dung từ vựng | modules/vocabulary; rows và service; migrations/content | LessonWord là bảng liên kết với kho từ dùng chung |
| Lịch ôn | modules/learning/reviews/reviews.service.ts; sessions/sessions.service.ts | Bộ luật riêng, mô tả đúng HARD và ngưỡng MASTERED |
| Dictation | modules/dictation; services/asr-service; services/tts-service | Phân biệt status xử lý và publicationStatus |
| TOEIC | modules/assessment/attempts; packages/shared-types/src/toeic-score.mjs | Snapshot và điểm ước lượng; không khẳng định đã hỗ trợ đủ IELTS chỉ từ enum |
| Arena | modules/arena/gateways, matches, friendly, scoring, rating | Lấy đúng event/enum/transition theo chế độ |
| XP và hoạt động | modules/learning-activity; packages/shared-types/src/learning-xp.mjs | Phân biệt credit chống lặp với bảo đảm exactly once toàn hệ thống |
| Gợi ý | modules/learning/recommendations; packages/shared-types/src/recommendations.mjs | Engine luật, không phải mô hình AI huấn luyện |
| Sổ lỗi | modules/learning/mistakes; migrations/learning | Lọc người sở hữu và nội dung nguồn |
| Publication/chất lượng | modules/publication; modules/content-quality | Validation có phạm vi quy tắc, không tự bảo đảm chất lượng ngôn ngữ |
| Thư viện media | modules/media-library; apps/admin-web/.../media; services/media-bridge/README.md | Duyệt tham chiếu theo loại, không phải toàn bộ object storage |
| Worker SQL | services/asr-jobs/pg_store.py; services/job-broker/pg_store.py | Truy vấn psycopg chuyên biệt, không mô phỏng document API |
| Outbox/inbox | common/events/domain-outbox.service.ts; services/domain-events | Đọc cả writer/consumer khi kết luận phạm vi transaction |
| Số liệu PostgreSQL | POSTGRES_NATIVE_AUDIT.json; POSTGRES_RELATIONAL_AUDIT.json; trạng thái refactor | Các kết quả audit/reference không phải số liệu người dùng thật |
| Kết quả UI/realtime | UI_QA_AUDIT.json; UI_QA_REPORT_VI.md; tests/ui-*.cjs | Giữ mốc 29/10/2026; không nhận là chạy mới ngày biên soạn |
| Cài đặt CPU/CUDA | DOCKER.md; scripts/docker-up.mjs; compose.asr-cuda.yml; compose.tts-cuda.yml | Compose cơ bản chọn CPU; wrapper lựa chọn override |

Các README PostgreSQL V8 và một số tài liệu cũ còn mô tả compat/read-model của giai đoạn chuyển đổi. Khi có khác biệt, báo cáo lấy entrypoint, source runtime, migration và các bằng chứng mới hơn làm căn cứ, đồng thời giữ rõ mốc của số liệu. Trước khi nộp, cần cập nhật lại mục đối chiếu nếu bản bàn giao có thay đổi lớn.
