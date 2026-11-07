import { NAMESPACE } from "./config.ts";
import { stableId, type Plan, type Row } from "./generator.ts";
import { activeSlices } from "./active-time.ts";
const ensure = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`Verification: ${message}`);
};
export async function verify(
  plan: Plan,
  db: Record<string, any>,
  business: Row,
) {
  const counts: Row = {};
  const users = plan.identity!.users!.map((u) => u.id),
    userSet = new Set(users);
  for (const [owner, tables] of Object.entries(plan)) {
    counts[owner] = {};
    for (const [table, expected] of Object.entries(tables)) {
      const query =
        table === "learning_activities"
          ? await db[owner].query(
              "SELECT * FROM learning_activities WHERE user_id=ANY($1::uuid[]) AND source_key LIKE $2",
              [users, `${NAMESPACE}:%`],
            )
          : await db[owner].query(
              `SELECT * FROM ${table} WHERE payload->>'demo'=$1`,
              [NAMESPACE],
            );
      ensure(
        query.rows.length === expected.length,
        `${owner}.${table}: expected ${expected.length}, actual ${query.rows.length}`,
      );
      const byKey = new Map(
        query.rows.map((r: Row) => [
          table === "learning_activities" ? r.source_key : r.id,
          r,
        ]),
      );
      for (const row of expected) {
        ensure(
          byKey.has(table === "learning_activities" ? row.source_key : row.id),
          `Missing stable record ${table}:${row.id}`,
        );
        if (row.user_id)
          ensure(userSet.has(row.user_id), `Unknown demo user ${table}`);
      }
      counts[owner][table] = query.rows.length;
    }
  }
  const attempts = (
    await db.assessment.query(
      "SELECT * FROM attempts WHERE payload->>'demo'=$1",
      [NAMESPACE],
    )
  ).rows;
  const slices = activeSlices(plan.learning!.learningsessions ?? []);
  const activeCount = Number(
    (
      await db.learning.query(
        "SELECT count(*) n FROM user_active_time_slices WHERE user_id=ANY($1::uuid[])",
        [users],
      )
    ).rows[0].n,
  );
  ensure(activeCount >= slices.length, "Missing active study time");
  counts.learning.user_active_time_slices = activeCount;
  for (const a of attempts) {
    ensure(
      a.question_snapshot.every((q: Row) =>
        q.options.some((o: Row) => o.key === q.correctAnswer),
      ),
      `Invalid answer key ${a.id}`,
    );
    const result = business.calculateAttemptResult(
      a.question_snapshot,
      a.selected_parts,
      a.answers,
      a.started_at,
      a.completed_at ??
        new Date(a.started_at.getTime() + a.duration_spent * 1000),
      a.duration_spent,
    );
    ensure(
      result.correctAnswers === a.correct_answers &&
        result.accuracy === a.accuracy,
      `TOEIC score mismatch ${a.id}`,
    );
    const answers = (
      await db.assessment.query(
        "SELECT * FROM attemptanswers WHERE attempt_id=$1",
        [a.id],
      )
    ).rows;
    ensure(
      answers.length === Object.keys(a.answers).length,
      `Answer count mismatch ${a.id}`,
    );
    ensure(
      answers.every(
        (r: Row) =>
          a.answers[r.question_id] === r.selected_answer &&
          r.is_correct ===
            (a.question_snapshot.find((q: Row) => q._id === r.question_id)
              ?.correctAnswer ===
              r.selected_answer),
      ),
      `Answer detail mismatch ${a.id}`,
    );
    ensure(
      a.started_at >=
        new Date(
          plan.identity!.users!.find((u) => u.id === a.user_id)!.created_at,
        ),
      `Attempt before registration ${a.id}`,
    );
  }
  const checks: [string, string, string][] = [
    [
      "assessment",
      "attempt exam references",
      `SELECT count(*) n FROM attempts a LEFT JOIN exams e ON e.id=a.exam_id WHERE a.payload->>'demo'=$1 AND e.id IS NULL`,
    ],
    [
      "content",
      "dictation segments",
      `SELECT count(*) n FROM dictationprogresses p JOIN dictationlessons l ON l.id=p.lesson_id WHERE p.payload->>'demo'=$1 AND (jsonb_array_length(p.completed_segments)>l.sentence_count OR p.correct_count<>jsonb_array_length(p.completed_segments) OR p.completed<>(jsonb_array_length(p.completed_segments)+jsonb_array_length(p.revealed_segments)>=l.sentence_count))`,
    ],
    [
      "learning",
      "SRS counters",
      `SELECT count(*) n FROM userwordreviews WHERE payload->>'demo'=$1 AND (correct_count+incorrect_count>review_count OR next_review_at<last_reviewed_at OR review_count<1)`,
    ],
    [
      "learning",
      "session word counts",
      `SELECT count(*) n FROM learningsessions s WHERE s.payload->>'demo'=$1 AND (s.completed_words>s.total_words OR s.completed_words<>(SELECT count(DISTINCT word_id) FROM learningsessionwords w WHERE w.session_id=s.id) OR s.ended_at<s.started_at)`,
    ],
    [
      "learning",
      "XP ledger",
      `SELECT count(*) n FROM learning_activities a LEFT JOIN learning_credit_ledger l ON l.activity_id=a.id WHERE a.source_key LIKE $1||':%' AND (l.id IS NULL OR l.xp<>a.xp)`,
    ],
    [
      "arena",
      "match participants",
      `SELECT count(*) n FROM arenamatches m WHERE m.payload->>'demo'=$1 AND ((SELECT count(*) FROM arenamatchplayers p WHERE p.match_id=m.id)<>2 OR (NOT m.is_draw AND NOT EXISTS(SELECT 1 FROM arenamatchplayers p WHERE p.match_id=m.id AND p.user_id=m.winner_id)) OR m.finished_at<m.started_at)`,
    ],
    [
      "arena",
      "profile totals",
      `SELECT count(*) n FROM arenaprofiles a WHERE a.payload->>'demo'=$1 AND (a.ranked_matches<>a.ranked_wins+a.ranked_losses+a.ranked_draws OR a.ranked_matches<>(SELECT count(*) FROM arenamatchplayers p JOIN arenamatches m ON m.id=p.match_id WHERE p.user_id=a.user_id AND m.type='RANK' AND m.status='FINISHED') OR a.ranked_wins<>(SELECT count(*) FROM arenamatches m WHERE m.type='RANK' AND m.status='FINISHED' AND m.winner_id=a.user_id))`,
    ],
    [
      "arena",
      "answer scores",
      `SELECT count(*) n FROM arenamatchplayers p WHERE p.payload->>'demo'=$1 AND p.score<>(SELECT coalesce(sum(earned_score),0) FROM arenaplayeranswers a WHERE a.match_id=p.match_id AND a.user_id=p.user_id)`,
    ],
  ];
  for (const [owner, label, sql] of checks)
    ensure(
      Number((await db[owner].query(sql, [NAMESPACE])).rows[0].n) === 0,
      label,
    );
  const history = (
    await db.arena.query(
      `SELECT h.*,p.rating_before,p.rating_after,p.rating_change,m.winner_id,m.is_draw FROM arenaratinghistories h JOIN arenamatchplayers p ON p.match_id=h.match_id AND p.user_id=h.user_id JOIN arenamatches m ON m.id=h.match_id WHERE h.payload->>'demo'=$1`,
      [NAMESPACE],
    )
  ).rows;
  for (const h of history) {
    const opponent = history.find(
      (x: Row) => x.match_id === h.match_id && x.user_id !== h.user_id,
    );
    ensure(opponent, "Missing opponent rating");
    const r = business.rating.calculateNewRating(
      h.before,
      opponent.before,
      h.is_draw ? 0.5 : h.winner_id === h.user_id ? 1 : 0,
    );
    ensure(
      r.ratingAfter === h.after &&
        h.after === h.rating_after &&
        h.change === h.rating_change,
      "Elo mismatch",
    );
  }
  // The relay must produce real display profiles; never forge consumer projections.
  for (const owner of ["arena", "learning"]) {
    const n = Number(
      (
        await db[owner].query(
          "SELECT count(*) n FROM identity_profiles WHERE id=ANY($1::uuid[]) AND is_deleted IS NOT TRUE",
          [users],
        )
      ).rows[0].n,
    );
    ensure(
      n === users.length,
      `${owner} identity projection not ready (${n}/${users.length}); retry verification after consumers catch up`,
    );
  }
  return counts;
}
