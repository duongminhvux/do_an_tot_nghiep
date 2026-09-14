import { describe, expect, it } from "vitest";
import { toggleTeacherAssignment } from "./course-form";

describe("course teacher assignments", () => {
  it("tracks UUIDs independently when teachers have duplicate names", () => {
    const first = toggleTeacherAssignment([], "teacher-id-1", true);
    const both = toggleTeacherAssignment(first, "teacher-id-2", true);
    expect(both).toEqual(["teacher-id-1", "teacher-id-2"]);
    expect(toggleTeacherAssignment(both, "teacher-id-1", false)).toEqual([
      "teacher-id-2",
    ]);
  });
});
