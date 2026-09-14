import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ForgotPasswordPage from "./page";

const forgot = vi.fn().mockResolvedValue({ message: "generic" });
vi.mock("@/lib/api/client", () => ({
  adminPasswordRecoveryApi: {
    forgot: (...args: unknown[]) => forgot(...args),
  },
}));

describe("admin forgot password page", () => {
  it("submits the email and displays only the generic response", async () => {
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "unknown@admin.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(
      await screen.findByText(
        "If the account exists, password reset instructions have been created.",
      ),
    ).toBeInTheDocument();
    expect(forgot).toHaveBeenCalledWith("unknown@admin.test");
  });
});
