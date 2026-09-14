import { describe, expect, it, vi } from "vitest";
import {
  AttemptStatus,
  ExerciseType,
  ToeicPart,
  UserRole,
} from "../../generated/prisma/client";
import { AttemptsService } from "./attempts.service";

describe("AttemptsService integrity", () => {
  it("rejects an attempt whose exercise differs from the route", async () => {
    const prisma = {
      listeningAttempt: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          exerciseId: "actual-exercise",
        }),
      },
      listeningExercise: { findUniqueOrThrow: vi.fn() },
    };
    const attemptAccess = { assertView: vi.fn().mockResolvedValue(undefined) };
    const service = new AttemptsService(
      prisma as never,
      {} as never,
      attemptAccess as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const student = {
      id: "student-id",
      email: "student@test.local",
      role: UserRole.STUDENT,
      clientType: "USER_WEB" as const,
    };

    await expect(
      service.result(student, "route-exercise", "attempt-id"),
    ).rejects.toMatchObject({
      code: "ATTEMPT_EXERCISE_MISMATCH",
      status: 409,
    });
    expect(attemptAccess.assertView).toHaveBeenCalledWith(
      student,
      "attempt-id",
    );
    expect(prisma.listeningExercise.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  function toeicService(
    showAnswerAfterSubmit: boolean,
    showTranscript = false,
  ) {
    const answers = [
      {
        questionId: "question-1",
        selectedOptionId: "option-correct",
        isCorrect: true,
        feedback: {
          selectedOptionId: "option-correct",
          selectedOptionText: "Selected correct",
          correctOptionId: "option-correct",
          correctOptionText: "Correct",
          explanation: "Explanation",
          isCorrect: true,
          passThreshold: 80,
          showAnswerAfterSubmit,
          showTranscript,
          toeicPart: "PART_1",
        },
      },
      {
        questionId: "question-2",
        selectedOptionId: "option-wrong",
        isCorrect: false,
        feedback: {
          selectedOptionId: "option-wrong",
          selectedOptionText: "Selected wrong",
          correctOptionId: "option-correct-2",
          correctOptionText: "Correct two",
          explanation: "Second explanation",
          isCorrect: false,
          passThreshold: 80,
          showAnswerAfterSubmit,
          showTranscript,
          toeicPart: "PART_1",
        },
      },
    ];
    const prisma = {
      listeningAttempt: {
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValueOnce({ exerciseId: "exercise-id" })
          .mockResolvedValueOnce({
            id: "attempt-id",
            status: AttemptStatus.GRADED,
            score: 50,
            passed: false,
            answers,
            exercise: {
              type: ExerciseType.TOEIC,
              passThreshold: 99,
              showAnswerAfterSubmit: !showAnswerAfterSubmit,
              showTranscript: !showTranscript,
              toeicPart: "PART_4",
              questions: [],
              groups: [
                {
                  id: "group-1",
                  title: "Conversation 1",
                  label: null,
                  sharedScript: "Woman: Good morning.\nMan: Hello.",
                  questions: [],
                },
              ],
              audioSegments: [],
            },
          }),
      },
      listeningExercise: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          type: ExerciseType.TOEIC,
          title: "TOEIC",
          lesson: { slug: "lesson", course: { slug: "course" } },
        }),
      },
    };
    return new AttemptsService(
      prisma as never,
      {} as never,
      { assertView: vi.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it("returns authoritative correctness without leaking hidden answers", async () => {
    const response = await toeicService(false).result(
      student,
      "exercise-id",
      "attempt-id",
    );
    expect(response.result).toMatchObject({
      threshold: 80,
      correctCount: 1,
      answerReviewEnabled: false,
      answers: [
        {
          selectedOptionId: "option-correct",
          isCorrect: true,
        },
        {
          selectedOptionId: "option-wrong",
          isCorrect: false,
        },
      ],
    });
    const answers = (response.result as { answers: Record<string, unknown>[] })
      .answers;
    expect(answers[0]).not.toHaveProperty("correctOptionId");
    expect(answers[0]).not.toHaveProperty("correctOptionText");
    expect(answers[0]).not.toHaveProperty("explanation");
  });

  it("returns authored TOEIC transcripts only when the snapshot permits it", async () => {
    const shown = await toeicService(true, true).result(
      student,
      "exercise-id",
      "attempt-id",
    );
    expect(shown.result).toMatchObject({
      transcripts: [
        {
          groupId: "group-1",
          label: "Conversation 1",
          text: "Woman: Good morning.\nMan: Hello.",
        },
      ],
    });

    const hidden = await toeicService(true, false).result(
      student,
      "exercise-id",
      "attempt-id",
    );
    expect(hidden.result).not.toHaveProperty("transcripts");
  });

  it("shows answer details when the submission snapshot permits it", async () => {
    const response = await toeicService(true).result(
      student,
      "exercise-id",
      "attempt-id",
    );
    expect(
      (response.result as { answers: Array<Record<string, unknown>> })
        .answers[0],
    ).toMatchObject({
      isCorrect: true,
      correctOptionId: "option-correct",
      correctOptionText: "Correct",
      explanation: "Explanation",
    });
  });

  it("does not expose a result before grading", async () => {
    const service = toeicService(false);
    const prisma = (
      service as unknown as {
        prisma: {
          listeningAttempt: { findUniqueOrThrow: ReturnType<typeof vi.fn> };
        };
      }
    ).prisma;
    prisma.listeningAttempt.findUniqueOrThrow.mockReset();
    prisma.listeningAttempt.findUniqueOrThrow
      .mockResolvedValueOnce({ exerciseId: "exercise-id" })
      .mockResolvedValueOnce({
        status: AttemptStatus.IN_PROGRESS,
        answers: [],
        exercise: {
          type: ExerciseType.TOEIC,
          questions: [],
        },
      });
    await expect(
      service.result(student, "exercise-id", "attempt-id"),
    ).rejects.toMatchObject({ code: "RESULT_NOT_READY", status: 409 });
  });

  it("enforces maxAttempts when starting another attempt", async () => {
    const tx = {
      listeningAttempt: {
        count: vi.fn().mockResolvedValue(3),
        create: vi.fn(),
      },
    };
    const prisma = {
      listeningExercise: {
        findUnique: vi.fn().mockResolvedValue({
          id: "exercise-id",
          status: "PUBLISHED",
          maxAttempts: 3,
          type: ExerciseType.DICTATION,
          lessonId: "lesson-id",
          lesson: { slug: "lesson", course: { slug: "course" } },
          finalAudioMedia: null,
          questions: [],
          groups: [],
        }),
      },
      listeningAttempt: { findFirst: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn(async (work) => work(tx)),
    };
    const service = new AttemptsService(
      prisma as never,
      { assertStudentView: vi.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.studentExercise(student, "exercise-id"),
    ).rejects.toMatchObject({ code: "ATTEMPT_LIMIT_REACHED", status: 409 });
    expect(tx.listeningAttempt.create).not.toHaveBeenCalled();
  });

  it("enforces maxPlays without recording another listen", async () => {
    const tx = {
      listeningAttempt: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          status: AttemptStatus.IN_PROGRESS,
          exerciseId: "exercise-id",
          playCount: 3,
          exercise: { maxPlays: 3 },
        }),
        update: vi.fn(),
      },
      attemptListenEvent: { create: vi.fn() },
    };
    const service = new AttemptsService(
      { $transaction: vi.fn(async (work) => work(tx)) } as never,
      {} as never,
      { assertOwner: vi.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.consumeListen(student, "exercise-id", "attempt-id"),
    ).rejects.toMatchObject({ code: "LISTEN_LIMIT_REACHED", status: 409 });
    expect(tx.attemptListenEvent.create).not.toHaveBeenCalled();
  });

  it("enforces TOEIC maxPlays independently for each group", async () => {
    let totalPlayCount = 0;
    const counts = new Map<string, number>();
    const tx = {
      listeningAttempt: {
        findUniqueOrThrow: vi.fn().mockImplementation(() => ({
          status: AttemptStatus.IN_PROGRESS,
          exerciseId: "exercise-id",
          playCount: totalPlayCount,
          exercise: { maxPlays: 2, type: ExerciseType.TOEIC },
        })),
        update: vi.fn().mockImplementation(({ data }) => {
          totalPlayCount = data.playCount;
        }),
      },
      exerciseGroup: {
        findFirst: vi
          .fn()
          .mockImplementation(({ where }) =>
            ["group-a", "group-b"].includes(where.id) ? { id: where.id } : null,
          ),
      },
      attemptListenEvent: {
        count: vi
          .fn()
          .mockImplementation(({ where }) => counts.get(where.groupId) ?? 0),
        create: vi.fn().mockImplementation(({ data }) => {
          counts.set(data.groupId, (counts.get(data.groupId) ?? 0) + 1);
        }),
      },
    };
    const service = new AttemptsService(
      { $transaction: vi.fn(async (work) => work(tx)) } as never,
      {} as never,
      { assertOwner: vi.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.consumeListen(student, "exercise-id", "attempt-id", 1, "group-a"),
    ).resolves.toMatchObject({ listenCount: 1, totalListenCount: 1 });
    await expect(
      service.consumeListen(student, "exercise-id", "attempt-id", 1, "group-a"),
    ).resolves.toMatchObject({ listenCount: 2, totalListenCount: 2 });
    await expect(
      service.consumeListen(student, "exercise-id", "attempt-id", 1, "group-a"),
    ).rejects.toMatchObject({ code: "LISTEN_LIMIT_REACHED" });
    await expect(
      service.consumeListen(student, "exercise-id", "attempt-id", 1, "group-b"),
    ).resolves.toMatchObject({ listenCount: 1, totalListenCount: 3 });
    await expect(
      service.consumeListen(student, "exercise-id", "attempt-id", 1, "group-b"),
    ).resolves.toMatchObject({ listenCount: 2, totalListenCount: 4 });
    expect(totalPlayCount).toBe(4);
  });

  it("rejects a TOEIC group from another exercise", async () => {
    const tx = {
      listeningAttempt: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          status: AttemptStatus.IN_PROGRESS,
          exerciseId: "exercise-id",
          playCount: 0,
          exercise: { maxPlays: 2, type: ExerciseType.TOEIC },
        }),
      },
      exerciseGroup: { findFirst: vi.fn().mockResolvedValue(null) },
      attemptListenEvent: { count: vi.fn(), create: vi.fn() },
    };
    const service = new AttemptsService(
      { $transaction: vi.fn(async (work) => work(tx)) } as never,
      {} as never,
      { assertOwner: vi.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.consumeListen(
        student,
        "exercise-id",
        "attempt-id",
        1,
        "foreign-group",
      ),
    ).rejects.toMatchObject({ code: "INVALID_EXERCISE_GROUP" });
    expect(tx.attemptListenEvent.create).not.toHaveBeenCalled();
  });

  it("never decreases the persisted best score", async () => {
    const tx = {
      lesson: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          courseId: "course-id",
          exercises: [{ id: "exercise-id" }],
        }),
        findMany: vi.fn().mockResolvedValue([{ id: "lesson-id" }]),
      },
      listeningAttempt: { groupBy: vi.fn().mockResolvedValue([]) },
      lessonProgress: {
        findUnique: vi.fn().mockResolvedValue({
          bestScore: 92,
          completedAt: null,
        }),
        upsert: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      },
      courseEnrollment: { upsert: vi.fn() },
    };
    const service = new AttemptsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await (
      service as unknown as {
        updateProgress(
          tx: unknown,
          lessonId: string,
          studentId: string,
          score: number,
        ): Promise<void>;
      }
    ).updateProgress(tx, "lesson-id", "student-id", 50);
    expect(tx.lessonProgress.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ bestScore: 92 }),
      }),
    );
  });
});

