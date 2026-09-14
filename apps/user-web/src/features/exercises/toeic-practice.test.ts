import { describe, expect, it } from "vitest";
import type { ExerciseGroup } from "@/domain/entities";
import { buildQuestionEntries } from "./toeic-practice";

describe("buildQuestionEntries", () => {
  it("keeps each question associated with its owning group media", () => {
    const groups: ExerciseGroup[] = [
      {
        id: "group-1",
        listenCount: 2,
        audio: {
          id: "audio-1",
          url: "audio-1",
          duration: 10,
          mimeType: "audio/wav",
        },
        questions: [
          { id: "q1", options: [] },
          { id: "q2", options: [] },
          { id: "q3", options: [] },
        ],
      },
      {
        id: "group-2",
        listenCount: 1,
        audio: {
          id: "audio-2",
          url: "audio-2",
          duration: 20,
          mimeType: "audio/wav",
        },
        questions: [
          { id: "q4", options: [] },
          { id: "q5", options: [] },
          { id: "q6", options: [] },
        ],
      },
    ];

    const entries = buildQuestionEntries(groups);

    expect(
      entries.find((entry) => entry.question.id === "q1")?.group,
    ).toMatchObject({
      id: "group-1",
      audio: { id: "audio-1" },
      listenCount: 2,
    });
    expect(
      entries.find((entry) => entry.question.id === "q4")?.group,
    ).toMatchObject({
      id: "group-2",
      audio: { id: "audio-2" },
      listenCount: 1,
    });
  });
});
