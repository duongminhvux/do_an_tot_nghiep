import test from "node:test";
import assert from "node:assert/strict";
import { config, assertSafe, NAMESPACE, sameConfig } from "./config.ts";
import { stableId, random, cohort, generate, digest } from "./generator.ts";
import { owned } from "./reset.ts";
import { businessLogic } from "./runtime.ts";
const anchor = "2026-11-07T00:00:00.000Z";
const uuid = stableId("fixture");
const input = {
  exams: [{ id: uuid, name: "Exam", duration_minutes: 120 }],
  questions: [
    {
      id: uuid,
      exam_id: uuid,
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
  lessons: [{ id: uuid, title: "Lesson" }],
  lessonwords: [{ id: uuid, lesson_id: uuid, word_id: uuid }],
  dictation: [
    { id: uuid, title: "Listening", slug: "listening", sentence_count: 2 },
  ],
  segments: [
    { id: uuid, lesson_id: uuid, text: "One." },
    { id: stableId("segment2"), lesson_id: uuid, text: "Two." },
  ],
  arenaWords: [{ id: uuid, word: "learn", meaning: "study" }],
};
test("configuration is opt-in, bounded, strict and refuses production/remote targets", () => {
  assert.equal(config({}).enabled, false);
  assert.equal(config({}).users, 1000);
  for (const env of [
    { DEMO_USER_COUNT: "0" },
    { DEMO_SEED_ENABLED: "yes" },
    { DEMO_PROFILE: "unknown" },
    { DEMO_HISTORY_DAYS: "999" },
    { DEMO_ARENA_MATCH_COUNT: "10001" },
    { DEMO_SEED_RANDOM: "NaN" },
  ])
    assert.throws(() => config(env));
  assert.throws(() => assertSafe(config({}), {}));
  const c = config({ DEMO_SEED_ENABLED: "true", DEMO_ENVIRONMENT: "local" });
  assert.doesNotThrow(() => assertSafe(c, {}));
  assert.throws(() => assertSafe({ ...c, host: "production.internal" }, {}));
  assert.throws(() => assertSafe(c, { DATABASE_URL: "postgres://external" }));
  assert.equal(
    sameConfig({ users: 1000, seed: 2026 }, { seed: 2026, users: 1000 }),
    true,
  );
  assert.equal(
    sameConfig({ users: 1000, seed: 2026 }, { seed: 2027, users: 1000 }),
    false,
  );
});
test("namespace ownership cannot be inferred from an email or arbitrary marker", () => {
  assert.equal(
    owned({ id: uuid, email: "demo@example.com", payload: {} }),
    false,
  );
  assert.equal(
    owned({ id: uuid, payload: { demo: NAMESPACE, seedKey: "other" } }),
    false,
  );
  assert.equal(
    owned({ id: uuid, payload: { demo: NAMESPACE, seedKey: "fixture" } }),
    true,
  );
});
test("random streams and cohort proportions are reproducible", () => {
  const a = random(2026),
    b = random(2026);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
  assert.deepEqual(
    Array.from(
      { length: 5 },
      (_, g) =>
        Array.from({ length: 1000 }, (_, i) => cohort(i)).filter((x) => x === g)
          .length,
    ),
    [200, 250, 300, 200, 50],
  );
});
test("generator replays real scoring and SRS with valid references and chronological timestamps", async () => {
  const business = await businessLogic(),
    c = config({ DEMO_USER_COUNT: "100", DEMO_ARENA_MATCH_COUNT: "200" });
  const p = generate(c, input, anchor, business),
    again = generate(c, input, anchor, business);
  assert.equal(digest(p), digest(again));
  assert.notEqual(
    digest(p),
    digest(generate({ ...c, seed: 123 }, input, anchor, business)),
  );
  const ids = new Set(p.identity!.users!.map((u) => u.id));
  for (const tables of Object.values(p))
    for (const rows of Object.values(tables))
      for (const r of rows) {
        assert.equal(owned(r), true);
        if (r.user_id) assert.ok(ids.has(r.user_id));
      }
  for (const a of p.assessment!.attempts!) {
    assert.equal(a.total_questions, 1);
    assert.equal(
      a.correct_answers,
      Object.values(a.answers).filter((v) => v === "A").length,
    );
    assert.ok(Date.parse(a.started_at) < Date.parse(anchor));
  }
  const byUser = new Map(p.identity!.users!.map((u) => [u.id, u]));
  let last = 0;
  for (const m of p.arena!.arenamatches!) {
    assert.ok(Date.parse(m.started_at) >= last);
    last = Date.parse(m.started_at);
    for (const member of p.arena!.arenamatchplayers!.filter(
      (x) => x.match_id === m.id,
    ))
      assert.ok(
        Date.parse(m.started_at) >=
          Date.parse(byUser.get(member.user_id)!.created_at),
      );
  }
  for (const s of p.learning!.learningsessions!)
    assert.equal(
      s.completed_words,
      p.learning!.learningsessionwords!.filter((w) => w.session_id === s.id)
        .length,
    );
  const frequencies = p.identity!.users!.map((u) => ({
    group: u.payload.demoCohort,
    n: p.learning!.learningsessions!.filter((s) => s.user_id === u.id).length,
  }));
  assert.ok(
    frequencies
      .filter((x) => x.group === 4)
      .every((x) => x.n > frequencies.find((x) => x.group === 0)!.n),
  );
  const state = {
    reviewCount: 0,
    correctCount: 0,
    incorrectCount: 0,
    intervalDays: 0,
    status: "LEARNING",
  };
  business.advanceReview(state, "EASY", new Date(anchor));
  business.advanceReview(state, "EASY", new Date(anchor));
  assert.equal(state.status, "MASTERED");
  business.advanceReview(state, "AGAIN", new Date(anchor));
  assert.equal(state.status, "LEARNING");
  assert.equal(state.intervalDays, 0);
});
test("record budget rejects excessive plans before persistence", async () => {
  const business = await businessLogic();
  assert.throws(
    () =>
      generate(
        { ...config({ DEMO_USER_COUNT: "50" }), maxRecords: 1 },
        input,
        anchor,
        business,
      ),
    /exceeding/,
  );
});
