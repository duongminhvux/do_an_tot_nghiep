import { stableId, type Row } from "./generator.ts";
/** Replay non-overlapping foreground vocabulary intervals in the live 30-second contract. */
export function activeSlices(sessions: Row[]) {
  return sessions.flatMap((s) => {
    const start = new Date(s.started_at).getTime(),
      end = new Date(s.ended_at).getTime();
    return Array.from({ length: Math.ceil((end - start) / 30000) }, (_, i) => ({
      user_id: s.user_id,
      request_id: stableId(`active:${s.id}:${i}`),
      started_at: new Date(start + i * 30000).toISOString(),
      ended_at: new Date(Math.min(end, start + (i + 1) * 30000)).toISOString(),
    }));
  });
}
