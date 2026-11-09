import { createHash } from "node:crypto";
import { NAMESPACE, type DemoConfig } from "./config.ts";
export const DAY = 86400000;
export type Row = Record<string, any>;
export type Plan = Record<string, Record<string, Row[]>>;
export function stableId(key: string) {
  const h = createHash("sha256").update(`${NAMESPACE}:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function cohort(i: number) {
  const n = i % 100;
  return n < 20 ? 0 : n < 45 ? 1 : n < 75 ? 2 : n < 95 ? 3 : 4;
}
export function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function generate(
  c: DemoConfig,
  input: Row,
  anchor: string,
  business: Row,
) {
  const rng = random(c.seed),
    pick = <T>(a: T[]): T => a[Math.floor(rng() * a.length)]!;
  const int = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const iso = (ms: number) => new Date(ms).toISOString();
  const end = new Date(anchor).getTime(),
    start = end - c.days * DAY;
  const plan: Plan = {
    identity: {},
    assessment: {},
    content: {},
    learning: {},
    arena: {},
  };
  const add = (owner: string, table: string, key: string, data: Row): Row => {
    const row: Row = {
      id: stableId(key),
      ...data,
      payload: { ...data.payload, demo: NAMESPACE, seedKey: key },
      created_at:
        data.created_at ?? data.started_at ?? data.answered_at ?? anchor,
      updated_at: data.updated_at ?? anchor,
    };
    (plan[owner]![table] ??= []).push(row);
    return row;
  };
  const activity = (
    key: string,
    user: Row,
    module: string,
    type: string,
    xp: number,
    when: string,
    extra: Row,
  ) => {
    add("learning", "learning_activities", `activity:${key}`, {
      user_id: user.id,
      module,
      type,
      source_key: `${NAMESPACE}:${key}`,
      xp,
      occurred_at: when,
      created_at: when,
      ...extra,
    });
  };
  const users: Row[] = [];
  const surnames = [
    "Nguyen",
    "Tran",
    "Le",
    "Pham",
    "Hoang",
    "Phan",
    "Vu",
    "Dang",
  ];
  const names = [
    "Minh Anh",
    "Thanh Ha",
    "Quang Huy",
    "Bao Ngoc",
    "Gia Linh",
    "Duc Anh",
    "Thao Vy",
    "Tuan Kiet",
    "Mai Chi",
    "Hai Nam",
  ];
  const daily = new Map<string, Row>();
  for (let i = 0; i < c.users; i++) {
    const group = cohort(i),
      tag = String(i + 1).padStart(4, "0");
    const registered =
      start + int(0, group === 0 ? c.days - 2 : Math.floor(c.days / 3)) * DAY;
    const u = add("identity", "users", `user:${i}`, {
      email: `demo.user${tag}@example.com`,
      username: `demo_${tag}`,
      auth_provider: "local",
      is_verified: true,
      is_banned: false,
      is_deleted: false,
      last_active: anchor,
      created_at: iso(registered),
      payload: {
        fullName: `${pick(surnames)} ${pick(names)}`,
        demoCohort: group,
      },
    });
    users.push(u);
    const count = (c.users > 1000 ? [1, 2, 3, 4, 5] : [1, 2, 4, 7, 10])[group]!;
    const times = Array.from(
      { length: count },
      (_, j) =>
        registered + ((end - registered - 2 * 3600000) * (j + 1)) / (count + 1),
    );
    const wordState = new Map<string, Row>(),
      learned = new Map<string, Row>(),
      progress = new Map<string, Row>();
    for (let j = 0; j < count; j++) {
      const whenMs = times[j]!,
        when = iso(whenMs),
        skill = Math.max(
          0.15,
          Math.min(
            0.96,
            0.35 +
              group * 0.13 +
              ((i % 3 === 0 ? -0.12 : i % 3 === 1 ? 0.12 : 0) * j) / count,
          ),
        );
      // Published exam snapshots are ordered exactly once; every answer is an existing option key.
      if (input.exams.length && (j % 2 === 0 || group > 2)) {
        const exam = pick<Row>(input.exams),
          allQuestions = input.questions.filter(
            (q: Row) => q.exam_id === exam.id,
          );
        const fullTest = i % 5 === 0 && j % 3 === 0;
        const practicePart = allQuestions.some((q: Row) => q.part === 5)
          ? 5
          : allQuestions[0].part;
        const questions = fullTest
          ? allQuestions
          : allQuestions.filter((q: Row) => q.part === practicePart);
        const snapshot = questions.map((q: Row) => ({
          _id: q.id,
          part: q.part,
          content: q.content,
          options: q.options.map((o: Row) => ({ key: o.key, text: o.text })),
          correctAnswer: q.correct_answer,
          explanation: q.explanation,
          imageUrl: q.image_url,
          audioUrl: q.audio_url,
          passageGroupId: q.passage_group_id,
          passages: input.passages
            .filter((p: Row) => p.passage_group_id === q.passage_group_id)
            .map((p: Row) => ({
              _id: p.id,
              content: q.part <= 4 ? undefined : p.content,
              audioUrl: p.audio_url,
              imageUrl: p.image_url,
            })),
        }));
        const parts = [
          ...new Set<number>(questions.map((q: Row) => q.part)),
        ].sort();
        const answers: Row = {},
          incomplete = j === count - 1 && i % 10 === 9;
        for (const q of questions)
          if (rng() > (incomplete ? 0.65 : 0.035))
            answers[q.id] =
              rng() < skill
                ? q.correct_answer
                : pick<Row>(
                    q.options.filter((o: Row) => o.key !== q.correct_answer),
                  ).key;
        const duration = Math.min(
          (exam.duration_minutes || 120) * 60,
          Math.max(60, questions.length * int(15, 35)),
        );
        const done = iso(whenMs + duration * 1000);
        const result = business.calculateAttemptResult(
          snapshot,
          parts,
          answers,
          new Date(when),
          new Date(done),
          duration,
        );
        const key = `attempt:${i}:${j}`;
        const attempt = add("assessment", "attempts", key, {
          user_id: u.id,
          exam_id: exam.id,
          mode: fullTest ? "TEST" : "PRACTICE",
          started_at: when,
          ...Object.fromEntries(
            Object.entries(result).map(([k, v]) => [
              k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase()),
              v,
            ]),
          ),
          status: incomplete ? "ABANDONED" : "FINISHED",
          question_snapshot: snapshot,
          answers,
          selected_parts: parts,
          exam_snapshot: { _id: exam.id, name: exam.name, type: exam.type },
          exam_publication_revision: exam.publication_revision,
        });
        if (incomplete) {
          attempt.completed_at = null;
          attempt.submitted_at = null;
          attempt.score = null;
        }
        for (const q of questions)
          if (answers[q.id])
            add("assessment", "attemptanswers", `${key}:${q.id}`, {
              attempt_id: attempt.id,
              question_id: q.id,
              selected_answer: answers[q.id],
              is_correct: answers[q.id] === q.correct_answer,
              answered_at: done,
              created_at: when,
            });
        if (!incomplete)
          activity(
            key,
            u,
            "TOEIC",
            "TOEIC_ATTEMPT",
            business.toeicAttemptXp(result.correctAnswers),
            done,
            {
              title: exam.name,
              ref_id: attempt.id,
              link: `/toeic/attempts/${attempt.id}`,
              correct: result.correctAnswers,
              total: questions.length,
              score: fullTest
                ? business.estimateToeicScore(
                    result.listeningResult,
                    result.readingResult,
                  )?.total
                : null,
              duration_sec: duration,
            },
          );
      }
      const lesson =
        input.lessons[(i + Math.floor(j / 3)) % input.lessons.length];
      const allWords: Row[] = input.lessonwords.filter(
        (w: Row) => w.lesson_id === lesson.id,
      );
      const words = allWords.slice(
        0,
        Math.min(allWords.length, [4, 7, 10, 15, 24][group]!),
      );
      const sessionKey = `session:${i}:${j}`,
        duration = Math.max(60, words.length * 30),
        ended = iso(whenMs + duration * 1000);
      const session = add("learning", "learningsessions", sessionKey, {
        user_id: u.id,
        type: j % 3 ? "REVIEW" : "LESSON",
        lesson_id: lesson.id,
        started_at: when,
        ended_at: ended,
        duration_seconds: duration,
        total_words: allWords.length,
        completed_words: words.length,
      });
      const dayKey = `${u.id}:${when.slice(0, 10)}`;
      const day = daily.get(dayKey) ?? {
        user_id: u.id,
        date: when.slice(0, 10) + "T00:00:00.000Z",
        study_minutes: 0,
        words_learned: 0,
        words_reviewed: 0,
        session_count: 0,
        created_at: when,
      };
      day.study_minutes += Math.round(duration / 60);
      day.session_count++;
      for (const lw of words) {
        const rating =
          rng() < skill ? (rng() < 0.5 ? "EASY" : "GOOD") : "AGAIN";
        const state = wordState.get(lw.word_id) ?? {
          status: "LEARNING",
          reviewCount: 0,
          correctCount: 0,
          incorrectCount: 0,
          intervalDays: 0,
        };
        const first = !state.reviewCount;
        business.advanceReview(state, rating, new Date(ended));
        wordState.set(lw.word_id, state);
        add("learning", "learningsessionwords", `${sessionKey}:${lw.id}`, {
          session_id: session.id,
          word_id: lw.word_id,
          lesson_word_id: lw.id,
          mode: "FLASHCARD",
          rating,
          is_correct: rating !== "AGAIN",
          answered_at: ended,
        });
        const prior = learned.get(lw.id);
        learned.set(lw.id, {
          user_id: u.id,
          lesson_word_id: lw.id,
          learned_at: prior?.learned_at ?? ended,
          completed_at:
            rating === "AGAIN" ? (prior?.completed_at ?? null) : ended,
        });
        day[first ? "words_learned" : "words_reviewed"]++;
        activity(
          `${sessionKey}:${lw.id}`,
          u,
          "VOCABULARY",
          first ? "WORD_LEARNED" : "WORD_REVIEWED",
          first ? business.XP.WORD_LEARNED : business.XP.WORD_REVIEWED,
          ended,
          { ref_id: stableId(`review:${i}:${lw.word_id}`) },
        );
      }
      daily.set(dayKey, day);
      const learnedCount = allWords.filter((w) => learned.has(w.id)).length;
      const percent = Math.round(
        (learnedCount / Math.max(1, allWords.length)) * 100,
      );
      progress.set(lesson.id, {
        user_id: u.id,
        lesson_id: lesson.id,
        started_at: progress.get(lesson.id)?.started_at ?? when,
        last_studied_at: ended,
        progress: percent,
        status: percent === 100 ? "COMPLETED" : "IN_PROGRESS",
        completed_at: percent === 100 ? ended : null,
      });
      activity(
        sessionKey,
        u,
        "VOCABULARY",
        "VOCAB_SESSION",
        business.XP.VOCAB_SESSION,
        ended,
        {
          title: lesson.title,
          ref_id: session.id,
          link: "/vocabulary",
          correct: words.length,
          total: allWords.length,
          duration_sec: duration,
        },
      );
    }
    for (const [word, state] of wordState)
      add("learning", "userwordreviews", `review:${i}:${word}`, {
        user_id: u.id,
        word_id: word,
        created_at: u.created_at,
        ...Object.fromEntries(
          Object.entries(state).map(([k, v]) => [
            k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase()),
            v,
          ]),
        ),
      });
    for (const [id, row] of learned)
      add("learning", "userlessonwords", `learned:${i}:${id}`, {
        ...row,
        created_at: row.learned_at,
      });
    for (const [id, row] of progress)
      add("learning", "userlessonprogresses", `progress:${i}:${id}`, {
        ...row,
        created_at: row.started_at,
      });
    // The current Dictation contract persists cumulative per-lesson segment progress, not separate sessions.
    for (let j = 0; j < Math.min(input.dictation.length, group + 1); j++) {
      const lesson = input.dictation[(i + j) % input.dictation.length],
        segments = input.segments.filter((s: Row) => s.lesson_id === lesson.id);
      const completed = i % 5 !== 0,
        handled = completed
          ? segments.length
          : Math.max(1, Math.floor(segments.length / 2));
      const when = iso(times[times.length - 1]! + 3600000);
      const states = segments.slice(0, handled).map((s: Row, index: number) => {
        const wrong = rng() < 0.35 + group * 0.12 ? 0 : 1;
        return {
          segmentIndex: index,
          attempts: wrong + 1,
          wrongAttempts: wrong,
          replayCount: wrong,
          correct: true,
          firstTryCorrect: !wrong,
          revealed: false,
          completedAt: when,
        };
      });
      const key = `dictation:${i}:${lesson.id}`;
      const p = add("content", "dictationprogresses", key, {
        user_id: u.id,
        lesson_id: lesson.id,
        current_segment: Math.min(handled, segments.length - 1),
        completed_segments: states.map((s: Row) => s.segmentIndex),
        revealed_segments: [],
        segment_progress: states,
        correct_count: handled,
        wrong_count: states.reduce(
          (n: number, s: Row) => n + s.wrongAttempts,
          0,
        ),
        attempts: states.reduce((n: number, s: Row) => n + s.attempts, 0),
        completed,
        last_practiced_at: when,
        created_at: when,
      });
      if (completed)
        activity(
          key,
          u,
          "DICTATION",
          "DICTATION_LESSON",
          business.dictationLessonXp(
            states.filter((s: Row) => s.firstTryCorrect).length,
          ),
          when,
          {
            title: lesson.title,
            ref_id: lesson.id,
            link: `/dictation/${lesson.slug}`,
            correct: handled,
            total: segments.length,
            duration_sec: Math.round(
              (lesson.total_duration_ms ?? 60000) / 1000,
            ),
            metadata: {
              firstTryCorrect: states.filter((s: Row) => s.firstTryCorrect)
                .length,
              revealed: 0,
              progressId: p.id,
            },
          },
        );
    }
  }
  for (const [key, row] of daily)
    add("learning", "userdailyactivities", `daily:${key}`, row);
  const profiles = users.map((u, i) =>
    add("arena", "arenaprofiles", `arena-profile:${i}`, {
      user_id: u.id,
      created_at: u.created_at,
      rating: 1000,
      ranked_matches: 0,
      ranked_wins: 0,
      ranked_losses: 0,
      ranked_draws: 0,
      current_win_streak: 0,
      best_win_streak: 0,
    }),
  );
  const secondRegistration = users
    .map((u) => Date.parse(u.created_at))
    .sort((a, b) => a - b)[1]!;
  const earliest = Math.max(
    start + (Math.floor(c.days / 3) + 1) * DAY,
    secondRegistration,
  );
  for (let m = 0; m < c.matches; m++) {
    // Chronological replay; no match predates either participant's registration.
    const whenMs =
        earliest + ((end - earliest - 600000) * (m + 1)) / (c.matches + 1),
      when = iso(whenMs),
      finished = iso(whenMs + 150000);
    const eligible = users
      .map((u, i) => ({ u, i }))
      .filter(({ u }) => new Date(u.created_at).getTime() <= whenMs);
    const ai = m % eligible.length,
      bi = (ai + 1 + int(0, eligible.length - 2)) % eligible.length;
    const a = eligible[ai]!.i,
      b = eligible[bi]!.i,
      ua = users[a]!,
      ub = users[b]!;
    const key = `match:${m}`,
      mid = stableId(key),
      players = [ua, ub],
      indexes = [a, b];
    const stats = players.map(() => ({
      score: 0,
      correct: 0,
      wrong: 0,
      unanswered: 0,
      streak: 0,
      best: 0,
      time: 0,
      scored: [] as string[],
    }));
    for (let q = 0; q < 5; q++) {
      const word = pick<Row>(input.arenaWords),
        qid = stableId(`${key}:q:${q}`),
        qs = iso(whenMs + q * 30000);
      const attempts = players.map((u, p) => ({
        p,
        ok: rng() < 0.3 + cohort(indexes[p]!) * 0.14,
        elapsed: int(1500, 26000),
      }));
      const winner = attempts
        .filter((x) => x.ok)
        .sort((x, y) => x.elapsed - y.elapsed)[0];
      add("arena", "arenamatchquestions", `${key}:q:${q}`, {
        match_id: mid,
        vocabulary_id: word.id,
        order: q + 1,
        type: "MEANING_TO_WORD",
        question: word.meaning,
        correct_answer: word.word,
        options: [],
        started_at: qs,
        resolved_at: iso(whenMs + q * 30000 + (winner?.elapsed ?? 30000)),
        winner_id: winner ? players[winner.p]!.id : null,
      });
      for (const attempt of attempts) {
        const s = stats[attempt.p]!,
          won = winner?.p === attempt.p;
        const hasAnswered =
          won || (!attempt.ok && attempt.elapsed < (winner?.elapsed ?? 30000));
        const elapsed = hasAnswered ? attempt.elapsed : 30000;
        const score = won
          ? business.scoring.calculateQuestionScore({
              timeLimitMs: 30000,
              elapsedMs: elapsed,
              wrongAttempts: 0,
            })
          : 0;
        s.score += score;
        s.time += hasAnswered ? elapsed : 0;
        s.scored.push(qid);
        if (won) {
          s.correct++;
          s.streak++;
          s.best = Math.max(s.best, s.streak);
        } else {
          s.streak = 0;
          if (hasAnswered) s.wrong++;
          else s.unanswered++;
        }
        add("arena", "arenaplayeranswers", `${key}:q:${q}:a:${attempt.p}`, {
          match_id: mid,
          match_question_id: qid,
          user_id: players[attempt.p]!.id,
          selected_answer: won
            ? word.word
            : hasAnswered
              ? "incorrect demo answer"
              : null,
          attempts: hasAnswered ? 1 : 0,
          is_correct: won,
          timed_out: !hasAnswered,
          response_time_ms: elapsed,
          earned_score: score,
          streak_at_answer: s.streak,
          answered_at: iso(whenMs + q * 30000 + (winner?.elapsed ?? 30000)),
          created_at: qs,
        });
      }
    }
    const winner =
      stats[0]!.score === stats[1]!.score
        ? "DRAW"
        : stats[0]!.score > stats[1]!.score
          ? "A"
          : "B";
    const rating = business.rating.calculateMatch(
      profiles[a]!.rating,
      profiles[b]!.rating,
      winner,
    );
    add("arena", "arenamatches", key, {
      type: "RANK",
      status: "FINISHED",
      question_mode: "MEANING_TO_WORD",
      question_count: 5,
      current_question_index: 4,
      seconds_per_question: 30,
      started_at: when,
      finished_at: finished,
      winner_id: winner === "DRAW" ? null : players[winner === "A" ? 0 : 1]!.id,
      is_draw: winner === "DRAW",
      finish_reason: "NORMAL",
      runtime_policy: { kFactor: 32 },
    });
    for (let p = 0; p < 2; p++) {
      const u = players[p]!,
        profile = profiles[indexes[p]!]!,
        s = stats[p]!,
        r = p === 0 ? rating.playerA : rating.playerB,
        won = winner === (p === 0 ? "A" : "B");
      add("arena", "arenamatchplayers", `${key}:player:${p}`, {
        match_id: mid,
        user_id: u.id,
        score: s.score,
        correct_answers: s.correct,
        wrong_answers: s.wrong,
        unanswered: s.unanswered,
        current_streak: s.streak,
        longest_streak: s.best,
        total_response_time_ms: s.time,
        scored_question_ids: s.scored,
        rating_before: r.ratingBefore,
        rating_after: r.ratingAfter,
        rating_change: r.ratingChange,
        status: "FINISHED",
        finished_at: finished,
        created_at: when,
      });
      add("arena", "arenaratinghistories", `${key}:rating:${p}`, {
        match_id: mid,
        user_id: u.id,
        before: r.ratingBefore,
        after: r.ratingAfter,
        change: r.ratingChange,
        created_at: finished,
      });
      profile.rating = r.ratingAfter;
      profile.ranked_matches++;
      profile[
        won
          ? "ranked_wins"
          : winner === "DRAW"
            ? "ranked_draws"
            : "ranked_losses"
      ]++;
      profile.current_win_streak = won ? profile.current_win_streak + 1 : 0;
      profile.best_win_streak = Math.max(
        profile.best_win_streak,
        profile.current_win_streak,
      );
      activity(
        `${key}:${p}`,
        u,
        "ARENA",
        "ARENA_MATCH",
        business.arenaMatchXp(won),
        finished,
        {
          title: "Arena",
          ref_id: mid,
          link: "/arena",
          correct: s.correct,
          total: 5,
          score: s.score,
          duration_sec: 150,
          metadata: {
            matchType: "RANK",
            won,
            isDraw: winner === "DRAW",
            ratingChange: r.ratingChange,
          },
        },
      );
    }
  }
  const total =
    Object.values(plan)
      .flatMap(Object.values)
      .reduce((sum, rows) => sum + rows.length, 0) +
    (plan.learning!.learningsessions ?? []).reduce(
      (sum, s) => sum + Math.ceil(s.duration_seconds / 30),
      0,
    );
  if (total > c.maxRecords)
    throw new Error(
      `Plan contains ${total} records, exceeding DEMO_MAX_RECORDS=${c.maxRecords}`,
    );
  return plan;
}
