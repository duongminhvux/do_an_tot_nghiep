import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { config, assertSafe, NAMESPACE, type DemoConfig } from "./config.ts";
import { stableId, type Row, type Plan } from "./generator.ts";
import { activeSlices } from "./active-time.ts";
export const root = resolve(import.meta.dirname, "../..");
export const requireApi = createRequire(resolve(root, "apps/api/package.json"));
export const { Pool } = requireApi("pg");
export async function businessLogic() {
  const load = (path: string) =>
    import(pathToFileURL(resolve(root, `apps/api/dist/${path}.js`)).href);
  if (
    !existsSync(
      resolve(
        root,
        "apps/api/dist/modules/learning/reviews/review-schedule.js",
      ),
    )
  )
    throw new Error(
      "Build API first: pnpm --dir apps/api exec tsc -p tsconfig.docker.json",
    );
  const [attempt, rating, scoring, review, connection, activity] =
    await Promise.all([
      load("modules/assessment/attempts/attempt-results"),
      load("modules/arena/rating/arena-rating.service"),
      load("modules/arena/scoring/arena-scoring.service"),
      load("modules/learning/reviews/review-schedule"),
      load("postgres/connection"),
      load("modules/learning-activity/learning-activity.service"),
    ]);
  const xp = await import("../../packages/shared-types/src/learning-xp.mjs");
  const score = await import("../../packages/shared-types/src/toeic-score.mjs");
  return {
    ...xp,
    ...score,
    ...attempt,
    ...review,
    createConnection: connection.createConnection,
    Activity: activity.LearningActivityService,
    rating: new rating.ArenaRatingService(),
    scoring: new scoring.ArenaScoringService(),
  };
}
export async function connect(c: DemoConfig) {
  const clients: Record<string, any> = {},
    pools: any[] = [];
  try {
    for (const role of [
      "identity",
      "assessment",
      "content",
      "learning",
      "arena",
      "notification",
    ]) {
      const password = process.env[`PG_${role.toUpperCase()}_PASSWORD`];
      if (!password)
        throw new Error(
          `Missing owner credential PG_${role.toUpperCase()}_PASSWORD`,
        );
      const pool = new Pool({
        host: c.host,
        port: Number(process.env.PGPORT ?? 5432),
        database: `${role}_db`,
        user: `vl_${role}`,
        password,
        max: 1,
        connectionTimeoutMillis: 5000,
      });
      pools.push(pool);
      let client: any;
      for (let retry = 0; retry < 5; retry++) {
        try {
          client = await pool.connect();
          break;
        } catch (error) {
          if (retry === 4) throw error;
          await delay(500 * (retry + 1));
        }
      }
      clients[role] = client;
      const {
        rows: [identity],
      } = await client.query(
        "SELECT current_user AS name,current_database() AS db,rolsuper FROM pg_roles WHERE rolname=current_user",
      );
      if (
        identity.rolsuper ||
        identity.name !== `vl_${role}` ||
        identity.db !== `${role}_db`
      )
        throw new Error(`Owner mismatch: ${role}`);
      const { assertSchemaReady } = await import(
        pathToFileURL(resolve(root, "apps/api/dist/postgres/migrations.js"))
          .href
      );
      await assertSchemaReady(
        {
          connect: async () => ({
            query: client.query.bind(client),
            release: () => {},
          }),
        },
        role,
      );
      const lock = await client.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked",
        [NAMESPACE],
      );
      if (!lock.rows[0].locked)
        throw new Error(`Another seed/verify/reset holds ${role} lock`);
    }
    return {
      clients,
      close: async () => {
        for (const client of Object.values<any>(clients)) client.release();
        for (const pool of pools) await pool.end();
      },
    };
  } catch (error) {
    for (const client of Object.values<any>(clients)) client.release();
    for (const pool of pools) await pool.end();
    throw error;
  }
}
export async function inputContent(db: Record<string, any>) {
  const select = async (owner: string, sql: string) =>
    (await db[owner].query(sql)).rows;
  const exams = await select(
    "assessment",
    "SELECT * FROM exams WHERE publication_status='PUBLISHED' AND is_active IS TRUE AND is_deleted IS FALSE ORDER BY id",
  );
  const questions = await select(
    "assessment",
    'SELECT * FROM questions WHERE is_active IS TRUE ORDER BY exam_id,"order",id',
  );
  const validExams = exams.filter((exam: Row) => {
    const qs = questions.filter((q: Row) => q.exam_id === exam.id);
    return (
      qs.length &&
      qs.every(
        (q: Row) =>
          q.options.length >= 2 &&
          q.options.some((o: Row) => o.key === q.correct_answer),
      )
    );
  });
  const lessons = await select(
    "content",
    `SELECT l.* FROM lessons l JOIN collections c ON c.id=l.collection_id
    WHERE l.publication_status='PUBLISHED' AND l.is_active IS TRUE AND l.is_deleted IS FALSE AND c.is_active IS TRUE AND c.is_deleted IS FALSE ORDER BY l.id`,
  );
  const words = await select(
    "content",
    "SELECT * FROM words WHERE publication_status='PUBLISHED' AND is_active IS TRUE AND is_deleted IS FALSE ORDER BY id",
  );
  const wordIds = new Set(words.map((w: Row) => w.id));
  const lessonwords = (
    await select(
      "content",
      'SELECT * FROM lessonwords ORDER BY lesson_id,"order",id',
    )
  ).filter((lw: Row) => wordIds.has(lw.word_id));
  // Reject partial vocabulary lessons: progress must use exactly the words seen by the live API.
  const counts = await select(
    "content",
    "SELECT lesson_id,count(*)::int AS n FROM lessonwords GROUP BY lesson_id",
  );
  const validLessons = lessons.filter(
    (l: Row) =>
      lessonwords.filter((w: Row) => w.lesson_id === l.id).length ===
      counts.find((x: Row) => x.lesson_id === l.id)?.n,
  );
  const dictation = await select(
    "content",
    "SELECT * FROM dictationlessons WHERE publication_status='PUBLISHED' AND status='PUBLISHED' AND is_deleted IS FALSE ORDER BY id",
  );
  const segments = await select(
    "content",
    'SELECT * FROM dictationsegments ORDER BY lesson_id,"order",id',
  );
  const validDictation = dictation.filter(
    (d: Row) =>
      d.sentence_count > 0 &&
      segments.filter((s: Row) => s.lesson_id === d.id && s.text?.trim())
        .length === d.sentence_count,
  );
  const arenaWords = words
    .map((w: Row) => ({
      ...w,
      meaning:
        w.parts?.[0]?.meanings?.[0]?.translation?.[0] ??
        w.parts?.[0]?.meanings?.[0]?.definition,
    }))
    .filter(
      (w: Row) =>
        w.word?.trim() && typeof w.meaning === "string" && w.meaning.trim(),
    );
  if (
    !validExams.length ||
    !validLessons.length ||
    !validDictation.length ||
    arenaWords.length < 5
  )
    throw new Error(
      `Missing published content: exams=${validExams.length}, vocabularyLessons=${validLessons.length}, dictation=${validDictation.length}, arenaWords=${arenaWords.length}. Supply valid content through existing admin workflows; for Dictation use seed:demo:content.`,
    );
  return {
    exams: validExams,
    questions: questions.filter((q: Row) =>
      validExams.some((e: Row) => e.id === q.exam_id),
    ),
    passages: await select(
      "assessment",
      'SELECT * FROM passages ORDER BY passage_group_id,"order",id',
    ),
    lessons: validLessons,
    lessonwords: lessonwords.filter((lw: Row) =>
      validLessons.some((l: Row) => l.id === lw.lesson_id),
    ),
    dictation: validDictation,
    segments,
    arenaWords,
  };
}
export async function bulk(client: any, table: string, rows: Row[]) {
  if (!/^[a-z_]+$/.test(table)) throw new Error("Invalid internal table name");
  let inserted = 0;
  for (let offset = 0; offset < rows.length; offset += 200) {
    const batch = rows.slice(offset, offset + 200),
      ids = batch.map((row) => row.id);
    const conflict = await client.query(
      `SELECT id FROM ${table} WHERE id=ANY($1::uuid[]) AND payload->>'demo' IS DISTINCT FROM $2`,
      [ids, NAMESPACE],
    );
    if (conflict.rows.length)
      throw new Error(`Ownership collision in ${table}`);
    const columns = [...new Set(batch.flatMap(Object.keys))];
    if (columns.some((c) => !/^[a-z_]+$/.test(c)))
      throw new Error("Invalid column");
    const quoted = columns.map((c) => `"${c}"`).join(",");
    inserted += (
      await client.query(
        `INSERT INTO ${table} (${quoted}) SELECT ${quoted} FROM jsonb_populate_recordset(NULL::${table},$1::jsonb) ON CONFLICT(id) DO NOTHING RETURNING id`,
        [JSON.stringify(batch)],
      )
    ).rows.length;
  }
  return inserted;
}
export async function persist(
  plan: Plan,
  db: Record<string, any>,
  business: Row,
) {
  const counts: Row = {};
  for (const owner of [
    "identity",
    "assessment",
    "content",
    "arena",
    "learning",
  ]) {
    const client = db[owner];
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL lock_timeout='10s'");
      await client.query("SET LOCAL statement_timeout='120s'");
      counts[owner] = {};
      const order: Record<string, string[]> = {
        identity: ["users"],
        assessment: ["attempts", "attemptanswers"],
        content: ["dictationprogresses"],
        arena: [
          "arenaprofiles",
          "arenamatches",
          "arenamatchquestions",
          "arenamatchplayers",
          "arenaplayeranswers",
          "arenaratinghistories",
        ],
        learning: [
          "learningsessions",
          "learningsessionwords",
          "userwordreviews",
          "userlessonwords",
          "userlessonprogresses",
          "userdailyactivities",
        ],
      };
      for (const table of order[owner]!)
        counts[owner][table] = await bulk(
          client,
          table,
          plan[owner]![table] ?? [],
        );
      if (owner === "identity")
        for (const user of plan.identity!.users!) {
          const payload = {
            userId: user.id,
            username: user.username,
            avatarUrl: null,
            isBanned: false,
            isDeleted: false,
            sourceVersion: new Date(user.updated_at).getTime(),
            demo: NAMESPACE,
          };
          const existing = await client.query(
            "SELECT event_id FROM outbox_events WHERE aggregate_id=$1 AND event_type='identity.user.created.v1' AND payload->>'demo'=$2 AND payload->>'sourceVersion'=$3",
            [user.id, NAMESPACE, String(payload.sourceVersion)],
          );
          if (existing.rows.length) continue;
          await client.query(
            `INSERT INTO outbox_events(event_id,event_type,aggregate_type,aggregate_id,payload)
          VALUES($1,'identity.user.created.v1','identity',$2,$3::jsonb) ON CONFLICT(event_id) DO NOTHING`,
            [
              stableId(`identity-event:${user.id}:${payload.sourceVersion}`),
              user.id,
              JSON.stringify(payload),
            ],
          );
        }
      if (owner === "learning") {
        let slicesInserted = 0;
        const slices = activeSlices(plan.learning!.learningsessions ?? []);
        for (let offset = 0; offset < slices.length; offset += 200) {
          const batch = slices.slice(offset, offset + 200);
          const conflict = await client.query(
            `SELECT request_id FROM user_active_time_slices WHERE request_id=ANY($1::uuid[]) AND NOT user_id=ANY($2::uuid[])`,
            [
              batch.map((s) => s.request_id),
              plan.identity!.users!.map((u) => u.id),
            ],
          );
          if (conflict.rows.length)
            throw new Error("Active time ownership collision");
          slicesInserted += (
            await client.query(
              `INSERT INTO user_active_time_slices(user_id,request_id,started_at,ended_at)
            SELECT user_id,request_id,started_at,ended_at FROM jsonb_populate_recordset(NULL::user_active_time_slices,$1::jsonb)
            ON CONFLICT(user_id,request_id) DO NOTHING RETURNING request_id`,
              [JSON.stringify(batch)],
            )
          ).rows.length;
        }
        counts.learning.user_active_time_slices = slicesInserted;
        const service = new business.Activity(
          business.createConnection(client),
          undefined,
        );
        const existingActivities = new Set(
          (
            await client.query(
              "SELECT source_key FROM learning_activities WHERE user_id=ANY($1::uuid[]) AND source_key LIKE $2",
              [plan.identity!.users!.map((u) => u.id), `${NAMESPACE}:%`],
            )
          ).rows.map((r: Row) => r.source_key),
        );
        let n = 0;
        for (const row of plan.learning!.learning_activities ?? []) {
          if (existingActivities.has(row.source_key)) continue;
          const camel = Object.fromEntries(
            Object.entries(row)
              .filter(
                ([k]) =>
                  !["id", "created_at", "updated_at", "payload"].includes(k),
              )
              .map(([k, v]) => [
                k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
                v,
              ]),
          );
          n += Number(
            await service.record({
              ...camel,
              occurredAt: new Date(row.occurred_at),
            }),
          );
        }
        counts.learning.learning_activities = n;
      }
      await client.query("COMMIT");
      console.log(
        JSON.stringify({ checkpoint: owner, inserted: counts[owner] }),
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  return counts;
}
export async function bootstrap() {
  if (existsSync(resolve(root, ".env")))
    process.loadEnvFile(resolve(root, ".env"));
  return config();
}
export { assertSafe };
