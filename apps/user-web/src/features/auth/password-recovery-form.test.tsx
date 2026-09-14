import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ForgotPasswordForm,
  ResetPasswordForm,
} from "./password-recovery-form";

const forgot = vi.fn();
const reset = vi.fn();
const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));
vi.mock("@/lib/api/client", () => ({
  passwordRecoveryApi: {
    forgot: (...args: unknown[]) => forgot(...args),
    reset: (...args: unknown[]) => reset(...args),
  },
}));

describe("student password recovery forms", () => {
  beforeEach(() => {
    forgot.mockReset();
    reset.mockReset();
    replace.mockReset();
  });

  it("submits an email and always renders the generic success response", async () => {
    forgot.mockResolvedValue({ message: "generic" });
    render(<ForgotPasswordForm />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "unknown@test.local" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(
      await screen.findByText(
        "If the account exists, password reset instructions have been created.",
      ),
    ).toBeInTheDocument();
    expect(forgot).toHaveBeenCalledWith("unknown@test.local");
  });

  it("submits the token and validated new password then redirects to login", async () => {
    reset.mockResolvedValue(undefined);
    render(<ResetPasswordForm token="reset-token" />);
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewPassword1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "NewPassword1!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() =>
      expect(reset).toHaveBeenCalledWith("reset-token", "NewPassword1!"),
    );
    expect(replace).toHaveBeenCalledWith("/login?reset=success");
  });
});
