import { describe, expect, it, vi } from "vitest";
import {
  AudioSource,
  DictationMode,
  Difficulty,
  ExerciseType,
  QuestionKind,
  ToeicPart,
  UserRole,
} from "../../generated/prisma/client";
import { ExercisesService } from "./exercises.service";

const admin = {
  id: "admin-id",
  email: "admin@test.local",
  role: UserRole.ADMIN,
  clientType: "ADMIN_WEB" as const,
};

const currentDictation = {
  id: "exercise-id",
  type: ExerciseType.DICTATION,
  dictationMode: DictationMode.SENTENCE,
  toeicPart: null,
  sourceScript: "Original",
  transcript: "Original",
  passThreshold: 80,
  maxPlays: 3,
  maxAttempts: 3,
  ignoreCapitalization: true,
  ignorePunctuation: true,
  ignoreExtraSpaces: true,
  allowMinorTypo: false,
  showAnswerAfterSubmit: true,
  showTranscript: false,
  audioSource: AudioSource.UPLOAD,
  finalAudioMediaId: null,
  groups: [],
  questions: [
    {
      id: "dictation-question",
      groupId: null,
      questionText: "Type what you hear.",
      kind: QuestionKind.TEXT_INPUT,
      correctText: "Original answer",
      explanation: null,
      imageMediaId: null,
      options: [],
    },
  ],
  audioSegments: [],
};

const currentToeic = {
  ...currentDictation,
  type: ExerciseType.TOEIC,
  dictationMode: null,
  toeicPart: ToeicPart.PART_3,
  groups: [
    {
      id: "group-id",
      questions: [
        {
          id: "question-id",
          groupId: "group-id",
          questionText: "What are the speakers discussing?",
          kind: QuestionKind.MULTIPLE_CHOICE,
          correctText: null,
          explanation: "They mention a delayed delivery.",
          imageMediaId: null,
          options: [
            {
              id: "option-a",
              content: "A delivery",
              isCorrect: true,
            },
            {
              id: "option-b",
              content: "A meeting",
              isCorrect: false,
            },
          ],
        },
      ],
    },
  ],
  questions: [],
};

function serviceWith(
  aggregate: Record<string, unknown>,
  current: Record<string, unknown> = currentDictation,
) {
  const tx = {
    listeningAttempt: {
      aggregate: vi.fn().mockResolvedValue(aggregate),
    },
    attemptListenEvent: { groupBy: vi.fn().mockResolvedValue([]) },
    listeningExercise: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(current),
      update: vi.fn(),
    },
    exerciseAudioSegment: { deleteMany: vi.fn() },
    exerciseGroup: { deleteMany: vi.fn(), create: vi.fn() },
    exerciseQuestion: { deleteMany: vi.fn(), create: vi.fn() },
  };
  const prisma = { $transaction: vi.fn(async (work) => work(tx)) };
  const service = new ExercisesService(
    prisma as never,
    {} as never,
    { assertManage: vi.fn() } as never,
    {} as never,
  );
  (service as unknown as { adminGet: ReturnType<typeof vi.fn> }).adminGet = vi
    .fn()
    .mockResolvedValue({});
  return { service, tx };
}

const dictationDraft = {
  type: ExerciseType.DICTATION,
  title: "Editable title",
  instruction: "Editable instruction",
  orderIndex: 0,
  dictationMode: DictationMode.SENTENCE,
  toeicPart: null,
  difficulty: Difficulty.INTERMEDIATE,
  sourceScript: "Original",
  passThreshold: 80,
  maxPlays: 3,
  maxAttempts: 3,
  ignoreCapitalization: true,
  ignorePunctuation: true,
  ignoreExtraSpaces: true,
  allowMinorTypo: false,
  showTranscript: false,
  showAnswerAfterSubmit: true,
  correctText: "Original answer",
};

const toeicDraft = {
  ...dictationDraft,
  type: ExerciseType.TOEIC,
  dictationMode: null,
  toeicPart: ToeicPart.PART_3,
  groups: [
    {
      id: "group-id",
      title: "Conversation",
      questions: [
        {
          id: "question-id",
          text: "What are the speakers discussing?",
          explanation: "They mention a delayed delivery.",
          options: [
            { id: "option-a", text: "A delivery", correct: true },
            { id: "option-b", text: "A meeting", correct: false },
          ],
        },
      ],
    },
  ],
};

