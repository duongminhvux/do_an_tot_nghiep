# Seed tai khoan Admin (VocaLearn)

Script: `apps/api/src/scripts/seed-admin.mjs`.
Database: `identity_db`, collection: `admins` (khong phai `users`).
Dang nhap: username `admin` hoac email `admin@gmail.com`.

## Tao nhanh tren Docker (chi local/dev)

Sau khi ap dung patch va build lai API image:

```powershell
docker compose build identity-service
docker compose run --rm --no-deps -e DEFAULT_ADMIN_PASSWORD=admin -e ADMIN_SEED_ALLOW_WEAK_PASSWORD=true admin-seed node apps/api/src/scripts/seed-admin.mjs
```

Lenh nay tao Admin neu chua co. Mat khau `admin` duoc hash bang bcrypt. Neu co roi, script KHONG ghi de mat khau.

## Tu dong seed khi `docker compose up -d --build`

Them vao `.env` (chi local/dev):

```dotenv
ADMIN_SEED_ENABLED=true
DEFAULT_ADMIN_EMAIL=admin@gmail.com
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin
ADMIN_SEED_ALLOW_WEAK_PASSWORD=true
```

Chay `docker compose up -d --build`. `admin-seed` cho `db-init` hoan thanh, sau do seed Admin; `identity-service` cho `admin-seed` thanh cong truoc khi khoi dong.
Neu co tai khoan trung email/username nhung khac danh tinh, script bao loi, khong tu merge.

## Reset password Admin da ton tai (thao tac thu cong)

```powershell
docker compose run --rm --no-deps -e DEFAULT_ADMIN_PASSWORD=admin -e ADMIN_SEED_ALLOW_WEAK_PASSWORD=true admin-seed node apps/api/src/scripts/seed-admin.mjs --reset-password
```

Neu tai khoan da bi vo hieu hoa, them `--reactivate` khi ban co chu dich kich hoat lai.

## Xac nhan

```powershell
docker compose logs --tail=50 admin-seed
docker compose ps -a admin-seed identity-service
```

API dang nhap admin: `POST /api/admin/auth/login`.

**Bao mat:** `admin/admin` la thong tin dang nhap RAT YEU. Chi su dung cho local development, KHONG de day tren internet hoac Cloudflare Tunnel. Khi deploy, dung mat khau manh (>=12 ky tu) va dat `ADMIN_SEED_ALLOW_WEAK_PASSWORD=false`. Sau khi tao lan dau, password khong tu reset moi lan boot. Khong commit `.env` len Git.
