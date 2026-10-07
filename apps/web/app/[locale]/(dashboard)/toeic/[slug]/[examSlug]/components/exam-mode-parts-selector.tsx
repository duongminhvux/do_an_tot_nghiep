'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { PlayCircle, Info, PauseCircle, Check } from 'lucide-react';
import { ToeicExamPart } from '@/services/toeic.service';

type Mode = 'exam' | 'practice';

/* ── Checkbox atom ─────────────────────────────────────────────────────────── */
function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-sm border-2 transition cursor-pointer
        ${checked
          ? 'border-blue-600 bg-blue-600'
          : 'border-slate-300 bg-white hover:border-blue-400'
        }`}
    >
      {checked && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
    </button>
  );
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
        <h2 className="mb-3 text-base font-bold text-slate-900">{t('exam_detail.mode_title')}</h2>
        <div className="grid grid-cols-2 gap-3">
          {/* Luyện thi */}
          <button
            type="button"
            onClick={() => setMode('exam')}
            className={`flex items-start gap-3 rounded border p-4 text-left transition cursor-pointer
              ${mode === 'exam'
                ? 'border-blue-500 bg-white shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
          >
            <Radio checked={mode === 'exam'} />
            <div className="min-w-0">
              <p className={`text-sm font-bold leading-tight ${mode === 'exam' ? 'text-blue-700' : 'text-slate-800'}`}>
                {t('exam_detail.mode_exam_label')}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                {t('exam_detail.mode_exam_desc')}
              </p>
            </div>
          </button>

          {/* Luyện tập */}
          <button
            type="button"
            onClick={() => setMode('practice')}
            className={`flex items-start gap-3 rounded border p-4 text-left transition cursor-pointer
              ${mode === 'practice'
                ? 'border-blue-500 bg-white shadow-sm'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
          >
            <Radio checked={mode === 'practice'} />
            <div className="min-w-0">
              <p className={`text-sm font-bold leading-tight ${mode === 'practice' ? 'text-blue-700' : 'text-slate-800'}`}>
                {t('exam_detail.mode_practice_label')}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                {t('exam_detail.mode_practice_desc')}
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* — Chọn phần muốn làm — */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{t('exam_detail.parts_title')}</h2>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <button type="button" onClick={selectAll} className="text-blue-600 hover:underline cursor-pointer">
              {t('exam_detail.select_all')}
            </button>
            <span className="text-slate-300">|</span>
            <button type="button" onClick={deselectAll} className="text-slate-400 hover:underline cursor-pointer">
              {t('exam_detail.deselect')}
            </button>
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="p-4 space-y-4">
            {/* LISTENING section */}
            {listeningParts.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-600">
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
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600">
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
              <div className="rounded border border-blue-100 bg-blue-50 px-3.5 py-2.5 text-xs font-semibold text-blue-700">
                {t('exam_detail.summary', {
                  parts: selectedCount,
                  questions: selectedQuestions,
                  minutes: selectedMinutes,
                })}
              </div>
            )}

            {/* Hints */}
            <div className="space-y-1.5 text-xs text-slate-400">
              <p className="flex items-start gap-2">
                <Info className="h-3.5 w-3.5 mt-px shrink-0" />
                {t('exam_detail.hint_auto_submit')}
              </p>
              <p className="flex items-start gap-2">
                <PauseCircle className="h-3.5 w-3.5 mt-px shrink-0" />
                {t('exam_detail.hint_pause')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* — CTA — */}
      <div className="space-y-2">
        {isInProgress && (
          <button
            id="btn-continue-exam"
            type="button"
            onClick={onContinue}
            className="flex w-full items-center justify-center gap-2 rounded border border-blue-200 bg-blue-50 px-5 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
          >
            <PlayCircle className="h-4 w-4" />
            {t('exam_detail.btn_continue_attempt')}
          </button>
        )}
        <button
          id="btn-start-exam"
          type="button"
          disabled={selectedCount === 0}
          onClick={onStart}
          className="flex w-full items-center justify-center gap-2.5 rounded bg-blue-600 py-4 text-sm font-extrabold uppercase tracking-widest text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        >
          <PlayCircle className="h-5 w-5" />
          {t('exam_detail.btn_start')}
        </button>
      </div>
    </div>
  );
}
