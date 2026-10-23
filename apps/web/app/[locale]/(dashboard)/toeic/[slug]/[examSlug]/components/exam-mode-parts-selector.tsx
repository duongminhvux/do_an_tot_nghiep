'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { PlayCircle, Info, PauseCircle } from 'lucide-react';
import { ToeicExamPart } from '@/services/toeic.service';
import { Button } from '@/components/ui/button';
import { surface } from '@/components/ui/page';
import { cn } from '@/lib/utils';

type Mode = 'TEST' | 'PRACTICE';

/* ── Checkbox atom ─────────────────────────────────────────────────────────── */
function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return <input type="checkbox" checked={checked} onChange={onChange}
    className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-blue-600" />;
}

/* ── Radio atom ────────────────────────────────────────────────────────────── */
function Radio({ checked }: { checked: boolean }) {
  return (
    <div
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition
        ${checked ? 'border-blue-600' : 'border-slate-300'}`}
    >
      {checked && <div className="h-2.5 w-2.5 rounded-full bg-blue-600" />}
    </div>
  );
}

interface ExamModePartsSelectorProps {
  starting?: boolean;
  mode: Mode;
  setMode: (mode: Mode) => void;
  selected: Set<string>;
  togglePart: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  listeningParts: ToeicExamPart[];
  readingParts: ToeicExamPart[];
  selectedCount: number;
  selectedQuestions: number;
  selectedMinutes: number;
  isInProgress: boolean;
  onStart: () => void;
  onContinue: () => void;
}

export function ExamModePartsSelector({
  starting = false,
  mode,
  setMode,
  selected,
  togglePart,
  selectAll,
  deselectAll,
  listeningParts,
  readingParts,
  selectedCount,
  selectedQuestions,
  selectedMinutes,
  isInProgress,
  onStart,
  onContinue,
}: ExamModePartsSelectorProps) {
  const { t } = useTranslation('toeic');

  return (
    <div className="space-y-5">
      {/* — Chế độ làm bài — */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-slate-900">{t('exam_detail.mode_title')}</h2>
        <div className="grid grid-cols-2 gap-3">
          {/* Luyện thi */}
          <button
            type="button"
            onClick={() => setMode('TEST')}
            aria-pressed={mode === 'TEST'}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition cursor-pointer
              ${mode === 'TEST'
                ? 'border-blue-500 bg-blue-50/40 shadow-sm ring-1 ring-blue-500'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
          >
            <Radio checked={mode === 'TEST'} />
            <div className="min-w-0">
              <p className={`text-sm font-semibold leading-tight ${mode === 'TEST' ? 'text-blue-700' : 'text-slate-800'}`}>
                {t('exam_detail.mode_exam_label')}
              </p>
              <p className="mt-1 text-xs leading-snug text-slate-500">
                {t('exam_detail.mode_exam_desc')}
              </p>
            </div>
          </button>

          {/* Luyện tập */}
          <button
            type="button"
            onClick={() => setMode('PRACTICE')}
            aria-pressed={mode === 'PRACTICE'}
            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition cursor-pointer
              ${mode === 'PRACTICE'
                ? 'border-blue-500 bg-blue-50/40 shadow-sm ring-1 ring-blue-500'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
          >
            <Radio checked={mode === 'PRACTICE'} />
            <div className="min-w-0">
              <p className={`text-sm font-semibold leading-tight ${mode === 'PRACTICE' ? 'text-blue-700' : 'text-slate-800'}`}>
                {t('exam_detail.mode_practice_label')}
              </p>
              <p className="mt-1 text-xs leading-snug text-slate-500">
                {t('exam_detail.mode_practice_desc')}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* — Chọn phần muốn làm — */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">{t('exam_detail.parts_title')}</h2>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={selectAll} className="text-blue-600 hover:text-blue-700">
              {t('exam_detail.select_all')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={deselectAll}>
              {t('exam_detail.deselect')}
            </Button>
          </div>
        </div>

        <div className={cn(surface, 'overflow-hidden')}>
          <div className="space-y-4 p-5">
            {/* LISTENING section */}
            {listeningParts.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-600">
                  LISTENING
                </p>
                <div className="space-y-2">
                  {listeningParts.map((p) => {
                    const checked = selected.has(p._id);
                    return (
                      <label key={p._id} className="flex cursor-pointer items-center gap-2.5">
                        <Checkbox checked={checked} onChange={() => togglePart(p._id)} />
                        <span className="text-sm text-slate-700">
                          P{p.part} — {p.type}{' '}
                          <span className="font-semibold text-blue-600">({p.totalQuestions})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* READING section */}
            {readingParts.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-600">
                  READING
                </p>
                <div className="space-y-2">
                  {readingParts.map((p) => {
                    const checked = selected.has(p._id);
                    return (
                      <label key={p._id} className="flex cursor-pointer items-center gap-2.5">
                        <Checkbox checked={checked} onChange={() => togglePart(p._id)} />
                        <span className="text-sm text-slate-700">
                          P{p.part} — {p.type}{' '}
                          <span className="font-semibold text-blue-600">({p.totalQuestions})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Summary */}
            {selectedCount > 0 && (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-3.5 py-2.5 text-xs font-semibold text-blue-700">
                {t('exam_detail.summary', {
                  parts: selectedCount,
                  questions: selectedQuestions,
                  minutes: selectedMinutes,
                })}
              </div>
            )}

            {/* Hints */}
            <div className="space-y-1.5 text-xs text-slate-500">
              <p className="flex items-start gap-2">
                <Info className="h-3.5 w-3.5 mt-px shrink-0" />
                {t('attempt.mode_hint')}
              </p>
              <p className="flex items-start gap-2">
                <PauseCircle className="h-3.5 w-3.5 mt-px shrink-0" />
                {t('attempt.resume_hint')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* — CTA — */}
      <div className="space-y-2">
        {isInProgress && (
          <Button id="btn-continue-exam" type="button" variant="secondary" size="lg" onClick={onContinue} className="w-full">
            <PlayCircle />
            {t('exam_detail.btn_continue_attempt')}
          </Button>
        )}
        <Button
          id="btn-start-exam"
          type="button"
          size="lg"
          disabled={selectedCount === 0 || starting}
          onClick={onStart}
          className="h-12 w-full"
        >
          <PlayCircle />
          {t(starting ? 'attempt.starting' : 'exam_detail.btn_start')}
        </Button>
      </div>
    </div>
  );
}
