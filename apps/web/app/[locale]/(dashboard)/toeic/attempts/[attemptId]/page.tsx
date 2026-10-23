import { ToeicAttemptShell } from '@/features/toeic/attempt/toeic-attempt-shell';

export default async function Page({ params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  return <ToeicAttemptShell key={attemptId} />;
}
