import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { useSessionStore } from "@/stores/session-store";
import { RegisterForm } from "./register-form";

const replace = vi.fn();
const registerUser = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/lib/api/client", () => ({
  authApi: { register: (...args: unknown[]) => registerUser(...args) },
}));

function fillValidForm(password = "StrongPass1!") {
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "New Student" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "new@student.test" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: password },
  });
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: /I agree to the Terms of Service/i,
    }),
  );
}

describe("RegisterForm", () => {
  beforeEach(() => {
    replace.mockReset();
    registerUser.mockReset();
    localStorage.clear();
    useSessionStore.setState({ token: null, user: null });
  });

  it("stores the real session and redirects after successful registration", async () => {
    registerUser.mockResolvedValue({
      accessToken: "real-access-token",
      user: {
        id: "student-id",
        email: "new@student.test",
        fullName: "New Student",
        role: "STUDENT",
        status: "ACTIVE",
        targetLevel: "INTERMEDIATE",
        learningGoal: "Improve everyday listening",
      },
    });
    render(<RegisterForm />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(registerUser).toHaveBeenCalledTimes(1));
    expect(registerUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "new@student.test",
        fullName: "New Student",
        password: "StrongPass1!",
        targetLevel: "INTERMEDIATE",
      }),
    );
    expect(useSessionStore.getState().token).toBe("real-access-token");
    expect(replace).toHaveBeenCalledWith("/app/dashboard");
    expect(localStorage.getItem("listenup-session")).toContain(
      "real-access-token",
    );
  });

  it("shows a duplicate-email response from the backend", async () => {
    registerUser.mockRejectedValue(
      new ApiError(
        "EMAIL_ALREADY_EXISTS",
        "An account with this email already exists.",
      ),
    );
    render(<RegisterForm />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "An account with this email already exists.",
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("rejects an invalid password before making a request", async () => {
    render(<RegisterForm />);
    fillValidForm("short");

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByText("Use at least 10 characters"),
    ).toBeInTheDocument();
    expect(registerUser).not.toHaveBeenCalled();
  });

  it("renders a backend validation message", async () => {
    registerUser.mockRejectedValue(
      new ApiError("VALIDATION_ERROR", "learningGoal must be a string"),
    );
    render(<RegisterForm />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "learningGoal must be a string",
    );
  });
});
