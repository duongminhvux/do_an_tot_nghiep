# Media Bridge (private S3 adapter)

The new stack uses MinIO/S3 for all media. `/media/{key}` requests hit Gateway -> Media Jobs Service -> this token-authenticated bridge -> MinIO. No public access to port 8010. Migrate existing local media to MinIO **before** switching clients. `scripts/migrate-media-to-s3.py` helps copy legacy files; verify counts/checksums and test real image/audio URLs.