const student = {
  id: "student-id",
  email: "student@test.local",
  role: UserRole.STUDENT,
  clientType: "USER_WEB" as const,
};

describe("AttemptsService student exercise DTO", () => {
  async function response(part: ToeicPart) {
    const options = ["A", "B", "C", "D"].map((label, index) => ({
      id: `option-${label}`,
      label,
      content: `Hidden or visible option ${label}`,
      isCorrect: index === 0,
      orderIndex: index,
    }));
    if (part === ToeicPart.PART_2) options.pop();
    const prisma = {
      listeningExercise: {
        findUnique: vi.fn().mockResolvedValue({
          id: "exercise-id",
          lessonId: "lesson-id",
          status: "PUBLISHED",
          type: ExerciseType.TOEIC,
          toeicPart: part,
          title: "TOEIC practice",
          maxPlays: 3,
          maxAttempts: 3,
          passThreshold: 80,
          lesson: { slug: "lesson", course: { slug: "course" } },
          finalAudioMedia: null,
          questions: [],
          groups: [
            {
              id: "group-id",
              sharedScript: "Hidden transcript",
              image: null,
              sharedAudio: {
                id: "audio-id",
                durationMs: 2_000,
                mimeType: "audio/wav",
              },
              questions: [
                {
                  id: "question-id",
                  questionText: "Spoken prompt or visible question",
                  image: {
                    id: "question-image-id",
                  },
                  options,
                },
              ],
            },
          ],
        }),
      },
      listeningAttempt: {
        findFirst: vi.fn().mockResolvedValue({
          id: "attempt-id",
          attemptNumber: 1,
          playCount: 0,
          status: AttemptStatus.IN_PROGRESS,
          answers: [],
        }),
      },
      attemptListenEvent: {
        groupBy: vi
          .fn()
          .mockResolvedValue([{ groupId: "group-id", _count: { _all: 2 } }]),
      },
    };
    const service = new AttemptsService(
      prisma as never,
      { assertStudentView: vi.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return service.studentExercise(student, "exercise-id");
  }

  it.each([ToeicPart.PART_1, ToeicPart.PART_2])(
    "does not expose spoken prompt or option text for %s",
    async (part) => {
      const result = await response(part);
      const question = result.groups?.[0]?.questions[0];
      expect(question).not.toHaveProperty("prompt");
      expect(question?.options[0]).not.toHaveProperty("text");
      expect(question?.options[0]).not.toHaveProperty("isCorrect");
    },
  );

  it.each([ToeicPart.PART_3, ToeicPart.PART_4])(
    "exposes question/options and graphic without correctness for %s",
    async (part) => {
      const result = await response(part);
      const question = result.groups?.[0]?.questions[0];
      expect(question).toMatchObject({
        prompt: "Spoken prompt or visible question",
        image: "/api/v1/media/files/question-image-id",
      });
      expect(question?.options[0]).toMatchObject({
        label: "A",
        text: "Hidden or visible option A",
      });
      expect(question?.options[0]).not.toHaveProperty("isCorrect");
    },
  );

  it("returns the current attempt listen count on each TOEIC group", async () => {
    const result = await response(ToeicPart.PART_3);
    expect(result.groups?.[0]).toMatchObject({ listenCount: 2 });
    expect(result.attempt.listenCount).toBe(0);
  });
});
