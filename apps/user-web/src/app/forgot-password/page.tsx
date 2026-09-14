import { AuthLayout } from "@/features/auth/auth-layout";
import { ForgotPasswordForm } from "@/features/auth/password-recovery-form";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email address for your student account."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
