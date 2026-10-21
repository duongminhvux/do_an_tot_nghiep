# Media bridge (temporary S3 adapter)

MinIO is the object store, with a private FastAPI S3 bridge behind the existing API. No
new Node dependencies are needed during this intermediate migration. Activate with
`docker compose -f docker-compose.yml -f infra/compose/storage.yml up -d --build`.
A **strong** `MEDIA_INTERNAL_TOKEN`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` are required in your `.env`.
Do not publish the bridge or MinIO API publicly. Create a MinIO backup separately.

By default MEDIA_STORAGE_BACKEND=local; the overlay changes it to `s3` for API and audio
workers. New writes go into S3; old `/media/` URLs still work (S3 first, local legacy
fallback). Migrate files using `scripts/migrate-media-to-s3.py` only after a backup.
This bridge is a safe stepping-stone; longer-term replace it with direct S3 SDK signed URLs
and stable `media_assets` IDs in domain documents.
