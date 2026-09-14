import { describe, expect, it } from "vitest";
import {
  AudioSegmentType,
  AudioSource,
  ContentStatus,
  Difficulty,
  ExerciseType,
  QuestionKind,
  ToeicPart,
} from "../../generated/prisma/client";
import {
  PublishValidationService,
  type PublishCandidate,
} from "./publish-validation.service";

const option = (index: number, correctIndexes: number[]) => ({
  label: String.fromCharCode(65 + index),
  content: `Authored response ${index + 1}`,
  isCorrect: correctIndexes.includes(index),
});

function candidate({
  part,
  questionCount = part === ToeicPart.PART_3 || part === ToeicPart.PART_4
    ? 3
    : 1,
  optionCount = part === ToeicPart.PART_2 ? 3 : 4,
  correctIndexes = [0],
  image = part === ToeicPart.PART_1,
  prompt = "What is the speaker discussing?",
  speakers = [],
}: {
  part: ToeicPart;
  questionCount?: number;
  optionCount?: number;
  correctIndexes?: number[];
  image?: boolean;
  prompt?: string;
  speakers?: string[];
}): PublishCandidate {
  const questions = Array.from({ length: questionCount }, (_, index) => ({
    id: `question-${index}`,
    exerciseId: "exercise-id",
    groupId: "group-id",
    questionText: prompt,
    kind: QuestionKind.MULTIPLE_CHOICE,
    correctText: null,
    imageMediaId: null,
    orderIndex: index,
    explanation: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    options: Array.from({ length: optionCount }, (_, optionIndex) =>
      option(optionIndex, correctIndexes),
    ),
  }));
  return {
    id: "exercise-id",
    lessonId: "lesson-id",
    slug: "toeic-practice",
    type: ExerciseType.TOEIC,
    dictationMode: null,
    toeicPart: part,
    title: "TOEIC practice",
    instruction: "Listen and answer.",
    difficulty: Difficulty.INTERMEDIATE,
    sourceScript: null,
    transcript: null,
    passThreshold: 80 as never,
    maxPlays: 3,
    maxAttempts: 3,
    ignoreCapitalization: true,
    ignorePunctuation: true,
    ignoreExtraSpaces: true,
    allowMinorTypo: false,
    showTranscript: false,
    showAnswerAfterSubmit: true,
    audioSource: AudioSource.UPLOAD,
    finalAudioMediaId: "audio-id",
    status: ContentStatus.DRAFT,
    orderIndex: 0,
    createdById: null,
    publishedAt: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    questions,
    groups: [
      {
        id: "group-id",
        imageMediaId: image ? "image-id" : null,
        sharedAudioMediaId: "audio-id",
        questions,
      },
    ],
    audioSegments: speakers.map((speakerKey) => ({
      groupId: "group-id",
      segmentType: AudioSegmentType.SPEAKER,
      speakerKey,
      mediaId: null,
    })),
  } as PublishCandidate;
}

describe("PublishValidationService TOEIC structure", () => {
  const service = new PublishValidationService();

  it("accepts Part 1 with a photograph, A-D, and one correct statement", () => {
    expect(service.validate(candidate({ part: ToeicPart.PART_1 }))).toEqual([]);
  });

  it("rejects Part 1 groups containing more than one item", () => {
    expect(
      service.validate(candidate({ part: ToeicPart.PART_1, questionCount: 2 })),
    ).toContain("TOEIC Part 1 requires exactly 1 item per group.");
  });

  it.each([
    [{ image: false }, "TOEIC Part 1 requires a photograph."],
    [{ optionCount: 3 }, "TOEIC Part 1 requires exactly 4 statements"],
    [{ optionCount: 5 }, "TOEIC Part 1 requires exactly 4 statements"],
    [{ correctIndexes: [] }, "exactly one correct answer"],
    [{ correctIndexes: [0, 1] }, "exactly one correct answer"],
  ])("rejects invalid Part 1 %#", (changes, message) => {
    expect(
      service.validate(candidate({ part: ToeicPart.PART_1, ...changes })),
    ).toEqual(expect.arrayContaining([expect.stringContaining(message)]));
  });

  it("accepts Part 2 with a spoken prompt and A-C", () => {
    expect(service.validate(candidate({ part: ToeicPart.PART_2 }))).toEqual([]);
  });

  it("rejects Part 2 groups containing more than one item", () => {
    expect(
      service.validate(candidate({ part: ToeicPart.PART_2, questionCount: 2 })),
    ).toContain(
      "TOEIC Part 2 requires exactly 1 question-response item per group.",
    );
  });

  it.each([
    [{ optionCount: 4 }, "exactly 3 responses"],
    [{ optionCount: 2 }, "exactly 3 responses"],
    [{ prompt: "" }, "spoken question or statement"],
    [{ correctIndexes: [0, 1] }, "exactly one correct answer"],
  ])("rejects invalid Part 2 %#", (changes, message) => {
    expect(
      service.validate(candidate({ part: ToeicPart.PART_2, ...changes })),
    ).toEqual(expect.arrayContaining([expect.stringContaining(message)]));
  });

  it("accepts a Part 3 conversation with 3 A-D questions and 2 speakers", () => {
    expect(
      service.validate(
        candidate({ part: ToeicPart.PART_3, speakers: ["a", "b"] }),
      ),
    ).toEqual([]);
  });

  it.each([
    [{ questionCount: 2 }, "exactly 3 questions"],
    [{ questionCount: 4 }, "exactly 3 questions"],
    [{ optionCount: 3 }, "exactly 4 options"],
    [{ speakers: ["a"] }, "at least 2 distinct speakers"],
  ])("rejects invalid Part 3 %#", (changes, message) => {
    expect(
      service.validate(candidate({ part: ToeicPart.PART_3, ...changes })),
    ).toEqual(expect.arrayContaining([expect.stringContaining(message)]));
  });

  it("accepts a Part 4 talk with 3 A-D questions and one speaker", () => {
    expect(
      service.validate(
        candidate({ part: ToeicPart.PART_4, speakers: ["main"] }),
      ),
    ).toEqual([]);
  });

  it.each([
    [{ questionCount: 2 }, "exactly 3 questions"],
    [{ questionCount: 4 }, "exactly 3 questions"],
    [{ optionCount: 3 }, "exactly 4 options"],
    [{ speakers: ["a", "b"] }, "exactly 1 main speaker"],
  ])("rejects invalid Part 4 %#", (changes, message) => {
    expect(
      service.validate(candidate({ part: ToeicPart.PART_4, ...changes })),
    ).toEqual(expect.arrayContaining([expect.stringContaining(message)]));
  });

  it("rejects an ungrouped TOEIC question", () => {
    const exercise = candidate({ part: ToeicPart.PART_2 });
    exercise.questions[0].groupId = null;
    expect(service.validate(exercise)).toContain(
      "TOEIC questions must belong to an exercise group.",
    );
  });

  it("requires playable audio on every TOEIC conversation", () => {
    const exercise = candidate({
      part: ToeicPart.PART_3,
      speakers: ["a", "b"],
    });
    exercise.groups.push({
      ...exercise.groups[0],
      id: "group-two",
      sharedAudioMediaId: null,
      questions: exercise.groups[0].questions.map((question) => ({
        ...question,
        groupId: "group-two",
      })),
    });
    expect(service.validate(exercise)).toContain(
      "Every TOEIC conversation requires playable audio before publishing.",
    );
  });
});
