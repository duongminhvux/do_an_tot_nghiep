'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Keyboard,
  ListChecks,
  Loader2,
  Lock,
  RotateCcw,
  ScrollText,
  Settings2,
  SpellCheck,
} from 'lucide-react';
import {
  DEFAULT_DICTATION_SETTINGS,
  DICTATION_SHORTCUT_ACTIONS,
  DICTATION_SPEED_OPTIONS,
  comboFromEvent,
  comboLabel,
  normalizeDictationSettings,
  shortcutConflicts,
  shortcutProblem,
  type DictationSettings,
  type DictationShortcutAction,
} from '@repo/shared-types/dictation-settings';
import { dictationService } from '@/services/dictation.service';
import { useAppSelector } from '@/redux/hooks';
import { hasPermissions } from '@/lib/admin-permissions';
import { cn } from '@/lib/utils';

type Say = (vi: string, en: string) => string;

const SECTIONS = [
  { id: 'practice', icon: ListChecks, vi: 'Luyện tập', en: 'Practice' },
  { id: 'checking', icon: SpellCheck, vi: 'Chấm đáp án', en: 'Answer checking' },
  { id: 'playback', icon: Gauge, vi: 'Tốc độ phát', en: 'Playback' },
  { id: 'transcript', icon: ScrollText, vi: 'Bản chép lời', en: 'Transcript' },
  { id: 'shortcuts', icon: Keyboard, vi: 'Phím tắt', en: 'Shortcuts' },
] as const;

const ACTION_TEXT: Record<DictationShortcutAction, [string, string, string, string]> = {
  replay: ['Nghe lại câu', 'Phát lại câu đang làm, dùng được khi đang gõ.', 'Replay sentence', 'Plays the current sentence again, even while typing.'],
  prevSentence: ['Câu trước', 'Chuyển về câu trước.', 'Previous sentence', 'Go to the previous sentence.'],
  nextSentence: ['Câu tiếp', 'Chuyển sang câu tiếp theo.', 'Next sentence', 'Go to the next sentence.'],
  reveal: ['Hiện đáp án', 'Cần bật "Cho phép hiện đáp án".', 'Show answer', 'Requires "Allow showing the answer".'],
  slower: ['Giảm tốc độ', 'Chuyển xuống mức tốc độ thấp hơn.', 'Slower', 'Step down to the next slower speed.'],
  faster: ['Tăng tốc độ', 'Chuyển lên mức tốc độ cao hơn.', 'Faster', 'Step up to the next faster speed.'],
};

const PROBLEM_TEXT = {
  invalid: ['Phím không hỗ trợ.', 'Unsupported key.'],
  reserved: ['Phím này trình duyệt hoặc ô nhập đang dùng.', 'This key is used by the browser or the answer box.'],
  needs_modifier: ['Cần kèm Ctrl hoặc Alt (trừ Tab, F2, F4, F8–F10) vì học viên đang gõ.', 'Add Ctrl or Alt (except Tab, F2, F4, F8–F10) — learners are typing.'],
} as const;

function Kbd({ combo }: { combo: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {comboLabel(combo)
        .split(' + ')
        .map((part, index) => (
          <kbd
            key={`${part}-${index}`}
            className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-slate-200 bg-white px-1.5 font-sans text-xs font-semibold text-slate-700 shadow-[0_1px_0_rgb(226_232_240)]"
          >
            {part}
          </kbd>
        ))}
    </span>
  );
}

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none',
        checked ? 'bg-blue-600' : 'bg-slate-300',
      )}
    >
      <span className={cn('inline-block size-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none', checked ? 'translate-x-5' : 'translate-x-0.5')} />
    </button>
  );
}

function NumberField({ value, onChange, min, max, step = 1, suffix, disabled, label }: {
  value: number; onChange: (value: number) => void; min: number; max: number; step?: number; suffix: string; disabled?: boolean; label: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className={cn('inline-flex h-9 items-center overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100', disabled && 'opacity-50')}>
      <span className="sr-only">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          const number = Number(text);
          const next = Number.isFinite(number) && text.trim() ? Math.min(max, Math.max(min, Math.round(number))) : value;
          setText(String(next));
          if (next !== value) onChange(next);
        }}
        className="h-full w-20 bg-transparent px-2.5 text-right text-sm tabular-nums text-slate-900 outline-none disabled:cursor-not-allowed"
      />
      <span className="border-l border-slate-200 bg-slate-50 px-2.5 text-xs font-medium leading-9 text-slate-500">{suffix}</span>
    </label>
  );
}

