# Sửa lỗi đăng nhập + gateway + relay (V4)

Bản vá này áp dụng trên V3 (đã có Docker/DB/Mongoose/seed).

## Xác định từ source

1. Identity khai báo `GET /api/auth/google/login` và `POST /api/admin/auth/login`, gateway cũng route về identity. 404 không phải do thiếu controller. Nếu cần, kiểm tra Request URL ở DevTools; `NEXT_PUBLIC_API_URL` được nhúng vào Next.js **khi build**, không chỉ khi chạy.
2. AuthModule trước đây luôn khởi tạo `GoogleStrategy` dù GOOGLE_CLIENT_ID/SECRET để trống. Passport OAuth2 có thể làm cả identity-service thất bại khi boot, khiến user/admin đều không đăng nhập được. V4 chỉ đăng ký chiến lược Google nếu có đủ 2 biến, còn thiếu sẽ trả HTTP 503 cho riêng endpoint Google; các đường đăng nhập thông thường vẫn chạy.
3. Gateway trước đây đợi **tất cả** 8 backend healthy mới bắt đầu. V4 chỉ đợi service_started. Một notification lỗi không chặn cả gateway; route tới service chưa sẵn sàng có thể trả 502. `GET /gateway/identity-health` và `/gateway/notification-health` dùng kiểm tra riêng.
4. Projection-relay-identity và projection-relay-notification được thiết kế chạy lâu dài với Mongo change stream. Nếu cả hai restart liên tục, cần log lỗi cụ thể; không reset marker/checkpoint hoặc đổi `resumeAfter` sang `start now` vì sẽ bỏ sót sự kiện. V4 không giả vờ sửa lỗi này khi chưa có log.

## Cài bản vá

Tại thư mục gốc dự án (backup/commit các file tự sửa trước khi ghi đè):

```powershell
Expand-Archive -Path "$HOME\Downloads\vocalearn-auth-gateway-v4-patch.zip" -DestinationPath . -Force
docker compose config --quiet
docker compose build identity-service admin-web
docker compose up -d --no-build --force-recreate identity-service notification-service gateway web admin-web
```

Nếu web và admin-web đang dùng sai NEXT_PUBLIC_API_URL, chỉnh `.env` rồi build lại **cả web + admin-web**:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

Trong trường hợp truy cập từ thiết bị khác, không dùng `localhost` của máy khác; đặt IP/domain public đúng và cấu hình CORS/callback Google tương ứng.

## Google OAuth

Muốn dùng nút Google thì phải đặt `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` và `GOOGLE_CALLBACK_URL` đúng với Redirect URI đã khai báo ở Google Cloud, ví dụ:

```dotenv
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<client-secret>
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
```

Không có các biến này: user vẫn đăng nhập bằng email/password, còn Google trả HTTP 503 báo chưa bật, không làm cả identity crash.

## Kiểm tra

```powershell
docker compose ps -a
docker compose logs --tail=120 identity-service notification-service projection-relay-identity projection-relay-notification gateway
curl.exe -i http://localhost:5000/gateway/health
curl.exe -i http://localhost:5000/gateway/identity-health
curl.exe -i http://localhost:5000/api/auth/google/login
curl.exe -i -H "Content-Type: application/json" -d "{}" http://localhost:5000/api/admin/auth/login
```

- `gateway/health` = 200 => Nginx nghe cổng 5000, **không đảm bảo backend khỏe**.
- `gateway/identity-health` = 200 => Identity trả health; 502 => identity đang down.
- Google login = 302 nếu cấu hình đủ, 503 nếu chưa bật, 404 nếu sai routing/image.
- Admin POST `{}` = 400/401 nếu route tồn tại, 404 nếu đường dẫn/server sai, 502 nếu upstream down. Login thực tế với admin đã seed trả 200.

Chạy script chẩn đoán (tùy chọn):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\diagnose-auth.ps1
```

**Cần log thật** của `projection-relay-identity`, `projection-relay-notification` để kết luận nguyên nhân restart. Các khả năng gồm Mongo change stream, resume token hết hiệu lực, RabbitMQ hoặc schema checksum; từ mô tả quay vòng đơn thuần chưa xác định được.

**Không dùng** `docker compose down -v`, không xóa `projection_resume` hay `database_versions` để "chữa" relay.
