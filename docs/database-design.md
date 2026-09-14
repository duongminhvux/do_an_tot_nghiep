# ListenUp database design

## Source of truth

The operational database targets PostgreSQL 16 and is **SQL-first**.

- `sql/database.sql` is the only source of truth for database structure.
- `sql/seed.sql` is the development seed dataset used for a fresh Docker database.
- `apps/api/prisma/schema.prisma` is the Prisma ORM/client mapping of that database.
- Prisma migrations are intentionally not used.

Docker mounts the baseline SQL files into PostgreSQL's `/docker-entrypoint-initdb.d` directory as `01-database.sql` and `02-seed.sql`. PostgreSQL executes them only when its data directory is empty. A one-shot Compose service named `db-prepare` also runs the idempotent `sql/compat.sql` and `sql/verify.sql` before the API on every startup. `compat.sql` exists only to preserve older development volumes; `database.sql` remains the canonical fresh-database schema.

The schema uses UUID primary keys, `timestamptz(3)` timestamps, snake-case database objects, explicit foreign-key behavior, normalized lowercase email application behavior, bounded percentages/scores, and PostgreSQL enum types.

## Development lifecycle

Normal startup and upgrades that are covered by the compatibility shim:

```bash
docker compose down
docker compose up --build
```

`db-prepare` must complete successfully before the API starts. If verification reports a schema mismatch that `compat.sql` intentionally does not repair, review the database rather than allowing Prisma to fail later at request time.

For an intentional clean rebuild:

```bash
docker compose down -v
docker compose up --build
```

When changing database structure:

1. Edit `sql/database.sql` first.
2. Update `apps/api/prisma/schema.prisma` to mirror the canonical SQL (or reconcile with `pnpm --filter api db:pull` against a disposable fresh database).
3. Add narrowly scoped, idempotent DDL to `sql/compat.sql` only when an existing development volume must be upgraded without data loss.
4. Extend `sql/verify.sql` for any critical runtime field introduced by the change.
5. Run `pnpm --filter api prisma:generate`.

Do not use `prisma migrate` or `prisma db push` against the project database.

## Entity groups

### Identity and authentication

`User` is the account root for ADMIN, TEACHER, and STUDENT. Role-specific data lives in `StudentProfile` and `TeacherProfile`. `UserPreference` stores UX preferences. `RefreshSession` stores client-specific hashed refresh tokens, and `PasswordResetToken` stores hashed reset tokens.

### Courses and learning content

`Course` contains ordered `Lesson` records. Teacher/course and student/course many-to-many relationships use `CourseTeacherAssignment` and `CourseEnrollment`. `Lesson` owns vocabulary, expressions, resources, and per-student progress.

### Listening exercises

`ListeningExercise` represents Dictation or TOEIC practice. TOEIC content is grouped by `ExerciseGroup` so one group corresponds to one audio stimulus:

- Part 1: one photograph item per group.
- Part 2: one question-response item per group.
- Part 3: one conversation per group, exactly three questions.
- Part 4: one talk per group, exactly three questions.

`ExerciseAudioSegment` stores ordered authoring segments and optional speaker metadata for local TTS generation. Composite foreign keys prevent grouped questions/segments from referencing a group from another exercise.

### Attempts and playback

`ListeningAttempt` tracks an attempt and keeps `play_count` as the total number of playback actions for analytics. `AttemptListenEvent.group_id` scopes TOEIC playback to the actual stimulus group, allowing `maxPlays` to be enforced independently for each conversation/talk/item. Dictation events keep a null group and retain exercise-level limits.

`AttemptAnswer` stores text or selected options, correctness, score, feedback, and answer snapshots.

### Media and TTS

`MediaFile` stores metadata for local or object-storage assets. Business entities reference media records instead of embedding file-storage details.

`TtsJob` may target:

- a Dictation exercise,
- a TOEIC `ExerciseGroup`, or
- an individual `ExerciseAudioSegment`.

It stores provider/model settings, normalized input/hash, job status, output media, retry state, and safe error details. The current local provider is Kokoro through the internal FastAPI service.

`TtsSetting` stores non-secret authoring defaults. Provider enablement and provider selection are environment-managed.

### Website and audit data

`LandingSection` stores draft/published versioned page sections. `SiteSetting` is the singleton platform branding/contact record. `AuditLog` records security/administrative changes without introducing an event bus or outbox subsystem.

## Major constraints

The SQL source includes constraints for:

- unique/compound identifiers and slugs,
- bounded score/progress/speed values,
- positive attempt/play counts,
- Dictation vs TOEIC subtype consistency,
- exactly one correct option at the database level where applicable,
- selected option/question integrity,
- group/exercise composite integrity,
- historical attempt consistency,
- media/TTS metadata bounds.

Application-level publish validation adds the rules that require cross-row knowledge, such as exact TOEIC option counts, one-item-per-group rules, structured speaker requirements, and playable audio for every published group.

## Seed design

`sql/seed.sql` contains development-only persisted data:

- 1 admin
- 3 teachers
- 12 students
- profiles/preferences
- 2 published courses
- 4 published lessons
- enrollments/progress
- Dictation authoring data
- TOEIC Part 2, Part 3, and Part 4 authoring data
- local Kokoro TTS defaults

TOEIC Part 1 is intentionally not seeded. No fake audio/media rows are inserted; exercises stay `DRAFT` until actual audio exists.