describe("ExercisesService grading configuration lock", () => {
  it("allows grading changes before any attempt exists", async () => {
    const { service, tx } = serviceWith({
      _count: 0,
      _max: { attemptNumber: null, playCount: null },
    });
    await service.update(admin, "exercise-id", { passThreshold: 75 });
    expect(tx.listeningExercise.update).toHaveBeenCalled();
  });

  it.each(["IN_PROGRESS", "GRADED"])(
    "blocks grading changes when a %s attempt exists",
    async () => {
      const { service, tx } = serviceWith({
        _count: 1,
        _max: { attemptNumber: 1, playCount: 1 },
      });
      await expect(
        service.update(admin, "exercise-id", { passThreshold: 75 }),
      ).rejects.toMatchObject({
        status: 409,
        response: {
          code: "EXERCISE_GRADING_CONFIG_LOCKED",
          message:
            "Grading configuration cannot be changed after attempts exist.",
        },
      });
      expect(tx.listeningExercise.update).not.toHaveBeenCalled();
    },
  );

  it("keeps title and instruction metadata editable after attempts", async () => {
    const { service, tx } = serviceWith({
      _count: 1,
      _max: { attemptNumber: 2, playCount: 3 },
    });
    await service.update(admin, "exercise-id", {
      title: "Safer title",
      instruction: "Updated instructions",
    });
    expect(tx.listeningExercise.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "Safer title" }),
      }),
    );
  });

  it("blocks limits below attempts or plays already used", async () => {
    const { service } = serviceWith({
      _count: 2,
      _max: { attemptNumber: 2, playCount: 3 },
    });
    await expect(
      service.update(admin, "exercise-id", { maxAttempts: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.update(admin, "exercise-id", { maxPlays: 2 }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("uses the maximum TOEIC group count instead of total playCount", async () => {
    const { service, tx } = serviceWith(
      { _count: 2, _max: { attemptNumber: 2, playCount: 5 } },
      currentToeic,
    );
    tx.attemptListenEvent.groupBy.mockResolvedValue([
      { attemptId: "attempt-1", groupId: "group-id", _count: { _all: 2 } },
      { attemptId: "attempt-2", groupId: "group-id", _count: { _all: 2 } },
    ]);

    await service.update(admin, "exercise-id", { maxPlays: 2 });
    expect(tx.listeningExercise.update).toHaveBeenCalled();
  });

  it("blocks TOEIC maxPlays below the historical per-group maximum", async () => {
    const { service, tx } = serviceWith(
      { _count: 1, _max: { attemptNumber: 1, playCount: 5 } },
      currentToeic,
    );
    tx.attemptListenEvent.groupBy.mockResolvedValue([
      { attemptId: "attempt-1", groupId: "group-id", _count: { _all: 3 } },
    ]);

    await expect(
      service.update(admin, "exercise-id", { maxPlays: 2 }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("blocks changing the Dictation correct text through saveDraft", async () => {
    const { service, tx } = serviceWith({
      _count: 1,
      _max: { attemptNumber: 1, playCount: 1 },
    });

    await expect(
      service.saveDraft(admin, "exercise-id", {
        ...dictationDraft,
        correctText: "Changed answer",
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: "EXERCISE_GRADING_CONFIG_LOCKED" },
    });
    expect(tx.listeningExercise.update).not.toHaveBeenCalled();
  });

  it("blocks changing a TOEIC correct option through saveDraft", async () => {
    const { service, tx } = serviceWith(
      { _count: 1, _max: { attemptNumber: 1, playCount: 1 } },
      currentToeic,
    );

    await expect(
      service.saveDraft(admin, "exercise-id", {
        ...toeicDraft,
        groups: [
          {
            ...toeicDraft.groups[0],
            questions: [
              {
                ...toeicDraft.groups[0].questions[0],
                options: [
                  { id: "option-a", text: "A delivery", correct: false },
                  { id: "option-b", text: "A meeting", correct: true },
                ],
              },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: "EXERCISE_GRADING_CONFIG_LOCKED" },
    });
    expect(tx.listeningExercise.update).not.toHaveBeenCalled();
  });

  it("blocks replacing TOEIC question structure after an attempt starts", async () => {
    const { service } = serviceWith(
      { _count: 1, _max: { attemptNumber: 1, playCount: 0 } },
      currentToeic,
    );

    await expect(
      service.saveDraft(admin, "exercise-id", {
        ...toeicDraft,
        groups: [
          {
            ...toeicDraft.groups[0],
            questions: [
              ...toeicDraft.groups[0].questions,
              {
                id: "new-question",
                text: "When will it arrive?",
                options: [
                  { id: "new-a", text: "Today", correct: true },
                  { id: "new-b", text: "Tomorrow", correct: false },
                ],
              },
            ],
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("allows title and instruction changes through saveDraft after attempts", async () => {
    const { service, tx } = serviceWith({
      _count: 1,
      _max: { attemptNumber: 1, playCount: 1 },
    });

    await service.saveDraft(admin, "exercise-id", {
      ...dictationDraft,
      title: "Updated display title",
      instruction: "Updated display instruction",
    });

    expect(tx.listeningExercise.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Updated display title",
          instruction: "Updated display instruction",
        }),
      }),
    );
    expect(tx.exerciseQuestion.deleteMany).not.toHaveBeenCalled();
  });
});
