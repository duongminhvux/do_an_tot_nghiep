import { AuthLayout } from "@/features/auth/auth-layout";
import { ResetPasswordForm } from "@/features/auth/password-recovery-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Use at least 10 characters."
    >
      <ResetPasswordForm token={token} />
    </AuthLayout>
  );
}
