"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  FileCheck2,
  Headphones,
  Trophy,
  Gamepad2,
  RefreshCw,
  ChevronRight,
  History,
  CheckCircle2,
  XCircle,
  Clock3,
} from "lucide-react";
import { useAppSelector } from "@/redux/hooks";
import { hasPermissions } from "@/lib/admin-permissions";
import { userService } from "@/services/user.service";
import type { ExerciseModule, ExerciseRecord } from "@/types/user-exercises";
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
const definitions = [
  {
    key: "toeic",
    permission: "toeic.attempts.read",
    label: "TOEIC",
    icon: FileCheck2,
  },
  {
    key: "vocabulary",
    permission: "vocabulary.read",
    label: "Vocabulary",
    icon: BookOpen,
  },
  {
    key: "dictation",
    permission: "dictation.read",
    label: "Dictation",
    icon: Headphones,
  },
  { key: "arena", permission: "arena.read", label: "Arena", icon: Trophy },
  {
    key: "minigame",
    permission: "games.results.read",
    label: "Minigame",
    icon: Gamepad2,
  },
] as const;
const control =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const button =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50";
export function UserExerciseHistory({ userId }: { userId: string }) {
  const { locale } = useParams();
  const en = locale === "en",
    t = (vi: string, english: string) => (en ? english : vi);
  const viewer = useAppSelector((s) => s.auth.user),
    available = definitions.filter((d) =>
      hasPermissions(viewer, "users.read", d.permission),
    );
  const [selectedModule, setModule] = useState<ExerciseModule>("toeic");
  const module = available.some((d) => d.key === selectedModule)
    ? selectedModule
    : available[0]?.key;
  const [page, setPage] = useState(1),
    [limit, setLimit] = useState(20),
    [status, setStatus] = useState("all");
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [applied, setApplied] = useState<{ from?: string; to?: string }>({}),
    [dateError, setDateError] = useState(false);
  const [selected, setSelected] = useState<ExerciseRecord | null>(null),
    [detailPage, setDetailPage] = useState(1);
  const query = useQuery({
    queryKey: ["user-exercises", userId, module, page, limit, status, applied],
    queryFn: () =>
      userService.getExercises(userId, module!, {
        page,
        limit,
        status,
        ...applied,
      }),
    enabled: !!module,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === userId &&
      previousQuery.queryKey[2] === module
        ? previous
        : undefined,
  });
  const detail = useQuery({
    queryKey: [
      "user-exercise-detail",
      userId,
      selected?.module,
      selected?.id,
      detailPage,
    ],
    queryFn: () =>
      userService.getExerciseDetail(
        userId,
        selected!.module,
        selected!.id,
        detailPage,
      ),
    enabled: !!selected,
  });
  const date = (v: string | null | undefined) =>
    v
      ? new Date(v).toLocaleString(en ? "en-GB" : "vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          dateStyle: "short",
          timeStyle: "short",
        })
      : "—";
  const duration = (n: number | null) =>
    n == null ? "—" : `${Math.floor(n / 60)}m ${n % 60}s`;
  const gameName = (value: string) =>
    ({
      WORD_SHOOTER: t("Bắn từ vựng", "Word shooter"),
      TYPING_RUSH: t("Gõ từ tốc độ", "Typing rush"),
      MEANING_TYPING: t("Gõ theo nghĩa", "Meaning typing"),
    })[value] ?? value;
  const title = (r: ExerciseRecord) =>
    r.module === "minigame" ? gameName(r.title) : r.title;
  const modeName = (value?: string) =>
    ({
      FLASHCARD: t("Thẻ từ", "Flashcards"),
      MULTIPLE_CHOICE: t("Chọn đáp án", "Multiple choice"),
      TYPING: t("Gõ từ", "Typing"),
    })[value ?? ""] ??
    value ??
    "";
  const answer = (value: string | null, rating?: string) =>
    rating
      ? ({
          AGAIN: t("Cần học lại", "Again"),
          HARD: t("Khó nhớ", "Hard"),
          GOOD: t("Đã nhớ", "Good"),
          EASY: t("Dễ nhớ", "Easy"),
        }[rating] ?? value)
      : value;
  const statusName = (value: string) =>
    ({
      FINISHED: t("Đã kết thúc", "Finished"),
      COMPLETED: t("Hoàn thành", "Completed"),
      IN_PROGRESS: t("Đang làm", "In progress"),
      ABANDONED: t("Đã dừng", "Abandoned"),
      ENDED: t("Đã kết thúc", "Ended"),
      CANCELLED: t("Đã hủy", "Cancelled"),
      PLAYING: t("Đang chơi", "Playing"),
      WAITING: t("Đang chờ", "Waiting"),
      COUNTDOWN: t("Sắp bắt đầu", "Starting"),
      PAUSED: t("Tạm dừng", "Paused"),
      RESUMING: t("Đang tiếp tục", "Resuming"),
      FINISHING: t("Đang kết thúc", "Finishing"),
    })[value] ?? value;
  const result = (r: ExerciseRecord) =>
    r.module === "arena" && r.metadata.result
      ? ({
          WIN: t("Thắng", "Win"),
          LOSS: t("Thua", "Loss"),
          DRAW: t("Hòa", "Draw"),
        }[r.metadata.result] ?? "—")
      : r.score != null
        ? `${r.score}${r.scoreMax ? ` / ${r.scoreMax}` : ""}`
        : r.total && r.correct != null
          ? `${r.correct} / ${r.total}`
          : "—";
  const accuracy = (r: ExerciseRecord) =>
    r.correct != null && r.total
      ? `${Math.round((r.correct / r.total) * 100)}% ${t("chính xác", "accuracy")}`
      : "—";
  const clean = (s: string) =>
    s
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const action = (value?: string) =>
    ({
      ATTEMPT: t("Trả lời", "Answer"),
      REPLAY: t("Nghe lại", "Replay"),
      REVEAL_SEGMENT: t("Xem đáp án câu", "Reveal sentence"),
      REVEAL_TRANSCRIPT: t("Xem transcript", "Reveal transcript"),
      RESET: t("Bắt đầu lại", "Start over"),
    })[value ?? ""] ??
    value ??
    "";
  const pages = {
    page,
    pageSize: limit,
    totalItems: query.data?.total ?? 0,
    totalPages: Math.max(1, Math.ceil((query.data?.total ?? 0) / limit)),
    setPage,
    setPageSize: (n: number) => {
      setLimit(n);
      setPage(1);
    },
  };
  if (!available.length)
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
        {t(
          "Bạn chưa có quyền xem lịch sử làm bài của các module.",
          "You do not have permission to view exercise histories.",
        )}
      </section>
    );
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            {t("Các lần làm bài của học viên", "Learner exercise history")}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {t(
              "Xem từng lượt học, kết quả và chi tiết câu trả lời theo loại bài tập.",
              "Review individual sessions, results and answers by exercise type.",
            )}
          </p>
        </div>
        <button
          className={button}
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw
            aria-hidden
            className={`h-4 w-4 ${query.isFetching ? "animate-spin motion-reduce:animate-none" : ""}`}
          />
          {t("Làm mới", "Refresh")}
        </button>
      </div>
      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div
          className="flex gap-1 overflow-x-auto border-b border-slate-100 px-4 pt-2"
          role="group"
          aria-label={t("Loại bài tập", "Exercise type")}
        >
          {available.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={module === key}
              onClick={() => {
                setModule(key);
                setPage(1);
              }}
              className={`inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${module === key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-900"}`}
            >
              <Icon aria-hidden className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
        <form
          className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:flex-wrap sm:items-end sm:px-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (from && to && from > to) {
              setDateError(true);
              return;
            }
            setDateError(false);
            setApplied({
              from: from
                ? new Date(`${from}T00:00:00+07:00`).toISOString()
                : undefined,
              to: to
                ? new Date(
                    new Date(`${to}T00:00:00+07:00`).getTime() + 86400000,
                  ).toISOString()
                : undefined,
            });
            setPage(1);
          }}
        >
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
                {t("Đã kết thúc / Hoàn thành", "Finished / Completed")}
              </option>
              <option value="unfinished">
                {t("Chưa hoàn thành", "Not completed")}
              </option>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            {t("Từ ngày", "From")}
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={`${control} mt-1.5 block w-full`}
              aria-invalid={dateError}
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            {t("Đến ngày", "Until")}
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={`${control} mt-1.5 block w-full`}
              aria-invalid={dateError}
            />
          </label>
          <button className={button} type="submit">
            {t("Lọc thời gian", "Filter dates")}
          </button>
          {(applied.from || applied.to) && (
            <button
              className={button}
              type="button"
              onClick={() => {
                setFrom("");
                setTo("");
                setApplied({});
                setDateError(false);
                setPage(1);
              }}
            >
              {t("Xóa lọc ngày", "Clear dates")}
            </button>
          )}
          {dateError && (
            <p role="alert" className="w-full text-xs text-rose-600">
              {t(
                "Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.",
                "The end date must be on or after the start date.",
              )}
            </p>
          )}
        </form>
        {module === "dictation" && (
          <p className="border-b border-blue-100 bg-blue-50 px-5 py-3 text-xs leading-5 text-blue-800">
            {t(
              "Lịch sử phiên Dictation được lưu từ khi tính năng ghi phiên được bật. Tiến độ các bài trước đó vẫn có trong tab Tiến độ học tập.",
              "Dictation sessions are recorded from the introduction of session tracking. Earlier cumulative progress remains in the Learning progress tab.",
            )}
          </p>
        )}
        {query.isError ? (
          <div
            role="alert"
            className="space-y-3 px-5 py-12 text-center text-sm text-slate-600"
          >
            <p>
              {t(
                "Không tải được lịch sử làm bài. Dữ liệu nguồn có thể đang tạm gián đoạn.",
                "Could not load exercise history. The source may be temporarily unavailable.",
              )}
            </p>
            <button className={button} onClick={() => void query.refetch()}>
              {t("Thử lại", "Retry")}
            </button>
          </div>
        ) : query.isLoading ? (
          <div
            role="status"
            className="space-y-3 p-5"
            aria-label={t("Đang tải lịch sử", "Loading history")}
          >
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-16 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : !query.data?.items.length ? (
          <div className="px-5 py-14 text-center">
            <History aria-hidden className="mx-auto h-8 w-8 text-slate-300" />
            <h4 className="mt-3 text-sm font-semibold text-slate-800">
              {t(
                "Chưa có lượt làm bài phù hợp",
                "No matching exercise records",
              )}
            </h4>
            <p className="mt-2 text-sm text-slate-500">
              {t(
                "Chọn loại bài tập khác hoặc thay đổi bộ lọc để xem thêm.",
                "Select another exercise type or adjust the filters.",
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto" aria-busy={query.isFetching}>
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-3">
                      {t("Bài tập / Phiên học", "Exercise / Session")}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {t("Bắt đầu", "Started")}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {t("Kết quả", "Result")}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {t("Thời lượng", "Duration")}
                    </th>
                    <th scope="col" className="px-4 py-3">
                      {t("Trạng thái", "Status")}
                    </th>
                    <th scope="col" className="px-5 py-3">
                      <span className="sr-only">
                        {t("Xem chi tiết", "View details")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {query.data.items.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/60">
                      <td className="max-w-80 px-5 py-4">
                        <p className="font-medium leading-6 text-slate-900 [overflow-wrap:anywhere]">
                          {title(r)}
                        </p>
                        {r.metadata.mode && (
                          <p className="mt-1 text-xs text-slate-500">
                            {r.metadata.mode === "TEST"
                              ? t("Thi thử", "Test")
                              : t("Luyện tập", "Practice")}
                          </p>
                        )}
                        {r.module === "vocabulary" && (
                          <p className="mt-1 text-xs text-slate-500">
                            {r.metadata.completedWords ?? 0}/
                            {r.metadata.totalWords ?? 0}{" "}
                            {t("từ đã luyện", "words practised")}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-600">
                        {date(r.startedAt)}
                      </td>
                      <td className="px-4 py-4 tabular-nums">
                        <p className="font-semibold text-slate-800">
                          {result(r)}
                        </p>
                        <p className="mt-1 whitespace-nowrap text-xs text-slate-500">
                          {r.module === "arena" &&
                          r.metadata.ratingChange != null
                            ? `${r.metadata.ratingChange > 0 ? "+" : ""}${r.metadata.ratingChange} Elo`
                            : accuracy(r)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-xs tabular-nums text-slate-600">
                        {duration(r.durationSec)}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${["FINISHED", "COMPLETED"].includes(r.status) ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}
                        >
                          {statusName(r.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          className={`${button} whitespace-nowrap text-blue-700`}
                          onClick={() => {
                            setSelected(r);
                            setDetailPage(1);
                          }}
                        >
                          {t("Chi tiết", "Details")}
                          <ChevronRight aria-hidden className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ListPagination pagination={pages} disabled={query.isFetching} />
          </>
        )}
      </section>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent className="max-w-3xl rounded-xl">
          <DialogHeader>
            <DialogTitle>
              {selected
                ? title(selected)
                : t("Chi tiết làm bài", "Exercise details")}
            </DialogTitle>
            <DialogDescription>
              {selected
                ? `${date(selected.startedAt)} · ${statusName(selected.status)}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          {detail.isLoading ? (
            <p
              role="status"
              className="py-10 text-center text-sm text-slate-500"
            >
              {t("Đang tải chi tiết…", "Loading details…")}
            </p>
          ) : detail.isError ? (
            <div role="alert">
              <p className="text-sm text-rose-600">
                {t(
                  "Không tải được chi tiết lượt làm bài.",
                  "Could not load exercise details.",
                )}
              </p>
              <button
                className={`${button} mt-3`}
                onClick={() => void detail.refetch()}
              >
                {t("Thử lại", "Retry")}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500">
                    {t("Kết quả", "Result")}
                  </p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {detail.data ? result(detail.data.record) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">
                    {t("Thời lượng phiên", "Session duration")}
                  </p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {duration(detail.data?.record.durationSec ?? null)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">
                    {t("Kết thúc", "Finished")}
                  </p>
                  <p className="mt-1 text-xs font-medium">
                    {date(detail.data?.record.finishedAt)}
                  </p>
                </div>
              </div>
              {!detail.data?.items.length ? (
                <p className="rounded-lg border border-dashed border-slate-200 p-6 text-sm leading-6 text-slate-500">
                  {t(
                    "Lượt này chỉ có kết quả tổng; chưa có dữ liệu chi tiết từng câu được lưu.",
                    "Only the overall result is available; individual answers were not recorded.",
                  )}
                </p>
              ) : (
                <>
                  <ol className="divide-y divide-slate-100">
                    {detail.data.items.map((row) => (
                      <li key={row.id} className="py-4">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600">
                            {row.index}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                              {row.metadata?.action ? (
                                <span>
                                  {action(row.metadata.action)}
                                  {row.metadata.segmentIndex != null
                                    ? ` · ${t("Câu", "Sentence")} ${row.metadata.segmentIndex + 1}`
                                    : ""}
                                </span>
                              ) : row.metadata?.part ? (
                                <span>Part {row.metadata.part}</span>
                              ) : (
                                <span>{modeName(row.metadata?.mode)}</span>
                              )}
                              {row.occurredAt && (
                                <time>{date(row.occurredAt)}</time>
                              )}
                            </div>
                            <p className="whitespace-pre-wrap text-sm font-medium leading-6 text-slate-900 [overflow-wrap:anywhere]">
                              {row.metadata?.action &&
                              row.metadata.action !== "ATTEMPT"
                                ? action(row.metadata.action)
                                : clean(row.prompt)}
                            </p>
                            {(!row.metadata?.action ||
                              row.metadata.action === "ATTEMPT") && (
                              <>
                                <div
                                  className={`mt-3 flex gap-2 rounded-lg border p-3 ${row.correct === true ? "border-emerald-100 bg-emerald-50" : row.correct === false ? "border-rose-100 bg-rose-50" : "border-slate-200 bg-slate-50"}`}
                                >
                                  {row.correct === true ? (
                                    <CheckCircle2
                                      aria-hidden
                                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                                    />
                                  ) : row.correct === false ? (
                                    <XCircle
                                      aria-hidden
                                      className="mt-0.5 h-4 w-4 shrink-0 text-rose-600"
                                    />
                                  ) : (
                                    <Clock3
                                      aria-hidden
                                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-600">
                                      {row.correct === true
                                        ? t("Đúng", "Correct")
                                        : row.correct === false
                                          ? t("Sai", "Incorrect")
                                          : t("Chưa có kết quả", "No result")}
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-900 [overflow-wrap:anywhere]">
                                      {answer(
                                        row.submitted,
                                        row.metadata?.rating,
                                      ) ??
                                        t(
                                          "Không có câu trả lời được lưu.",
                                          "No answer was recorded.",
                                        )}
                                    </p>
                                  </div>
                                </div>
                                {row.expected && (
                                  <p className="mt-2 text-xs leading-6 text-slate-600">
                                    {t("Đáp án:", "Reference:")}{" "}
                                    {clean(row.expected)}
                                  </p>
                                )}
                                {row.metadata?.explanation && (
                                  <p className="mt-2 text-xs leading-6 text-slate-500">
                                    {clean(row.metadata.explanation)}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                  <ListPagination
                    pagination={{
                      page: detailPage,
                      pageSize: 20,
                      totalItems: detail.data.total,
                      totalPages: Math.max(
                        1,
                        Math.ceil(detail.data.total / 20),
                      ),
                      setPage: setDetailPage,
                    }}
                    disabled={detail.isFetching}
                  />
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