function Section({ id, icon: Icon, title, description, children }: { id: string; icon: typeof Settings2; title: string; description: string; children: ReactNode }) {
  return (
    <section id={`dictation-settings-${id}`} aria-labelledby={`dictation-settings-${id}-title`} className="scroll-mt-24 rounded-xl border border-slate-200 bg-white shadow-xs">
      <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <div>
          <h2 id={`dictation-settings-${id}-title`} className="text-base font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        </div>
      </header>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  );
}

function Row({ title, description, children, muted }: { title: string; description?: ReactNode; children: ReactNode; muted?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between', muted && 'opacity-60')}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        {description && <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

function ShortcutRecorder({ value, onChange, disabled, say }: { value: string; onChange: (combo: string) => void; disabled?: boolean; say: Say }) {
  const [recording, setRecording] = useState(false);
  const button = useRef<HTMLButtonElement | null>(null);
  // While recording, listen on the window (capture) so the combo is caught even if focus moved,
  // and so it never reaches page/browser handlers. Esc or a click elsewhere cancels.
  useEffect(() => {
    if (!recording) return;
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        setRecording(false);
        return;
      }
      const combo = comboFromEvent(event);
      if (!combo) return; // only a modifier so far
      onChange(combo);
      setRecording(false);
    };
    const onPointer = (event: PointerEvent) => {
      if (!button.current?.contains(event.target as Node)) setRecording(false);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onPointer, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onPointer, true);
    };
  }, [recording, onChange]);
  return (
    <button
      ref={button}
      type="button"
      disabled={disabled}
      aria-pressed={recording}
      aria-label={recording ? say('Nhấn tổ hợp phím mới, Esc để huỷ', 'Press the new key combination, Esc to cancel') : say(`Đổi phím, hiện tại ${comboLabel(value)}`, `Change key, currently ${comboLabel(value)}`)}
      onClick={() => {
        button.current?.focus();
        setRecording((current) => !current);
      }}
      className={cn(
        'inline-flex h-9 min-w-36 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
        recording ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100' : 'border-slate-300 bg-white hover:border-slate-400',
      )}
    >
      {recording ? <span className="animate-pulse text-xs font-medium motion-reduce:animate-none">{say('Nhấn phím… (Esc để huỷ)', 'Press keys… (Esc to cancel)')}</span> : <Kbd combo={value} />}
    </button>
  );
}

