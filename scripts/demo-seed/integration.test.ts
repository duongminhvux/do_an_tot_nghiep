import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { config } from "./config.ts";
import { generate, stableId } from "./generator.ts";
import { businessLogic, persist, bulk } from "./runtime.ts";
import { reset } from "./reset.ts";
const require = createRequire(import.meta.url);
const { nativePostgres } = require("../../tests/helpers/native-postgres.cjs");
test("PostgreSQL owner schemas: atomic seed, resume, constraints, idempotency and exact cleanup preserve sentinel data", async () => {
  const stores: Record<string, any> = {},
    clients: Record<string, any> = {};
  try {
    for (const role of [
      "identity",
      "assessment",
      "content",
      "learning",
      "arena",
    ]) {
      stores[role] = await nativePostgres([role]);
      clients[role] = await stores[role].connection.pool.connect();
    }
    const id = stableId("fixture"),
      sentinel = stableId("sentinel");
    await clients.identity.query(
      "INSERT INTO users(id,email,username) VALUES($1,'real@example.com','real')",
      [sentinel],
    );
    await clients.assessment.query(
      "INSERT INTO exams(id,name,slug,type,is_active) VALUES($1,'Exam','exam','TOEIC',true)",
      [id],
    );
    await clients.assessment.query(
      `INSERT INTO questions(id,exam_id,section,part,options,correct_answer) VALUES($1,$1,'READING',5,'[{"key":"A","text":"a"},{"key":"B","text":"b"}]','A')`,
      [id],
    );
    await clients.content.query(
      `INSERT INTO dictationlessons(id,title,slug,level,sentence_count) VALUES($1,'Listening','listening','"A2"',2)`,
      [id],
    );
    const input = {
      exams: [{ id, name: "Exam", duration_minutes: 120 }],
      questions: [
        {
          id,
          exam_id: id,
          part: 5,
          content: "Select",
          options: [
            { key: "A", text: "a" },
            { key: "B", text: "b" },
          ],
          correct_answer: "A",
        },
      ],
      passages: [],
      lessons: [{ id, title: "Lesson" }],
      lessonwords: [{ id, lesson_id: id, word_id: id }],
      dictation: [
        { id, title: "Listening", slug: "listening", sentence_count: 2 },
      ],
      segments: [
        { id, lesson_id: id, text: "One." },
        { id: stableId("s2"), lesson_id: id, text: "Two." },
      ],
      arenaWords: [{ id, word: "learn", meaning: "study" }],
    };
    const business = await businessLogic(),
      plan = generate(
        config({ DEMO_USER_COUNT: "2", DEMO_ARENA_MATCH_COUNT: "3" }),
        input,
        "2026-11-07T00:00:00Z",
        business,
      );
    const interrupted = structuredClone(plan);
    interrupted.assessment!.attemptanswers![0]!.question_id = null;
    await assert.rejects(
      () => persist(interrupted, clients, business),
      /null value/,
    );
    assert.equal(
      Number(
        (await clients.assessment.query("SELECT count(*) n FROM attempts"))
          .rows[0].n,
      ),
      0,
    );
    assert.equal(
      Number(
        (await clients.identity.query("SELECT count(*) n FROM users")).rows[0]
          .n,
      ),
      3,
    );
    await persist(plan, clients, business);
    const second = await persist(plan, clients, business);
    assert.ok(
      Object.values<any>(second).every((t) =>
        Object.values(t).every((n) => n === 0),
      ),
    );
    const activityCount = Number(
      (
        await clients.learning.query(
          "SELECT count(*) n FROM learning_credit_ledger",
        )
      ).rows[0].n,
    );
    assert.equal(activityCount, plan.learning!.learning_activities!.length);
    const dry = await reset(clients, false);
    assert.equal(dry.dryRun, true);
    const extraSlice = stableId("non-seed-ui-tracking");
    await clients.learning.query(
      "INSERT INTO user_active_time_slices(user_id,request_id,started_at,ended_at) VALUES($1,$2,'2026-11-07T00:00:00Z','2026-11-07T00:00:10Z')",
      [plan.identity!.users![0]!.id, extraSlice],
    );
    const blockedPreview = await reset(clients, false);
    assert.ok(
      blockedPreview.blockers!.some((message) =>
        message.includes("non-seed active-time"),
      ),
    );
    await assert.rejects(() => reset(clients, true), /non-seed active-time/);
    await clients.learning.query(
      "DELETE FROM user_active_time_slices WHERE request_id=$1",
      [extraSlice],
    );
    assert.equal(
      Number(
        (await clients.identity.query("SELECT count(*) n FROM users")).rows[0]
          .n,
      ),
      3,
    );
    await clients.identity.query("UPDATE outbox_events SET published_at=now()");
    await reset(clients, true);
    assert.deepEqual(
      (await clients.identity.query("SELECT email FROM users")).rows,
      [{ email: "real@example.com" }],
    );
    assert.equal(
      Number(
        (await clients.assessment.query("SELECT count(*) n FROM exams")).rows[0]
          .n,
      ),
      1,
    );
    assert.equal(
      Number(
        (await clients.content.query("SELECT count(*) n FROM dictationlessons"))
          .rows[0].n,
      ),
      1,
    );
    await assert.rejects(
      () =>
        bulk(clients.identity, "users", [
          {
            id: sentinel,
            email: "overwritten@example.com",
            payload: { demo: "other" },
          },
        ]),
      /Ownership collision/,
    );
  } finally {
    for (const client of Object.values<any>(clients)) client.release();
    for (const store of Object.values<any>(stores)) await store.close();
  }
});
