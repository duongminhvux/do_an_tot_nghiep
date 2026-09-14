# ListenUp Student Application

ListenUp is a responsive English listening product built from the supplied high-fidelity UI board. It includes the public marketing experience and the complete student-facing learning flow; Admin and Teacher management are intentionally out of scope.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000` and sign in with:

- Email: `student@listenup.test`
- Password: `Student123!`

Quality checks:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Architecture

```text
src/
  app/                 Next.js App Router routes and layouts
  components/          Shared UI, layout, audio, lesson, and exercise components
  domain/              Enums, normalized entities, DTOs, permissions
  features/            Page-level feature composition and interactive flows
  lib/api/             Typed client facade, endpoints, errors, mock service
  lib/scoring.ts       Server-authoritative mock scoring/domain rules
  mocks/               Deterministic relational fixtures and MSW handlers
  stores/              Small persisted session and global audio coordination stores
```

Pages depend on typed API modules (`authApi`, `dashboardApi`, `coursesApi`, `lessonsApi`, `exercisesApi`, `attemptsApi`, `historyApi`, and `profileApi`), never fixtures. The current transport is an in-browser deterministic mock service with MSW-compatible handlers. A NestJS integration only needs to replace the transport methods in `src/lib/api/client.ts`; UI and query hooks remain unchanged.

## Domain and API contracts

The normalized domain includes users, courses, enrollments, lessons, progress, media, exercises, groups, questions, options, attempts, and answers. DTOs in `src/domain/dto.ts` shape route-specific responses. Error behavior uses stable codes such as `UNAUTHENTICATED`, `ACCOUNT_BLOCKED`, `ATTEMPT_LIMIT_REACHED`, `LISTEN_LIMIT_REACHED`, and `ATTEMPT_ALREADY_SUBMITTED`.

Attempts and drafts persist in local storage for the mock phase. Opening an exercise resumes its sole in-progress attempt; submission is idempotent; retry creates a new attempt only when allowed. The shared audio player coordinates globally through Zustand so only one instance plays at once.

## Implemented routes

- Public: `/`, `/login`, `/register`
- Student: `/app/dashboard`, `/app/courses`, course and lesson detail routes, practice/result routes, `/app/history`, `/app/profile`, `/app/settings`
- System: `/403` and the App Router 404 page

## Mock scenarios

Deterministic fixtures include an active student, a blocked student, three relational courses, complete/current/locked lessons, Dictation PASS/FAIL-capable inputs, TOEIC Parts 1 and 4, submitted attempt history, listening limits, and attempt limits. To reset local mock state, clear keys beginning with `listenup-` in browser storage.

## Visual system

The implementation follows the reference board: white cards on a cool gray canvas, #2563EB primary actions, a dark navy public footer, compact card density, subtle borders/shadows, waveform players, rounded 10–14px surfaces, and responsive layouts that reflow rather than shrink the desktop UI.