export default function DictationSettingsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || 'vi';
  const en = locale === 'en';
  const say: Say = (vi, english) => (en ? english : vi);
  const queryClient = useQueryClient();
  const user = useAppSelector((state) => state.auth.user);
  const canEdit = hasPermissions(user, 'dictation.update');

  const query = useQuery({ queryKey: ['admin-dictation-settings'], queryFn: dictationService.getSettings });
  const [draft, setDraft] = useState<DictationSettings | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string; conflict?: boolean } | null>(null);

  useEffect(() => {
    if (query.data) setDraft(normalizeDictationSettings(query.data.config));
  }, [query.data]);

  const saved = useMemo(() => (query.data ? normalizeDictationSettings(query.data.config) : null), [query.data]);
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);

  const conflicts = draft ? shortcutConflicts(draft.shortcuts) : [];
  const conflicted = new Set(conflicts.flat());
  const badShortcut = draft ? DICTATION_SHORTCUT_ACTIONS.some((action) => shortcutProblem(draft.shortcuts[action].key)) : false;

  const mutation = useMutation({
    mutationFn: (config: DictationSettings) => dictationService.saveSettings(query.data?.revision ?? 0, config),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin-dictation-settings'], data);
      setNotice({ tone: 'success', text: say('Đã lưu. Học viên sẽ thấy cấu hình mới khi mở bài.', 'Saved. Learners get the new settings when they open a lesson.') });
    },
    onError: (error) => {
      const message = isAxiosError(error) ? String(error.response?.data?.message ?? '') : '';
      if (message.includes('DICTATION_SETTINGS_CHANGED'))
        setNotice({ tone: 'error', conflict: true, text: say('Cấu hình vừa được người khác thay đổi. Tải lại để xem bản mới trước khi lưu.', 'Someone else changed these settings. Reload to see the latest version before saving.') });
      else if (message.includes('DICTATION_SHORTCUT_CONFLICT'))
        setNotice({ tone: 'error', text: say('Có hai phím tắt trùng nhau.', 'Two shortcuts use the same key.') });
      else setNotice({ tone: 'error', text: say('Chưa lưu được. Vui lòng thử lại.', 'Could not save. Please try again.') });
    },
  });

  useEffect(() => {
    if (notice?.tone !== 'success') return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const update = <K extends keyof DictationSettings>(key: K, patch: Partial<DictationSettings[K]>) =>
    setDraft((current) => (current ? { ...current, [key]: { ...current[key], ...patch } } : current));
  const updateShortcut = (action: DictationShortcutAction, patch: Partial<DictationSettings['shortcuts'][DictationShortcutAction]>) =>
    setDraft((current) => (current ? { ...current, shortcuts: { ...current.shortcuts, [action]: { ...current.shortcuts[action], ...patch } } } : current));

  if (query.isPending || (!draft && !query.isError)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-slate-500" role="status">
        <Loader2 className="size-4 animate-spin" /> {say('Đang tải cấu hình…', 'Loading settings…')}
      </div>
    );
  }
  if (query.isError || !draft) {
    return (
      <div className="p-4 sm:p-6">
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-semibold">{say('Không tải được cấu hình Dictation.', 'Could not load Dictation settings.')}</p>
          <button type="button" onClick={() => void query.refetch()} className="mt-2 font-semibold underline">{say('Thử lại', 'Retry')}</button>
        </div>
      </div>
    );
  }

  const p = draft.practice;
  const locked = !canEdit || mutation.isPending;
  const updatedAt = query.data?.updatedAt
    ? new Date(query.data.updatedAt).toLocaleString(en ? 'en-US' : 'vi-VN', { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  return (
    <div className="w-full p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-blue-600">
            <Settings2 className="size-4" aria-hidden="true" />
            <span className="text-xs font-bold uppercase tracking-[0.14em]">Dictation</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{say('Cấu hình Dictation', 'Dictation settings')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {say('Áp dụng cho mọi bài luyện nghe. Học viên nhận cấu hình mới ở lần mở bài tiếp theo.', 'Applies to every listening lesson. Learners get changes the next time they open a lesson.')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span>{updatedAt ? say(`Cập nhật lần cuối: ${updatedAt}`, `Last updated: ${updatedAt}`) : say('Đang dùng cấu hình mặc định', 'Using default settings')}</span>
          <button
            type="button"
            disabled={locked}
            onClick={() => setDraft(normalizeDictationSettings(DEFAULT_DICTATION_SETTINGS))}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="size-4" aria-hidden="true" /> {say('Về mặc định', 'Reset to defaults')}
          </button>
        </div>
      </div>

      {!canEdit && (
        <p className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          {say('Bạn chỉ có quyền xem. Cần quyền "dictation.update" để thay đổi.', 'View only. The "dictation.update" permission is required to make changes.')}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label={say('Các mục cấu hình', 'Settings sections')} className="hidden lg:block">
          <ul className="sticky top-20 space-y-1">
            {SECTIONS.map(({ id, icon: Icon, vi, en: english }) => (
              <li key={id}>
                <a href={`#dictation-settings-${id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900">
                  <Icon className="size-4" aria-hidden="true" /> {say(vi, english)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <fieldset disabled={locked} className="min-w-0 space-y-6">
          <legend className="sr-only">{say('Cấu hình Dictation', 'Dictation settings')}</legend>

          <Section id="practice" icon={ListChecks} title={say('Luyện tập', 'Practice')} description={say('Cách học viên làm từng câu và chuyển câu.', 'How learners work through each sentence.')}>
            <Row title={say('Tự hiện đáp án khi sai nhiều lần', 'Show the answer after repeated mistakes')} description={say('Sau số lần sai này, câu được đánh dấu "đã xem đáp án".', 'After this many wrong tries the sentence is marked as revealed.')}>
              <NumberField label={say('Số lần sai', 'Wrong tries')} value={p.maxAttemptsBeforeReveal} min={1} max={20} suffix={say('lần sai', 'tries')} disabled={!p.autoRevealEnabled} onChange={(value) => update('practice', { maxAttemptsBeforeReveal: value })} />
              <Toggle label={say('Tự hiện đáp án', 'Auto reveal')} checked={p.autoRevealEnabled} onChange={(value) => update('practice', { autoRevealEnabled: value })} />
            </Row>
            <Row title={say('Cho phép hiện đáp án', 'Allow showing the answer')} description={say('Học viên tự mở đáp án câu đang làm (bằng phím tắt).', 'Learners can open the answer of the current sentence (via shortcut).')}>
              <Toggle label={say('Cho phép hiện đáp án', 'Allow showing the answer')} checked={p.allowReveal} onChange={(value) => update('practice', { allowReveal: value })} />
            </Row>
            <Row title={say('Cho phép gợi ý từng từ', 'Allow per-word hints')} description={say('Nút "Hiện từ" trong ô trả lời. Câu dùng gợi ý không tính là đúng ngay lần đầu.', 'The "Reveal" button in the answer box. Hinted sentences don\'t count as first-try correct.')}>
              <Toggle label={say('Cho phép gợi ý', 'Allow hints')} checked={p.allowHint} onChange={(value) => update('practice', { allowHint: value })} />
            </Row>
            <Row title={say('Tự chuyển câu khi làm đúng', 'Move on after a correct answer')} description={say(`Chờ ${(p.autoNextDelayMs / 1000).toLocaleString(en ? 'en-US' : 'vi-VN')} giây rồi sang câu tiếp.`, `Waits ${(p.autoNextDelayMs / 1000).toLocaleString('en-US')} s, then opens the next sentence.`)}>
              <NumberField label={say('Thời gian chờ', 'Delay')} value={p.autoNextDelayMs} min={0} max={10000} step={100} suffix="ms" disabled={!p.autoNextEnabled} onChange={(value) => update('practice', { autoNextDelayMs: value })} />
              <Toggle label={say('Tự chuyển câu', 'Auto next')} checked={p.autoNextEnabled} onChange={(value) => update('practice', { autoNextEnabled: value })} />
            </Row>
            <Row muted={!p.autoNextEnabled} title={say('Mặc định tự phát câu tiếp', 'Auto-play the next sentence by default')} description={say('Giá trị ban đầu của ô "Tự phát câu tiếp"; học viên vẫn tự tắt được.', 'Initial value of the "Auto-play next" checkbox; learners can still turn it off.')}>
              <Toggle label={say('Tự phát câu tiếp', 'Auto-play next')} checked={p.autoPlayNext} disabled={!p.autoNextEnabled} onChange={(value) => update('practice', { autoPlayNext: value })} />
            </Row>
          </Section>

          <Section id="checking" icon={SpellCheck} title={say('Chấm đáp án', 'Answer checking')} description={say('Server so từng từ với câu gốc rồi cho điểm 0–100.', 'The server compares each word with the original sentence and scores 0–100.')}>
            <Row title={say('Phân biệt chữ hoa, chữ thường', 'Case sensitive')} description={say('Tắt: "Hello" và "hello" được tính giống nhau.', 'Off: "Hello" and "hello" count as the same.')}>
              <Toggle label={say('Phân biệt hoa thường', 'Case sensitive')} checked={draft.checking.caseSensitive} onChange={(value) => update('checking', { caseSensitive: value })} />
            </Row>
            <Row title={say('Tính cả dấu câu', 'Punctuation counts')} description={say('Tắt: bỏ qua dấu chấm, phẩy, nháy… khi so sánh.', 'Off: periods, commas, quotes… are ignored.')}>
              <Toggle label={say('Tính dấu câu', 'Punctuation counts')} checked={draft.checking.punctuationSensitive} onChange={(value) => update('checking', { punctuationSensitive: value })} />
            </Row>
            <Row
              title={say('Điểm tối thiểu để tính là đúng', 'Score needed to pass')}
              description={draft.checking.passScore === 100
                ? say('100: phải đúng tất cả các từ.', '100: every word must be right.')
                : say(`Câu đạt từ ${draft.checking.passScore}/100 điểm được tính là đúng (cho phép sai vài từ).`, `${draft.checking.passScore}/100 or more counts as correct (a few wrong words allowed).`)}
            >
              <label className="flex items-center gap-3">
                <span className="sr-only">{say('Điểm tối thiểu', 'Pass score')}</span>
                <input
                  type="range"
                  min={50}
                  max={100}
                  step={5}
                  value={draft.checking.passScore}
                  onChange={(event) => update('checking', { passScore: Number(event.target.value) })}
                  className="w-40 accent-blue-600"
                />
                <span className="w-12 text-right text-sm font-semibold tabular-nums text-slate-900">{draft.checking.passScore}</span>
              </label>
            </Row>
          </Section>

          <Section id="playback" icon={Gauge} title={say('Tốc độ phát', 'Playback')} description={say('Các mức tốc độ học viên được chọn.', 'The speeds learners can pick from.')}>
            <Row title={say('Tốc độ cho phép', 'Available speeds')} description={say('1× luôn có sẵn.', '1× is always available.')}>
              <div className="flex max-w-md flex-wrap gap-1.5" role="group" aria-label={say('Tốc độ cho phép', 'Available speeds')}>
                {DICTATION_SPEED_OPTIONS.map((speed) => {
                  const on = draft.playback.speeds.includes(speed);
                  return (
                    <button
                      key={speed}
                      type="button"
                      aria-pressed={on}
                      disabled={speed === 1}
                      onClick={() => {
                        const speeds = on ? draft.playback.speeds.filter((item) => item !== speed) : [...draft.playback.speeds, speed].sort((a, b) => a - b);
                        update('playback', { speeds, defaultSpeed: speeds.includes(draft.playback.defaultSpeed) ? draft.playback.defaultSpeed : 1 });
                      }}
                      className={cn(
                        'h-8 min-w-12 rounded-lg border px-2 text-xs font-semibold tabular-nums transition-colors disabled:cursor-default',
                        on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400',
                      )}
                    >
                      {speed}×
                    </button>
                  );
                })}
              </div>
            </Row>
            <Row title={say('Tốc độ mặc định', 'Default speed')} description={say('Tốc độ khi học viên mở bài.', 'Speed when a lesson opens.')}>
              <select
                value={draft.playback.defaultSpeed}
                onChange={(event) => update('playback', { defaultSpeed: Number(event.target.value) })}
                aria-label={say('Tốc độ mặc định', 'Default speed')}
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                {draft.playback.speeds.map((speed) => <option key={speed} value={speed}>{speed}×</option>)}
              </select>
            </Row>
          </Section>

          <Section id="transcript" icon={ScrollText} title={say('Bản chép lời', 'Transcript')} description={say('Toàn bộ nội dung bài nghe.', 'The full text of the lesson.')}>
            <Row title={say('Cho phép xem bản chép lời', 'Allow the transcript')} description={say('Tắt: ẩn nút "Xem transcript" và chặn ở server.', 'Off: hides "View transcript" and blocks it on the server.')}>
              <Toggle label={say('Cho phép bản chép lời', 'Allow transcript')} checked={draft.transcript.enabled} onChange={(value) => update('transcript', { enabled: value })} />
            </Row>
            <Row muted={!draft.transcript.enabled} title={say('Hỏi lại trước khi mở', 'Confirm before opening')} description={say('Nhắc học viên rằng việc mở bản chép lời được ghi vào tiến độ.', 'Reminds learners that opening it is recorded in their progress.')}>
              <Toggle label={say('Hỏi lại trước khi mở', 'Confirm before opening')} checked={draft.transcript.requireConfirm} disabled={!draft.transcript.enabled} onChange={(value) => update('transcript', { requireConfirm: value })} />
            </Row>
          </Section>

          <Section id="shortcuts" icon={Keyboard} title={say('Phím tắt', 'Keyboard shortcuts')} description={say('Bấm vào ô phím rồi nhấn tổ hợp mới. Chỉ bật những phím thật sự cần để học viên dễ nhớ.', 'Click a key box and press the new combination. Keep only the ones learners need.')}>
            <Row title={say('Hiện bảng phím tắt cho học viên', 'Show the shortcut card to learners')} description={say('Bảng phím tắt ở cột bên phải trang luyện nghe.', 'The shortcut card in the right column of the practice page.')}>
              <Toggle label={say('Hiện bảng phím tắt', 'Show shortcut card')} checked={draft.display.showShortcutCard} onChange={(value) => update('display', { showShortcutCard: value })} />
            </Row>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <caption className="sr-only">{say('Danh sách phím tắt', 'Shortcut list')}</caption>
                <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-2.5">{say('Thao tác', 'Action')}</th>
                    <th scope="col" className="px-3 py-2.5">{say('Phím', 'Key')}</th>
                    <th scope="col" className="w-20 px-5 py-2.5 text-right">{say('Bật', 'On')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {([
                    ['Enter', say('Kiểm tra đáp án', 'Check answer')],
                    ['Shift+Enter', say('Sang câu tiếp sau khi làm xong', 'Move on when done')],
                  ] as const).map(([combo, label]) => (
                    <tr key={combo} className="text-slate-500">
                      <td className="px-5 py-3">
                        <p className="font-medium text-slate-700">{label}</p>
                        <p className="text-xs">{say('Cố định trong ô trả lời', 'Fixed in the answer box')}</p>
                      </td>
                      <td className="px-3 py-3"><span className="inline-flex h-9 min-w-36 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3"><Kbd combo={combo} /></span></td>
                      <td className="px-5 py-3 text-right"><Lock className="ml-auto size-4 text-slate-400" aria-label={say('Cố định', 'Fixed')} /></td>
                    </tr>
                  ))}
                  {DICTATION_SHORTCUT_ACTIONS.map((action) => {
                    const shortcut = draft.shortcuts[action];
                    const [viTitle, viHelp, enTitle, enHelp] = ACTION_TEXT[action];
                    const problem = shortcutProblem(shortcut.key);
                    const unavailable = action === 'reveal' && !p.allowReveal;
                    const clash = shortcut.enabled && conflicted.has(action);
                    return (
                      <tr key={action} className={cn(!shortcut.enabled && 'bg-slate-50/50')}>
                        <td className="px-5 py-3 align-top">
                          <p className={cn('font-medium', shortcut.enabled ? 'text-slate-900' : 'text-slate-500')}>{say(viTitle, enTitle)}</p>
                          <p className="text-xs text-slate-500">{say(viHelp, enHelp)}</p>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <ShortcutRecorder say={say} value={shortcut.key} disabled={locked} onChange={(combo) => updateShortcut(action, { key: combo })} />
                          {(problem || clash || unavailable) && (
                            <p role="alert" className={cn('mt-1.5 max-w-60 text-xs', unavailable && !problem && !clash ? 'text-amber-700' : 'text-red-600')}>
                              {problem
                                ? say(PROBLEM_TEXT[problem][0], PROBLEM_TEXT[problem][1])
                                : clash
                                  ? say('Trùng với phím của thao tác khác.', 'Same key as another action.')
                                  : say('Đang tắt vì không cho phép hiện đáp án.', 'Inactive: showing the answer is not allowed.')}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right align-top">
                          <Toggle label={say(`Bật phím ${viTitle}`, `Enable ${enTitle}`)} checked={shortcut.enabled} onChange={(value) => updateShortcut(action, { enabled: value })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Section>
        </fieldset>
      </div>

      {(dirty || notice) && (
        <div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgb(15_23_42/0.06)] backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div aria-live="polite" className="min-w-0 text-sm">
              {notice ? (
                <span className={cn('inline-flex items-center gap-2', notice.tone === 'success' ? 'text-emerald-700' : 'text-red-700')}>
                  {notice.tone === 'success' ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertTriangle className="size-4 shrink-0" />}
                  {notice.text}
                  {notice.conflict && (
                    <button type="button" className="font-semibold underline" onClick={() => { setNotice(null); void query.refetch(); }}>
                      {say('Tải lại', 'Reload')}
                    </button>
                  )}
                </span>
              ) : (
                <span className="text-slate-600">{say('Có thay đổi chưa lưu.', 'You have unsaved changes.')}</span>
              )}
            </div>
            {dirty && canEdit && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => { setDraft(saved); setNotice(null); }}
                  className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {say('Huỷ thay đổi', 'Discard')}
                </button>
                <button
                  type="button"
                  disabled={mutation.isPending || conflicts.length > 0 || badShortcut}
                  onClick={() => { setNotice(null); mutation.mutate(draft); }}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                  {say('Lưu cấu hình', 'Save settings')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
