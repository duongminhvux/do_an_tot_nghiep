import { ToeicAttemptResult } from "@/features/toeic/attempt/toeic-attempt-result";

export default async function Page({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  return <ToeicAttemptResult key={attemptId} />;
}
