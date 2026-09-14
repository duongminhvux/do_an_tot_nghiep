import { Injectable } from "@nestjs/common";
import {
  AudioSegmentType,
  ExerciseType,
  QuestionKind,
  ToeicPart,
  type ListeningExercise,
} from "../../generated/prisma/client";

interface PublishQuestion {
  groupId: string | null;
  kind: QuestionKind;
  questionText: string;
  correctText: string | null;
  imageMediaId: string | null;
  options: { label: string; content: string; isCorrect: boolean }[];
}

interface PublishGroup {
  id: string;
  imageMediaId: string | null;
  sharedAudioMediaId: string | null;
  questions: PublishQuestion[];
}

export interface PublishCandidate extends ListeningExercise {
  questions: PublishQuestion[];
  groups: PublishGroup[];
  audioSegments: {
    groupId: string | null;
    segmentType: AudioSegmentType;
    speakerKey: string | null;
    mediaId: string | null;
  }[];
}

@Injectable()
export class PublishValidationService {
  validate(exercise: PublishCandidate): string[] {
    const errors: string[] = [];
    if (!exercise.title.trim()) errors.push("Exercise title is required.");
    if (!exercise.instruction.trim())
      errors.push("Student instructions are required.");
    if (exercise.type === ExerciseType.DICTATION) {
      if (!exercise.finalAudioMediaId) {
        errors.push("Dictation requires playable audio.");
      }
      const question = exercise.questions.find(
        (item) => item.kind === QuestionKind.TEXT_INPUT,
      );
      if (!question?.correctText?.trim())
        errors.push("Dictation requires a correct transcript.");
    } else {
      const questions = exercise.groups.flatMap((group) => group.questions);
      if (!questions.length) errors.push("TOEIC requires at least one item.");
      if (!exercise.groups.length)
        errors.push("TOEIC requires at least one exercise group.");
      if (exercise.questions.some((question) => !question.groupId)) {
        errors.push("TOEIC questions must belong to an exercise group.");
      }
      if (exercise.groups.some((group) => !group.sharedAudioMediaId)) {
        errors.push(this.groupAudioError(exercise.toeicPart));
      }
      if (exercise.toeicPart === ToeicPart.PART_1) {
        for (const group of exercise.groups) {
          if (group.questions.length !== 1) {
            errors.push("TOEIC Part 1 requires exactly 1 item per group.");
          }
          const question = group.questions[0];
          if (!group.imageMediaId && !question?.imageMediaId) {
            errors.push("TOEIC Part 1 requires a photograph.");
          }
          if (question) {
            this.validateOptions(
              question,
              ["A", "B", "C", "D"],
              "TOEIC Part 1 requires exactly 4 statements (A, B, C, D).",
              errors,
            );
          }
        }
      }
      if (exercise.toeicPart === ToeicPart.PART_2) {
        for (const group of exercise.groups) {
          if (group.questions.length !== 1) {
            errors.push(
              "TOEIC Part 2 requires exactly 1 question-response item per group.",
            );
          }
          const question = group.questions[0];
          if (!question) continue;
          if (!question.questionText.trim())
            errors.push(
              "TOEIC Part 2 requires a spoken question or statement.",
            );
          this.validateOptions(
            question,
            ["A", "B", "C"],
            "TOEIC Part 2 requires exactly 3 responses (A, B, C).",
            errors,
          );
        }
      }
      if (exercise.toeicPart === ToeicPart.PART_3)
        this.validateGroupedPart(exercise, ToeicPart.PART_3, errors);
      if (exercise.toeicPart === ToeicPart.PART_4)
        this.validateGroupedPart(exercise, ToeicPart.PART_4, errors);
      if (!exercise.toeicPart) errors.push("TOEIC part is required.");
    }
    return [...new Set(errors)];
  }

  private groupAudioError(part: ToeicPart | null): string {
    if (part === ToeicPart.PART_1)
      return "Every TOEIC photograph item requires playable audio before publishing.";
    if (part === ToeicPart.PART_2)
      return "Every TOEIC question-response item requires playable audio before publishing.";
    if (part === ToeicPart.PART_3)
      return "Every TOEIC conversation requires playable audio before publishing.";
    if (part === ToeicPart.PART_4)
      return "Every TOEIC talk requires playable audio before publishing.";
    return "Every TOEIC group requires playable audio before publishing.";
  }

  private validateOptions(
    question: PublishQuestion,
    labels: string[],
    countMessage: string,
    errors: string[],
  ): void {
    const actualLabels = question.options.map((option) => option.label);
    if (
      actualLabels.length !== labels.length ||
      labels.some((label, index) => actualLabels[index] !== label)
    ) {
      errors.push(countMessage);
    }
    if (question.options.some((option) => !option.content.trim()))
      errors.push("Every TOEIC answer option must contain authoring text.");
    if (question.options.filter((option) => option.isCorrect).length !== 1)
      errors.push("Every TOEIC question requires exactly one correct answer.");
  }

  private validateGroupedPart(
    exercise: PublishCandidate,
    part: ToeicPart,
    errors: string[],
  ): void {
    const partNumber = part === ToeicPart.PART_3 ? 3 : 4;
    const groupName = part === ToeicPart.PART_3 ? "conversation" : "talk";
    if (!exercise.groups.length)
      errors.push(
        `TOEIC Part ${partNumber} requires at least one ${groupName}.`,
      );
    for (const group of exercise.groups) {
      if (group.questions.length !== 3) {
        errors.push(
          `TOEIC Part ${partNumber} requires exactly 3 questions per ${groupName}.`,
        );
      }
      for (const question of group.questions) {
        if (!question.questionText.trim())
          errors.push(`TOEIC Part ${partNumber} question text is required.`);
        this.validateOptions(
          question,
          ["A", "B", "C", "D"],
          `TOEIC Part ${partNumber} requires exactly 4 options (A, B, C, D) per question.`,
          errors,
        );
      }
      const speakerSegments = exercise.audioSegments.filter(
        (segment) =>
          segment.groupId === group.id &&
          segment.segmentType === AudioSegmentType.SPEAKER,
      );
      if (speakerSegments.length) {
        const speakers = new Set(
          speakerSegments
            .map((segment) => segment.speakerKey?.trim())
            .filter((key): key is string => Boolean(key)),
        );
        if (part === ToeicPart.PART_3 && speakers.size < 2)
          errors.push(
            "TOEIC Part 3 structured conversations require at least 2 distinct speakers.",
          );
        if (part === ToeicPart.PART_4 && speakers.size !== 1)
          errors.push(
            "TOEIC Part 4 structured talks require exactly 1 main speaker.",
          );
      }
    }
  }
}
