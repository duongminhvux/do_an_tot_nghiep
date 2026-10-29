# Media Bridge (private S3 adapter)

The Docker stack uses SeaweedFS through its S3-compatible API for media. `/media/{key}` requests hit Gateway -> Media Jobs Service -> this token-authenticated bridge -> object storage. Port 8010 is bound to localhost for diagnostics and must not be exposed publicly. `scripts/migrate-media-to-s3.py` can copy legacy local files; verify counts/checksums and test real image/audio URLs before switching clients.

## Admin media library

Open `/vi/media` (or `/en/media`) in Admin. The sidebar entry **Quản lý media / Media library** opens a collapsible folder tree. Choose **Audios** or **Images** first, then the content category and its lesson/exam/game. Breadcrumbs, back navigation and pagination keep the selected media type. Each root contains:

- **Dictation:** lessons, lesson images, full recordings and segment audio.
- **Games:** minigame images and configured background/correct/wrong/game-over audio. Shared vocabulary images and pronunciation are available under Vocab.
- **Vocab:** lessons, collections and dictionary words; includes cover images and word images/US/UK audio referenced by those resources.
- **TOEIC:** exams, with images/audio referenced by questions and passage groups.

The library reads current business references, including drafts and inactive content. Deleted resources are excluded. It does not list orphan objects or superseded files that happen to remain in the bucket. Duplicate URLs are grouped while their usage locations remain visible. Administrators can search/paginate content, filter images/audio, preview files, open originals and copy links.

Read-only endpoints are `GET /api/admin/media-library/{category}/items` and `GET /api/admin/media-library/{category}/items/:id`. List queries support `page`, `pageSize` (maximum 50), `search`, and resource `kind` (`lesson`, `collection`, or `word` for Vocab). Requests require an administrator session. Each category queries its owning PostgreSQL database through parameterized SQL: Content owns Dictation/Vocab, Assessment owns TOEIC, and Learning owns minigames. Both gateway configurations route these endpoints to the owner.

Validation: `tests/media-library.postgres.cjs` runs 21 checks across the three real PostgreSQL owners with transaction rollback. `tests/media-library.browser.cjs` runs 10 checks against the Docker stack with Chrome, including role restrictions, pagination, image decoding, real WAV playback, clipboard, mobile/English and error recovery. Browser fixtures are created through APIs, then soft-deleted; their temporary S3 objects are deleted. Reports/screenshots are in `.tmp/ui-qa/media/`.
