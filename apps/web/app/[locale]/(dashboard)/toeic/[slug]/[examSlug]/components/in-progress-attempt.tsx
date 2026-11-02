'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Clock3, Loader2, PlayCircle, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ErrorState, surface } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import { toeicAttemptService } from '@/services/toeic-attempt.service';
import type { ToeicAttemptSummary } from '@/services/toeic.service';

function duration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds / 60) % 60;
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}

/**
 * Shown instead of the start form while the learner has an unfinished attempt
 * of this exam, in either mode: continue it, or stop it to start over.
 */
export function InProgressAttempt({
  attempt,
  examName,
  onContinue,
}: {
  attempt: ToeicAttemptSummary;
  examName: string;
  onContinue: () => void;
}) {
  const { t } = useTranslation('toeic');
  const queryClient = useQueryClient();
  const [confirmStop, setConfirmStop] = useState(false);
  const stop = useMutation({
    mutationFn: () => toeicAttemptService.abandon(attempt._id),
    onSuccess: () => {
      setConfirmStop(false);
      void queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('toeic-'),
      });
    },
  });
  const answered = attempt.answeredQuestions ?? 0;
  const total = attempt.totalQuestions ?? 0;
  const progress = total ? Math.round((answered / total) * 100) : 0;
  const modeLabel = t(attempt.mode === 'PRACTICE' ? 'exam_detail.mode_practice_label' : 'exam_detail.mode_exam_label');

  return (
    <section aria-labelledby="in-progress-title" className={cn(surface, 'space-y-5 p-5')}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">{modeLabel}</p>
        <h2 id="in-progress-title" className="mt-1 text-base font-semibold text-slate-900">
          {t('exam_detail.in_progress_title')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {attempt.selectedParts?.map((p) => `Part ${p}`).join(' + ')}
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">
            {t('exam_detail.in_progress_answered', { answered, total })}
          </span>
          {attempt.remainingSeconds !== undefined ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 tabular-nums">
              <Clock3 className="h-4 w-4 text-slate-400" aria-hidden />
              {t('exam_detail.in_progress_time_left', { time: duration(attempt.remainingSeconds) })}
            </span>
          ) : attempt.activeSeconds !== undefined ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 tabular-nums">
              <Clock3 className="h-4 w-4 text-slate-400" aria-hidden />
              {t('exam_detail.in_progress_time_spent', { time: duration(attempt.activeSeconds) })}
            </span>
          ) : null}
        </div>
        <div
          role="progressbar"
          aria-label={t('attempt.progress')}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={answered}
          className="h-1.5 overflow-hidden rounded-full bg-slate-100"
        >
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-xs text-slate-500">{t('exam_detail.in_progress_hint')}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => setConfirmStop(true)}
          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
        >
          <Square />
          {t('exam_detail.btn_stop_attempt')}
        </Button>
        <Button id="btn-continue-exam" type="button" size="lg" onClick={onContinue}>
          <PlayCircle />
          {t('exam_detail.btn_continue_attempt')}
        </Button>
      </div>

      <Dialog
        open={confirmStop}
        onOpenChange={(open) => {
          if (!stop.isPending) {
            setConfirmStop(open);
            stop.reset();
          }
        }}
      >
        <DialogContent showCloseButton={!stop.isPending} className="rounded-2xl border-slate-200">
          <DialogTitle>{t('history.stop_title')}</DialogTitle>
          <DialogDescription>
            {t('history.stop_desc', { name: examName, answered, total })}
          </DialogDescription>
          {stop.isError && <ErrorState message={t('history.stop_error')} />}
          <div className="flex justify-end gap-3">
            <Button variant="outline" disabled={stop.isPending} onClick={() => setConfirmStop(false)}>
              {t('history.stop_cancel')}
            </Button>
            <Button variant="destructive" disabled={stop.isPending} onClick={() => stop.mutate()}>
              {stop.isPending && <Loader2 className="animate-spin" />}
              {t('history.stop_confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
