import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilePage } from "./profile-page";

const getProfile = vi.fn();
const updateProfile = vi.fn();

vi.mock("@/lib/api/client", () => ({
  profileApi: {
    get: (...args: unknown[]) => getProfile(...args),
    update: (...args: unknown[]) => updateProfile(...args),
  },
}));

vi.mock("@/stores/session-store", () => ({
  useSessionStore: {
    getState: () => ({ token: null }),
  },
}));

describe("ProfilePage canonical target level", () => {
  beforeEach(() => {
    getProfile.mockReset();
    updateProfile.mockReset();
    getProfile.mockResolvedValue({
      id: "student-id",
      fullName: "Student",
      email: "student@test.local",
      role: "STUDENT",
      status: "ACTIVE",
      targetLevel: "INTERMEDIATE",
      learningGoal: "Improve",
    });
    updateProfile.mockImplementation(async (input) => ({
      id: "student-id",
      email: "student@test.local",
      role: "STUDENT",
      status: "ACTIVE",
      ...input,
    }));
  });

  it("loads, edits, and saves enum values while showing presentation labels", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ProfilePage />
      </QueryClientProvider>,
    );
    const select = await screen.findByLabelText("Target English level");
    expect(select).toHaveValue("INTERMEDIATE");
    expect(
      screen.getByRole("option", { name: "B1 — Intermediate" }),
    ).toHaveValue("INTERMEDIATE");

    fireEvent.change(select, { target: { value: "UPPER_INTERMEDIATE" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith(
        expect.objectContaining({ targetLevel: "UPPER_INTERMEDIATE" }),
      ),
    );
  });
});
