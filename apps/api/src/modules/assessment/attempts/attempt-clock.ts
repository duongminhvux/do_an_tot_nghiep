/**
 * Active-time clock for an attempt. Only time spent on the attempt page counts:
 * the page resumes the clock when it opens, pauses it when it is left or hidden,
 * and sends heartbeats while it is visible. A page that disappears without
 * pausing (closed tab, crash, lost network) stops counting HEARTBEAT_GRACE_SECONDS
 * after its last heartbeat.
 *
 * Stored in the attempt payload: `activeSeconds` (closed segments),
 * `activeSince` (start of the running segment, null while paused) and
 * `lastSeenAt` (latest heartbeat). Attempts created before this clock have
 * none of them and keep counting wall-clock time from `startedAt`.
 */
export const HEARTBEAT_GRACE_SECONDS = 45;

export interface AttemptClock {
  startedAt: Date | string;
  activeSeconds?: number;
  activeSince?: Date | string | null;
  lastSeenAt?: Date | string | null;
}

const ms = (value: Date | string) => new Date(value).getTime();

function legacy(clock: AttemptClock) {
  return clock.activeSeconds === undefined && clock.activeSince === undefined;
}

export function isPaused(clock: AttemptClock) {
  return !legacy(clock) && !clock.activeSince;
}

/** Seconds of the running segment that count, capped at the last heartbeat. */
function runningSeconds(clock: AttemptClock, now: Date) {
  const since = legacy(clock) ? clock.startedAt : clock.activeSince;
  if (!since) return 0;
  const until = clock.lastSeenAt
    ? Math.min(now.getTime(), ms(clock.lastSeenAt) + HEARTBEAT_GRACE_SECONDS * 1000)
    : now.getTime();
  return Math.max(0, (until - ms(since)) / 1000);
}

export function activeSeconds(clock: AttemptClock, now = new Date()) {
  return Math.floor((clock.activeSeconds ?? 0) + runningSeconds(clock, now));
}

/** True when the running segment outlived its heartbeat (tab closed, sleep). */
export function isStale(clock: AttemptClock, now = new Date()) {
  return Boolean(
    clock.activeSince &&
      clock.lastSeenAt &&
      now.getTime() - ms(clock.lastSeenAt) > HEARTBEAT_GRACE_SECONDS * 1000,
  );
}

export function pausedClock(clock: AttemptClock, now = new Date()) {
  return { activeSeconds: activeSeconds(clock, now), activeSince: null, lastSeenAt: now };
}

export function runningClock(clock: AttemptClock, now = new Date()) {
  return { activeSeconds: activeSeconds(clock, now), activeSince: now, lastSeenAt: now };
}

export function remainingSeconds(
  clock: AttemptClock & { timeLimitSeconds?: number | null },
  now = new Date(),
) {
  return clock.timeLimitSeconds
    ? Math.max(0, clock.timeLimitSeconds - activeSeconds(clock, now))
    : undefined;
}
