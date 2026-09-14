import { afterEach, describe, expect, it } from "vitest";
import { AttemptStatus, ExerciseType } from "@/domain/enums";
import { exercises } from "@/mocks/fixtures";
import { mockApi } from "./mock-service";

describe("mock API TOEIC listen limits", () => {
  afterEach(() => localStorage.clear());

  it("keeps listen counts independent for each group", async () => {
    const exercise = exercises.find(
      (item) => item.type === ExerciseType.TOEIC && item.maxListenCount === 2,
    )!;
    const firstGroup = exercise.groups![0];
    const secondGroup = { ...firstGroup, id: "mock-second-group" };
    exercise.groups!.push(secondGroup);
    localStorage.setItem(
      "listenup-attempts",
      JSON.stringify([
        {
          id: "mock-attempt",
          userId: "student-id",
          exerciseId: exercise.id,
          status: AttemptStatus.IN_PROGRESS,
          attemptNumber: 1,
          listenCount: 0,
          listenCountsByGroup: {},
          answers: [],
          startedAt: new Date().toISOString(),
        },
      ]),
    );

    try {
      await expect(
        mockApi.consumeListen(exercise.id, "mock-attempt", firstGroup.id),
      ).resolves.toBe(1);
      await expect(
        mockApi.consumeListen(exercise.id, "mock-attempt", firstGroup.id),
      ).resolves.toBe(2);
      await expect(
        mockApi.consumeListen(exercise.id, "mock-attempt", firstGroup.id),
      ).rejects.toMatchObject({ code: "LISTEN_LIMIT_REACHED" });
      await expect(
        mockApi.consumeListen(exercise.id, "mock-attempt", secondGroup.id),
      ).resolves.toBe(1);
    } finally {
      exercise.groups!.pop();
    }
  });
});
