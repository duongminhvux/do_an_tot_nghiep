# Sửa lỗi restart liên tục của Projection Relay (V5)

## Nguyên nhân đã xác minh từ log và code V4

1. `services/projections/projection.py` gọi `ch.confirm_delivery()` rồi kiểm tra `if not ch.basic_publish(...)`. Trong Pika BlockingChannel, **một lệnh publish thành công trả về `None`**. Thất bại ở chế độ publisher confirms sẽ phát sinh exception (`NackError`, `UnroutableError`, lỗi kết nối), không trả `False`. Vì vậy code cũ luôn tự phát sinh `RabbitMQ publish was not confirmed` và làm container restart khi có sự kiện.
2. Vòng `for change in db.watch(...)` có thể chờ MongoDB rất lâu mà không phục vụ AMQP heartbeat. Log cho thấy `Connection reset by peer` sau khoảng 12 phút idle.
3. `conn.close()` được gọi sau khi socket đã đóng, che khuất lỗi gốc bằng `ConnectionWrongStateError`.
4. Lỗi kiểm tra kiểu boolean này còn có ở outbox/domain events, job broker, job runner, ASR jobs và PDF-AI.

## Bản sửa

- Gọi `basic_publish()` trực tiếp với `mandatory=True` và `confirm_delivery()`; lỗi sẽ truyền thành exception, không ghi nhận nhầm là thành công.
- Với MongoDB change streams, sử dụng `stream.try_next()` (`max_await_time_ms=2500`) + `conn.process_data_events()` mỗi vòng để duy trì heartbeat.
- Vẫn **chỉ lưu** checkpoint `projection_resume` sau khi publish **tất cả** target thành công.
- Không đóng lại kết nối RabbitMQ đã đóng.
- Khi outbox không có sự kiện, dùng `conn.sleep(1)` để phục vụ AMQP heartbeat.
- Không xóa database, checkpoint, resume token, queue hay event.

## Áp dụng nhanh trên source V4

1. Sao lưu/commit các file bạn tự thay đổi sau V4.
2. Giải nén `vocalearn-relay-fix-v5-patch.zip` vào thư mục gốc dự án (`-Force` ghi đè đúng các file trong patch).
3. Mở PowerShell tại thư mục gốc, chạy:

```powershell
docker compose config --quiet
# Các relay và consumer projection cùng dùng một image:
docker compose build projection-consumer-identity
# Không rebuild 45 service, không đụng dữ liệu:
docker compose up -d --no-deps --no-build --force-recreate projection-relay-identity projection-relay-notification
```

Khi muốn áp dụng các sửa chữa ở các publisher khác trong bản vá:

```powershell
docker compose build outbox-identity job-broker job-runner asr-job-api
docker compose up -d --no-build
```

`pdf-ai`/`pdf-ai-worker` chỉ build và chạy khi bạn chủ động dùng `--profile ai`.

## Kiểm tra

```powershell
docker compose ps -a
docker compose logs --tail=80 projection-relay-identity projection-relay-notification
docker compose logs --tail=100 rabbitmq
```

Mong đợi: relay tiếp tục chạy và không còn lỗi `RabbitMQ publish was not confirmed`. Những service này không cung cấp HTTP health endpoint; quan sát thêm sau khi có thay đổi User/Notification thực tế để chắc chắn sự kiện đã được đồng bộ.

Đây là bản sửa **đã vượt qua kiểm tra cú pháp và các test giả lập**, chưa chạy thử Docker+RabbitMQ thật trên máy của bạn.

**Không dùng `docker compose down -v`; không xóa `projection_resume` hoặc `database_versions`.**
