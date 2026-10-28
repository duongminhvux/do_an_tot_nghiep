import type { ToeicAttemptSummary } from '@/services/toeic.service';
export function groupAttemptProgress(attempt?: ToeicAttemptSummary) {
  const completed=attempt?.status==='FINISHED'||attempt?.status==='COMPLETED';
  const inProgress=attempt?.status==='IN_PROGRESS';
  const total=Math.max(0,attempt?.totalQuestions??0);
  const answered=Math.min(total,Math.max(0,attempt?.answeredQuestions??0));
  return {completed,inProgress,total,answered,percent:completed?100:inProgress&&total?answered/total*100:0};
}
