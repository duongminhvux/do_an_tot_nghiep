import { NAMESPACE } from "./config.ts";
import { stableId, type Row } from "./generator.ts";
import { activeSlices } from "./active-time.ts";
export const OWNED_TABLES: Record<string, string[]> = {
  learning: [
    "learningsessionwords",
    "learningsessions",
    "userwordreviews",
    "userlessonwords",
    "userlessonprogresses",
    "userdailyactivities",
  ],
  arena: [
    "arenaplayeranswers",
    "arenaratinghistories",
    "arenamatchplayers",
    "arenamatchquestions",
    "arenamatches",
    "arenaprofiles",
  ],
  content: ["dictationprogresses"],
  assessment: ["attemptanswers", "attempts"],
  identity: ["users"],
};
/** Only exact UUIDs whose namespace AND stable seed key prove ownership are eligible. */
export function owned(row: Row) {
  return (
    row.payload?.demo === NAMESPACE &&
    typeof row.payload.seedKey === "string" &&
    stableId(row.payload.seedKey) === row.id
  );
}
export async function reset(db: Record<string, any>, apply: boolean) {
  const blockers: string[] = [];
  const block = (message: string) => {
    if (apply) throw new Error(message);
    blockers.push(message);
  };
  const users = (
    await db.identity.query("SELECT * FROM users WHERE payload->>'demo'=$1", [
      NAMESPACE,
    ])
  ).rows;
  if (users.some((row: Row) => !owned(row)))
    throw new Error("Cannot prove ownership of all demo users");
  const userIds = users.map((u: Row) => u.id),
    selection: Record<string, Record<string, string[]>> = {};
  const counts: Row = {};
  for (const [owner, tables] of Object.entries(OWNED_TABLES)) {
    selection[owner] = {};
    counts[owner] = {};
    for (const table of tables) {
      const rows = (
        await db[owner].query(
          `SELECT * FROM ${table} WHERE payload->>'demo'=$1`,
          [NAMESPACE],
        )
      ).rows;
      if (rows.some((r: Row) => !owned(r)))
        throw new Error(`Cannot prove ownership in ${owner}.${table}`);
      selection[owner]![table] = rows.map((r: Row) => r.id);
      counts[owner][table] = rows.length;
    }
    // Refuse cleanup when an account has gained data outside this seed. Never cascade it away.
    const tablesWithUser = (
      await db[owner].query(
        "SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='user_id'",
      )
    ).rows;
    for (const { table_name: table } of tablesWithUser) {
      if (!/^[a-z_]+$/.test(table)) throw new Error("Unexpected table name");
      if(table==='dictation_learning_sessions'){
        const n=Number((await db[owner].query('SELECT count(*) n FROM dictation_learning_sessions WHERE user_id=ANY($1::uuid[])',[userIds])).rows[0].n);
        if(n)block('Cleanup refused: real Dictation practice sessions exist');
        continue;
      }
      const hasPayload = (
        await db[owner].query(
          "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='payload'",
          [table],
        )
      ).rows.length;
      if (hasPayload && table !== "learning_activities") {
        const n = (
          await db[owner].query(
            `SELECT count(*) n FROM ${table} WHERE user_id=ANY($1::uuid[]) AND payload->>'demo' IS DISTINCT FROM $2`,
            [userIds, NAMESPACE],
          )
        ).rows[0].n;
        if (Number(n))
          block(
            `Cleanup refused: non-seed records for demo users in ${owner}.${table}`,
          );
      }
    }
  }
  for (const [owner, child, column, parent] of [
    ["assessment", "attemptanswers", "attempt_id", "attempts"],
    ["learning", "learningsessionwords", "session_id", "learningsessions"],
    ["arena", "arenamatchquestions", "match_id", "arenamatches"],
  ]) {
    const foreign = await db[owner!].query(
      `SELECT 1 FROM ${child} WHERE ${column}=ANY($1::uuid[]) AND payload->>'demo' IS DISTINCT FROM $2 LIMIT 1`,
      [selection[owner!]![parent!], NAMESPACE],
    );
    if (foreign.rows.length)
      block(`Cleanup refused: non-seed dependent rows in ${owner}.${child}`);
  }
  const activities = (
    await db.learning.query(
      "SELECT id FROM learning_activities WHERE user_id=ANY($1::uuid[]) AND source_key LIKE $2",
      [userIds, `${NAMESPACE}:%`],
    )
  ).rows.map((r: Row) => r.id);
  const foreignActivities = (
    await db.learning.query(
      "SELECT count(*) n FROM learning_activities WHERE user_id=ANY($1::uuid[]) AND source_key NOT LIKE $2",
      [userIds, `${NAMESPACE}:%`],
    )
  ).rows[0].n;
  if (Number(foreignActivities))
    block(
      "Cleanup refused: demo accounts contain non-seed learning activities",
    );
  counts.learning.learning_activities = activities.length;
  const sessions = (
    await db.learning.query(
      "SELECT * FROM learningsessions WHERE payload->>'demo'=$1",
      [NAMESPACE],
    )
  ).rows;
  const slices = activeSlices(sessions),
    sliceIds = new Set(slices.map((s) => s.request_id));
  const existingSlices = (
    await db.learning.query(
      "SELECT request_id FROM user_active_time_slices WHERE user_id=ANY($1::uuid[])",
      [userIds],
    )
  ).rows;
  if (existingSlices.some((s: Row) => !sliceIds.has(s.request_id)))
    block("Cleanup refused: non-seed active-time slices exist");
  counts.learning.user_active_time_slices = existingSlices.filter((s: Row) =>
    sliceIds.has(s.request_id),
  ).length;
  if (!apply) return { dryRun: true, counts, blockers };
  // Drain identity publications before deleting projections so delayed events cannot resurrect them.
  const events = (
    await db.identity.query(
      "SELECT event_id,published_at FROM outbox_events WHERE aggregate_id=ANY($1::uuid[]) AND event_type='identity.user.created.v1' AND payload->>'demo'=$2",
      [userIds, NAMESPACE],
    )
  ).rows;
  if (events.some((e: Row) => !e.published_at))
    throw new Error("Wait for identity outbox to drain before cleanup");
  if (db.notification && events.length) {
    for (const owner of ["learning", "arena", "notification"]) {
      const delivered = Number(
        (
          await db[owner].query(
            "SELECT count(DISTINCT event_id) n FROM inbox_events WHERE event_id=ANY($1::uuid[])",
            [events.map((e: Row) => e.event_id)],
          )
        ).rows[0].n,
      );
      if (delivered !== events.length)
        throw new Error(`Wait for ${owner} consumer receipts before cleanup`);
    }
  }
  for (const owner of [
    "learning",
    "arena",
    "content",
    "assessment",
    "identity",
  ]) {
    const client = db[owner];
    await client.query("BEGIN");
    try {
      if (owner === "learning") {
        await client.query(
          "DELETE FROM user_active_time_slices WHERE user_id=ANY($1::uuid[]) AND request_id=ANY($2::uuid[])",
          [userIds, [...sliceIds]],
        );
        await client.query(
          "DELETE FROM learning_credit_ledger WHERE activity_id=ANY($1::uuid[])",
          [activities],
        );
        await client.query(
          "DELETE FROM learning_activities WHERE id=ANY($1::uuid[])",
          [activities],
        );
      }
      for (const table of OWNED_TABLES[owner]!)
        await client.query(
          `DELETE FROM ${table} WHERE id=ANY($1::uuid[]) AND payload->>'demo'=$2`,
          [selection[owner]![table], NAMESPACE],
        );
      if (["arena", "learning"].includes(owner))
        await client.query(
          "DELETE FROM identity_profiles WHERE id=ANY($1::uuid[])",
          [userIds],
        );
      if (owner === "identity")
        await client.query(
          "DELETE FROM outbox_events WHERE event_id=ANY($1::uuid[]) AND payload->>'demo'=$2",
          [events.map((e: Row) => e.event_id), NAMESPACE],
        );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  if (db.notification)
    await db.notification.query(
      "DELETE FROM identity_profiles WHERE id=ANY($1::uuid[])",
      [userIds],
    );
  return { dryRun: false, counts };
}
