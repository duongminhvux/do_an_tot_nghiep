"use client";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Clock3,
  History,
  RefreshCw,
  Search,
  Users,
  ChevronRight,
} from "lucide-react";
import { dictationService } from "@/services/dictation.service";
import type {
  DictationLearner,
  DictationPracticeSession,
  DictationHistoryEvent,
} from "@/types/dictation-history";
import type { DictationLesson } from "@/types/dictation";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { UserNameLink } from "@/components/users/user-name-link";

const unwrap = <T,>(data: unknown): T =>
  (data as { data: T })?.data ?? (data as T);
const control =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50";
export function DictationLearningHistory({
  lesson,
}: {
  lesson: DictationLesson;
}) {
  const { locale } = useParams();
  const en = locale === "en",
    t = (vi: string, english: string) => (en ? english : vi);
  const [view, setView] = useState<"learners" | "sessions">("learners");
  const [page, setPage] = useState(1),
    [limit, setLimit] = useState(20),
    [status, setStatus] = useState("all");
  const [draft, setDraft] = useState(""),
    [userId, setUserId] = useState(""),
    [invalid, setInvalid] = useState(false);
  const [learner, setLearner] = useState<DictationLearner | null>(null),
    [session, setSession] = useState<DictationPracticeSession | null>(null),
    [eventPage, setEventPage] = useState(1);
  const params = { page, limit, userId: userId || undefined, status };
  const learners = useQuery({
    queryKey: ["dictation-learners", lesson._id, params],
    queryFn: () => dictationService.getLearners(lesson._id, params),
    placeholderData: keepPreviousData,
  });
  const sessions = useQuery({
    queryKey: ["dictation-sessions", lesson._id, params],
    queryFn: () => dictationService.getSessions(lesson._id, params),
    enabled: view === "sessions",
    placeholderData: keepPreviousData,
  });
  const events = useQuery({
    queryKey: ["dictation-session-events", lesson._id, session?.id, eventPage],
    queryFn: () =>
      dictationService.getSessionEvents(lesson._id, session!.id, eventPage),
    enabled: !!session,
  });
  const learnerData = learners.data
    ? unwrap<import("@/types/dictation-history").DictationLearnersPage>(
        learners.data,
      )
    : undefined;
  const sessionData = sessions.data
    ? unwrap<
        import("@/types/dictation-history").DictationHistoryPage<DictationPracticeSession>
      >(sessions.data)
    : undefined;
  const eventData = events.data
    ? unwrap<
        import("@/types/dictation-history").DictationHistoryPage<DictationHistoryEvent>
      >(events.data)
    : undefined;
  const current = view === "learners" ? learners : sessions,
    data = view === "learners" ? learnerData : sessionData;
  const summary = learnerData?.summary;
  const date = (v: string | null) =>
    v
      ? new Date(v).toLocaleString(en ? "en-GB" : "vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "—";
  const pct = (correct: number, total: number) =>
    total ? `${Math.round((correct / total) * 100)}%` : "—";
  const actions = {
    ATTEMPT: t("Trả lời", "Answer"),
    REPLAY: t("Nghe lại", "Replay"),
    REVEAL_SEGMENT: t("Xem đáp án câu", "Reveal sentence"),
    REVEAL_TRANSCRIPT: t("Xem toàn bộ transcript", "Reveal transcript"),
    RESET: t("Bắt đầu lại", "Reset progress"),
  };
  const pagination = {
    page,
    pageSize: limit,
    totalItems: data?.total ?? 0,
    totalPages: Math.max(1, Math.ceil((data?.total ?? 0) / limit)),
    setPage,
    setPageSize: (n: number) => {
      setLimit(n);
      setPage(1);
    },
  };
  const openSession = (s: DictationPracticeSession) => {
    setSession(s);
    setEventPage(1);
  };
  return (
    <div className="min-w-0 space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          [
            Users,
            t("Người học đã bắt đầu", "Learners started"),
            summary?.learners,
          ],
          [CheckCircle2, t("Đã hoàn thành", "Completed"), summary?.completed],
          [
            History,
            t("Phiên được ghi nhận", "Recorded sessions"),
            summary?.sessions,
          ],
          [
            Activity,
            t("Độ chính xác tích lũy", "Cumulative accuracy"),
            summary ? pct(summary.correct, summary.attempts) : undefined,
          ],
        ].map(([Icon, label, value], i) => {
          const MetricIcon = Icon as typeof Users;
          return (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <MetricIcon aria-hidden className="h-4 w-4 text-blue-600" />
                {label as string}
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-900">
                {value === undefined
                  ? "—"
                  : typeof value === "number"
                    ? value.toLocaleString(en ? "en-US" : "vi-VN")
                    : (value as string)}
              </p>
            </div>
          );
        })}
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:px-5">
          <div>
            <h2 className="font-semibold text-slate-900">
              {t("Hoạt động của người học", "Learner activity")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {t(
                "Tiến độ cộng dồn và từng phiên luyện tập của bài Dictation này.",
                "Cumulative progress and individual practice sessions for this lesson.",
              )}
            </p>
          </div>
          <button
            className={button}
            disabled={current.isFetching}
            onClick={() => {
              void learners.refetch();
              if (view === "sessions") void sessions.refetch();
            }}
          >
            <RefreshCw
              aria-hidden
              className={`h-4 w-4 ${current.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`}
            />
            {t("Làm mới", "Refresh")}
          </button>
        </div>
        <div className="space-y-4 border-b border-slate-100 p-4 sm:px-5">
          <div
            className="flex w-fit rounded-lg bg-slate-100 p-1"
            aria-label={t("Loại dữ liệu", "Data view")}
          >
            {(["learners", "sessions"] as const).map((v) => (
              <button
                key={v}
                aria-pressed={view === v}
                className={`min-h-9 rounded-md px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${view === v ? "bg-white text-blue-700 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
                onClick={() => {
                  setView(v);
                  setPage(1);
                }}
              >
                {v === "learners"
                  ? t("Tiến độ người học", "Learner progress")
                  : t("Phiên làm bài", "Practice sessions")}
              </button>
            ))}
          </div>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              const value = draft.trim();
              if (
                value &&
                !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                  value,
                )
              ) {
                setInvalid(true);
                return;
              }
              setInvalid(false);
              setUserId(value);
              setPage(1);
            }}
          >
            <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">
              {t("Lọc theo ID người dùng", "Filter by user ID")}
              <div className="relative mt-1.5">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"
                />
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  aria-invalid={invalid}
                  aria-describedby={
                    invalid ? "dictation-user-filter-error" : undefined
                  }
                  placeholder={t(
                    "Dán ID người dùng hoặc để trống",
                    "Paste a user ID, or leave empty",
                  )}
                  className={`${control} w-full pl-9`}
                />
              </div>
            </label>
            <label className="text-xs font-medium text-slate-600">
              {t("Trạng thái", "Status")}
              <select
                className={`${control} mt-1.5 block w-full sm:w-44`}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">{t("Tất cả", "All")}</option>
                <option value="completed">
                  {t("Đã hoàn thành", "Completed")}
                </option>
                <option value="in_progress">
                  {t("Chưa hoàn thành", "Not completed")}
                </option>
              </select>
            </label>
            <button
              type="submit"
              className={cn(button,"border-blue-600 bg-blue-600 text-white hover:bg-blue-700")}
            >
              {t("Áp dụng", "Apply")}
            </button>
            {userId && (
              <button
                type="button"
                className={button}
                onClick={() => {
                  setDraft("");
                  setUserId("");
                  setInvalid(false);
                  setPage(1);
                }}
              >
                {t("Xóa lọc", "Clear")}
              </button>
            )}
          </form>
          {invalid && (
            <p
              id="dictation-user-filter-error"
              role="alert"
              className="text-xs text-rose-600"
            >
              {t(
                "Vui lòng nhập đúng ID người dùng (UUID).",
                "Please enter a valid user ID (UUID).",
              )}
            </p>
          )}
          {view === "sessions" && (
            <p className="flex gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-800">
              <Clock3 aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              {t(
                "Lịch sử phiên được ghi nhận từ khi tính năng này được bật. Phiên mới bắt đầu sau 30 phút không hoạt động hoặc khi người học bắt đầu lại.",
                "Session history is recorded from the introduction of this feature. A new session starts after 30 minutes of inactivity or when the learner starts over.",
              )}
            </p>
          )}
        </div>
        {current.isError ? (
          <div
            role="alert"
            className="space-y-3 p-10 text-center text-sm text-slate-600"
          >
            <p>
              {t(
                "Không tải được dữ liệu học tập. Vui lòng thử lại.",
                "Could not load learning data. Please retry.",
              )}
            </p>
            <button className={button} onClick={() => void current.refetch()}>
              {t("Thử lại", "Retry")}
            </button>
          </div>
        ) : current.isLoading ? (
          <div
            role="status"
            className="space-y-3 p-5"
            aria-label={t("Đang tải", "Loading")}
          >
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-14 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : !data?.items.length ? (
          <div className="px-5 py-14 text-center">
            <History aria-hidden className="mx-auto h-8 w-8 text-slate-300" />
            <h3 className="mt-3 text-sm font-semibold text-slate-800">
              {userId || status !== "all"
                ? t("Không có kết quả phù hợp", "No matching results")
                : view === "sessions"
                  ? t(
                      "Chưa có phiên làm bài được ghi nhận",
                      "No recorded practice sessions yet",
                    )
                  : t(
                      "Chưa có người học bắt đầu bài này",
                      "No learners have started this lesson",
                    )}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              {view === "sessions"
                ? t(
                    "Các lần nghe lại, trả lời và xem đáp án mới sẽ được lưu tại đây.",
                    "New replays, answers and reveals will appear here.",
                  )
                : t(
                    "Tiến độ sẽ xuất hiện khi người dùng bắt đầu luyện tập.",
                    "Progress appears when a learner starts practising.",
                  )}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto" aria-busy={current.isFetching}>
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-3">
                      {t("Người học", "Learner")}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {view === "learners"
                        ? t("Tiến độ", "Progress")
                        : t("Bắt đầu phiên", "Session started")}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {t("Trả lời / Chính xác", "Answers / Accuracy")}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {t("Trạng thái", "Status")}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {t("Hoạt động gần nhất", "Last activity")}
                    </th>
                    <th scope="col" className="px-5 py-3">
                      <span className="sr-only">
                        {t("Chi tiết", "Details")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {view === "learners"
                    ? learnerData?.items.map((r) => {
                        const done = new Set([
                            ...(r.completed_segments ?? []),
                            ...(r.revealed_segments ?? []),
                          ]).size,
                          percent = Math.min(
                            100,
                            Math.round(
                              (done / Math.max(1, r.sentence_count)) * 100,
                            ),
                          );
                        return (
                          <tr key={r.id} className="hover:bg-slate-50/60">
                            <td className="max-w-60 px-5 py-4">
                              <UserNameLink
                                userId={r.user_id}
                                name={r.username}
                              />
                            </td>
                            <td className="min-w-40 px-4 py-4">
                              <div className="mb-2 flex justify-between gap-3 text-xs tabular-nums text-slate-600">
                                <span>
                                  {done}/{r.sentence_count}{" "}
                                  {t("câu", "sentences")}
                                </span>
                                <span>{percent}%</span>
                              </div>
                              <div
                                role="progressbar"
                                aria-label={t(
                                  "Tiến độ bài học",
                                  "Lesson progress",
                                )}
                                aria-valuenow={percent}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                className="h-1.5 overflow-hidden rounded-full bg-slate-100"
                              >
                                <div
                                  className="h-full rounded-full bg-blue-600"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </td>
                            <td className="px-4 py-4 tabular-nums">
                              <p className="font-medium text-slate-800">
                                {r.attempts || 0} {t("lần", "answers")}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {pct(r.correct_count, r.attempts)}
                              </p>
                            </td>
                            <td className="px-4 py-4">
                              <Status
                                done={r.completed}
                                label={
                                  r.completed
                                    ? t("Đã hoàn thành", "Completed")
                                    : t("Đang học", "In progress")
                                }
                              />
                            </td>
                            <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600">
                              {date(r.last_practiced_at)}
                            </td>
                            <td className="px-5 py-4">
                              <button
                                className={`${button} whitespace-nowrap text-blue-700`}
                                onClick={() => setLearner(r)}
                              >
                                {t("Chi tiết", "Details")}
                                <ChevronRight aria-hidden className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    : sessionData?.items.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/60">
                          <td className="max-w-60 px-5 py-4">
                            <UserNameLink
                              userId={r.user_id}
                              name={r.username}
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600">
                            {date(r.started_at)}
                            <p className="mt-1 text-slate-400">
                              {Math.floor(r.duration_sec / 60)}m{" "}
                              {r.duration_sec % 60}s
                            </p>
                          </td>
                          <td className="px-4 py-4 tabular-nums">
                            <p className="font-medium text-slate-800">
                              {r.attempts} · {pct(r.correct, r.attempts)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {r.replays} {t("lần nghe lại", "replays")}
                            </p>
                          </td>
                          <td className="px-4 py-4">
                            <Status
                              done={r.completed}
                              label={
                                r.completed
                                  ? t("Đã hoàn thành", "Completed")
                                  : r.status === "ACTIVE"
                                    ? t("Đang làm", "Active")
                                    : t("Đã kết thúc", "Ended")
                              }
                            />
                          </td>
                          <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600">
                            {date(r.last_activity_at)}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              className={`${button} whitespace-nowrap text-blue-700`}
                              onClick={() => openSession(r)}
                            >
                              {t("Xem phiên", "View session")}
                              <ChevronRight aria-hidden className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
            <ListPagination
              pagination={pagination}
              disabled={current.isFetching}
            />
          </>
        )}
      </section>
      <Dialog
        open={!!learner}
        onOpenChange={(open) => {
          if (!open) setLearner(null);
        }}
      >
        <DialogContent className="max-w-3xl rounded-xl">
          <DialogHeader>
            <DialogTitle>
              {t("Chi tiết tiến độ", "Progress details")} ·{" "}
              {learner?.username ?? t("Người học", "Learner")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "Trạng thái tích lũy của từng câu trong bài học.",
                "Cumulative state of each sentence in this lesson.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="divide-y divide-slate-100">
            {lesson.segments?.map((segment, index) => {
              const state = learner?.segment_progress?.find(
                (s) => s.segmentIndex === index,
              );
              return (
                <div key={segment._id ?? index} className="py-4">
                  <p className="text-sm font-medium leading-6 text-slate-800">
                    {index + 1}. {segment.text}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    {state
                      ? `${state.attempts} ${t("lần trả lời", "answers")} · ${state.wrongAttempts} ${t("lần sai", "wrong")} · ${state.replayCount} ${t("lần nghe lại", "replays")} · ${state.correct ? t("Đã đúng", "Correct") : state.revealed ? t("Đã xem đáp án", "Revealed") : t("Đang luyện", "In progress")}`
                      : t("Chưa luyện câu này", "Not practised yet")}
                  </p>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!session}
        onOpenChange={(open) => {
          if (!open) setSession(null);
        }}
      >
        <DialogContent className="max-w-3xl rounded-xl">
          <DialogHeader>
            <DialogTitle>
              {t("Chi tiết phiên làm bài", "Practice session details")}
            </DialogTitle>
            <DialogDescription>
              {session?.username ?? t("Người học", "Learner")} ·{" "}
              {date(session?.started_at ?? null)}
            </DialogDescription>
          </DialogHeader>
          {events.isLoading ? (
            <p
              role="status"
              className="py-8 text-center text-sm text-slate-500"
            >
              {t("Đang tải nhật ký…", "Loading activity…")}
            </p>
          ) : events.isError ? (
            <div role="alert">
              <p className="text-sm text-rose-600">
                {t(
                  "Không tải được nhật ký phiên.",
                  "Could not load this session.",
                )}
              </p>
              <button
                className={`${button} mt-3`}
                onClick={() => void events.refetch()}
              >
                {t("Thử lại", "Retry")}
              </button>
            </div>
          ) : (
            <>
              <ol className="divide-y divide-slate-100">
                {eventData?.items.map((event) => (
                  <li key={event.id} className="py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">
                        {actions[event.action]}
                        {event.segment_index !== null
                          ? ` · ${t("Câu", "Sentence")} ${event.segment_index + 1}`
                          : ""}
                      </p>
                      <time className="text-xs text-slate-500">
                        {date(event.occurred_at)}
                      </time>
                    </div>
                    {event.action === "ATTEMPT" && (
                      <>
                        <div
                          className={`mt-3 rounded-lg border p-3 ${event.is_correct ? "border-emerald-100 bg-emerald-50" : "border-rose-100 bg-rose-50"}`}
                        >
                          <p className="text-xs font-medium text-slate-600">
                            {event.is_correct
                              ? t("Trả lời đúng", "Correct answer")
                              : t("Trả lời sai", "Incorrect answer")}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900 [overflow-wrap:anywhere]">
                            {event.submitted_text ??
                              t(
                                "Không có nội dung câu trả lời được lưu.",
                                "No answer text was recorded.",
                              )}
                          </p>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          {t(
                            "Đáp án tại thời điểm làm bài:",
                            "Reference at the time:",
                          )}{" "}
                          {event.reference_text}
                        </p>
                      </>
                    )}
                  </li>
                ))}
              </ol>
              <ListPagination
                pagination={{
                  page: eventPage,
                  pageSize: 20,
                  totalItems: eventData?.total ?? 0,
                  totalPages: Math.max(
                    1,
                    Math.ceil((eventData?.total ?? 0) / 20),
                  ),
                  setPage: setEventPage,
                }}
                disabled={events.isFetching}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
function Status({ done, label }: { done: boolean; label: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${done ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}
    >
      {label}
    </span>
  );
}
