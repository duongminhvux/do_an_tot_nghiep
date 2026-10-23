# Kiem tra merge GitHub va giao tiep microservices (V7)

Nguon: ZIP `project(20261023-112244).zip` do nguoi dung cung cap. Day la **ket qua ra soat source + static tests**; KHONG PHAI ket qua kiem chung tat ca Docker runtime.

## A. 4 file bi bao conflict

| File | Ket qua | Xu ly |
|---|---|---|
| `apps/api/package.json` | Khong con marker; 34 dependencies + 21 devDependencies deu khop `pnpm-lock.yaml`. | Giu nguyen, khong can sua dependency hay lockfile. |
| `apps/api/src/app.module.ts` | Import `app.controller.js` va `app.service.js` khong ton tai; day la bootstrap monolith cu va Docker khong dung den. | Doi thanh compatibility module rong; Docker tiep tuc dung `src/entrypoints/*` va `PlatformModule`. Doi bai e2e Hello World cu thanh live gateway smoke (opt-in). |
| `apps/api/src/modules/assessment/attempts/schemas/attempt.schema.ts` | Model status cho phep `COMPLETED` trong TS, nhung Mongoose enum chi cho phep 3 trang thai moi. | Chap nhan `COMPLETED` khi doc/ghi du lieu legacy; ghi ket qua moi su dung `FINISHED`; import `HydratedDocument` thanh type. |
| `apps/api/src/modules/learning/sessions/sessions.service.ts` | Goi `this.learningActivity` nhung khong khai bao/inject; inject `ActivityLogsService` tu DB notification, khong duoc provide trong Learning role. | Inject LearningActivityService dung owner Learning; thay ActivityLogsService bang NotificationClient noi bo. |

## B. Loi giao tiep tim duoc va da sua

1. `GET /api/learning-activity/home`, `/recent`: frontend da goi, nhung Gateway khong forward, Learning module khong nap controller. Da them module + Nginx route. DB schema manifest thieu `learning_activities`, da them collection va 3 index (gom `(userId,sourceKey)` unique). Khong drop / reset du lieu.
2. Hoan thanh TOEIC, dictation, Arena: cac services khac goi `LearningActivityService` qua `@Optional()` nhung service Mongoose nay KHONG ton tai trong process do. Da them `LearningActivityClient` noi bo, xac thuc `INTERNAL_SERVICE_TOKEN`, POST toi learning-service; chi Learning so huu DB XP. Day la best-effort HTTP, khong phai durable outbox; neu Learning dang down XP event co the khong den va se ghi warning.
3. `GET /api/admin/attempts/:id`: Admin frontend goi route nay nhung Gateway chua route den assessment. Da them `admin/attempts`.
4. `AppModule` cu duoc loai bo dependencies ao; code Docker tiep tuc dung 8 business entrypoints.
5. Them script `scripts/check-client-gateway-routes.cjs` kiem tra route frontend tu 263 bieu thuc API; hien tai 0 route chua duoc Nginx map (static only).

## C. Giao tiep kiem tra theo kiem chung source

| Huong giao tiep | Static source | Live Docker |
|---|---|---|
| Nginx -> Identity/Content/Assessment/Arena/Learning/Media Jobs/AI Import/Notification | Da map route va test | Chua chay duoc tren moi truong kiem tra |
| Service JWT -> Identity internal introspection | Endpoint, internal token, URL phu hop | Can script smoke |
| Source DB -> MongoDB rs0 -> db-init | 8 role DB, 122 collections, checksum marker | Can db-init log |
| Change Stream -> RabbitMQ -> projections | Pika confirms/resume token, 6 test fake PASS | Chua thu RabbitMQ that |
| Content/Assessment/Arena -> Learning XP | HTTP client noi bo moi, validation, unique index | Can smoke + nghiep vu end-to-end |
| Learning -> Notification log | NotificationClient dung API noi bo | Can smoke |
| Arena -> Redis / Socket.IO | Wiring va Nginx upgrade co | Can thu match 1v1 that |
| TTS, ASR, Job Broker, S3 object store | Docker services va Python syntax hop le | Can thu upload, render, jobs that |
| Domain outbox -> `domain-consumer-*` | Co xac nhan, consumer luu `processed_domain_events` | CHUA co bang chung business handler day du cho moi event |

**Chua du co so de ket luan "toan he thong thong 100%"** neu chua chay bai smoke va user flows trong Docker. Domain consumer hien tai chi ghi nhan event (dedup ledger), khong tu dong thuc hien moi nghiep vu lien quan.

## D. Kiem tra da chay

- PyYAML/Compose static: 46 services, dependency refs va service database URI hop le.
- `scripts/check-fresh-stack.py`: 8 database owner, 48 business collections, 122 manifest collections (ca projection/system).
- `scripts/check-microservice-routes.py`: 37 route/checkpoint smoke PASS.
- `scripts/check-client-gateway-routes.cjs`: 263 API call expressions, 0 route khong duoc map.
- `scripts/check-ts-syntax.cjs`: 681 TS/TSX, 0 parse errors va 0 local API import bi dut.
- Python: 40 source files parse thanh cong.
- `python -m unittest discover -s tests -p 'test_*.py' -v`: 20/20 PASS (14 merge/contract + 6 relay fake).
- Khong co Docker daemon va khong the cai pnpm dependencies tu npm registry trong moi truong kiem tra. **Chua full `pnpm tsc`/Next build, chua Docker e2e**, khong duoc tuyen bo da chay production.

## E. Cach ap dung va test tren Windows

1. Backup `.env`, local media va Mongo data dang chay. Ban ZIP patch khong chua `.env`.
2. Giai nen **patch** vao thu muc root cua repo, sau khi kiem tra `git status` va backup thay doi chua commit.
3. Chay:

```powershell
cd D:\Code\do_an\do_an_real\do_an_tot_nghiep
docker compose config --quiet
docker compose up -d --build
docker compose restart gateway
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-microservices.ps1
```

4. Neu smoke FAIL:

```powershell
docker compose ps -a
docker compose logs --tail=150 db-init identity-service learning-service assessment-service content-service arena-service gateway
# neu RabbitMQ/projection loi:
docker compose logs --tail=100 rabbitmq projection-relay-identity projection-relay-notification projection-consumer-learning
```

5. Test dang nhap Admin/user, tao bai tu vung, tao de va lam bai TOEIC, hoan thanh dictation, mini-game, Arena 1v1, va xem dashboard XP. Bai smoke HTTP khong thay the nhung nghiep vu nay.

**Chu y quan trong:** Sua `database/schema/collections.json` lam doi checksum chung. Phai cho `db-init` re-run va build lai Node shared image va Projection image de dong bo manifest; `up -d --build` lam dieu nay. Tuyet doi KHONG dung `docker compose down -v`, `mongorestore --drop` hoac xoa `projection_resume`.

## F. Known limitations / cong viec tiep theo

- Gui XP qua HTTP best-effort; nen chuyen sang durable domain outbox/event consumer de tranh mat XP khi Learning service down hoac he thong restart.
- `domain-consumer-learning` va `domain-consumer-notification` hien tai ghi ledger `processed_domain_events`, khong tu dong xu ly nghiep vu theo tung event type.
- API healthy khong co nghia database projection da lag 0, job TTS/ASR hoat dong, hay Socket.IO 1v1 chay chuan. Can e2e thuc te va theo doi DLQ RabbitMQ.
- Google OAuth can credentials/redirect URL hop le; thu nghiem auth rieng.
- Ban ZIP day du loai tru `.env`, local dumps va cac file runtime nham tranh lo thong tin bao mat.
