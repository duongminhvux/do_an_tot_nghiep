"use client";

import { UserNameLink } from "@/components/users/user-name-link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Pin, Trash2, Trophy, MessageSquare } from "lucide-react";
import {
  examCommunityService,
  type ExamComment,
} from "@/services/exam-community.service";
import { ListPagination } from "@/components/ui/list-pagination";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { hasPermissions } from "@/lib/admin-permissions";
import { useAppSelector } from "@/redux/hooks";

const surface =
  "min-w-0 space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6";
function useContext() {
  const { id, locale } = useParams<{ id: string; locale: string }>();
  const en = locale === "en";
  return {
    id,
    en,
    text: (vi: string, english: string) => (en ? english : vi),
    date: (value: string) =>
      new Date(value).toLocaleString(en ? "en-US" : "vi-VN"),
  };
}
function QueryState({
  loading,
  error,
  empty,
  retry,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
  retry: () => void;
}) {
  const { text } = useContext();
  if (!loading && !error && !empty) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className="space-y-3 py-12 text-center text-sm text-slate-600"
    >
      <p>
        {loading
          ? text("Đang tải dữ liệu…", "Loading…")
          : error
            ? text(
                "Không tải được dữ liệu. Vui lòng thử lại.",
                "Could not load data. Please retry.",
              )
            : text("Chưa có dữ liệu.", "No data yet.")}
      </p>
      {error && (
        <Button variant="outline" onClick={retry}>
          {text("Thử lại", "Retry")}
        </Button>
      )}
    </div>
  );
}
function Pager({
  page,
  setPage,
  total,
  busy,
}: {
  page: number;
  setPage: (page: number) => void;
  total: number;
  busy: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / 20));
  useEffect(() => {
    if (!busy && page > totalPages) setPage(totalPages);
  }, [page, totalPages, busy, setPage]);
  return (
    <ListPagination
      pagination={{
        page,
        setPage,
        pageSize: 20,
        totalItems: total,
        totalPages,
      }}
      disabled={busy}
    />
  );
}
export function ExamLeaderboardTab() {
  const { id, text, date } = useContext();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["admin-exam-leaderboard", id, page],
    queryFn: () => examCommunityService.leaderboard(id, page),
    placeholderData: keepPreviousData,
  });
  const result = query.data;
  return (
    <section
      className={surface}
      aria-label={text("Thống kê và xếp hạng", "Statistics and ranking")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <Trophy aria-hidden="true" className="size-5 text-amber-600" />
            {text("Thống kê & xếp hạng", "Statistics & ranking")}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            {text(
              "Mỗi người lấy bài TEST đầy đủ tốt nhất của phiên bản đề hiện tại. Xếp theo số câu đúng; nếu bằng nhau, ưu tiên thời gian làm nhanh hơn, sau đó thời điểm nộp sớm hơn. Không tính bài luyện tập.",
              "Best full TEST per learner for the current exam version. Sorted by correct answers, then faster duration and earlier submission. Practice attempts are excluded.",
            )}
          </p>
        </div>
        <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
          {result?.total ?? 0} {text("người được xếp hạng", "ranked learners")}
        </span>
      </div>
      <QueryState
        loading={query.isLoading}
        error={query.isError}
        empty={!result?.items.length}
        retry={() => void query.refetch()}
      />
      {!query.isError && !!result?.items.length && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                {[
                  text("Hạng", "Rank"),
                  text("Người làm", "Learner"),
                  text("Câu đúng", "Correct"),
                  text("Điểm ước tính", "Estimated score"),
                  text("Thời gian", "Duration"),
                  text("Nộp bài", "Submitted"),
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="whitespace-nowrap px-3 py-3 font-semibold"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {result.items.map((row) => (
                <tr
                  key={row.userId}
                  className="text-slate-700 hover:bg-slate-50"
                >
                  <td className="px-3 py-4 font-bold tabular-nums">
                    {row.rank === 1 && (
                      <Trophy
                        aria-label={text("Cao nhất", "Highest")}
                        className="mb-1 size-4 text-amber-600"
                      />
                    )}
                    #{row.rank}
                  </td>
                  <td className="px-3 py-4">
                    <UserNameLink userId={row.userId} name={row.username} />
                  </td>
                  <td className="px-3 py-4 font-semibold tabular-nums">
                    {row.correct}/{row.total}
                  </td>
                  <td className="px-3 py-4 tabular-nums">
                    {row.estimatedScore ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 tabular-nums">
                    {Math.floor(row.durationSpent / 60)}:
                    {String(row.durationSpent % 60).padStart(2, "0")}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4">
                    {date(row.completedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!query.isError && (
        <Pager
          page={page}
          setPage={setPage}
          total={result?.total ?? 0}
          busy={query.isFetching}
        />
      )}
    </section>
  );
}
function CommentList({ root }: { root?: string }) {
  const { id, text, date } = useContext();
  const user = useAppSelector((state) => state.auth.user);
  const canModerate = hasPermissions(user, "toeic.comments.moderate");
  const cache = useQueryClient();
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selected, setSelected] = useState<ExamComment | null>(null);
  const query = useQuery({
    queryKey: ["admin-exam-comments", id, root ?? "roots", page],
    queryFn: () => examCommunityService.comments(id, page, root),
    placeholderData: keepPreviousData,
  });
  const mutation = useMutation({
    mutationFn: (action: { id: string; pinned?: boolean }) =>
      action.pinned === undefined
        ? examCommunityService.remove(id, action.id)
        : examCommunityService.pin(id, action.id, action.pinned),
    onSuccess: async () => {
      setSelected(null);
      await cache.invalidateQueries({ queryKey: ["admin-exam-comments", id] });
    },
  });
  const result = query.data;
  return (
    <div className="min-w-0 space-y-4">
      <QueryState
        loading={query.isLoading}
        error={query.isError}
        empty={!result?.items.length}
        retry={() => void query.refetch()}
      />
      {mutation.isError && (
        <p role="alert" className="text-sm text-red-700">
          {text(
            "Thao tác thất bại. Vui lòng thử lại.",
            "Action failed. Please retry.",
          )}
        </p>
      )}
      {!query.isError &&
        result?.items.map((comment) => (
          <article
            key={comment.id}
            className={`min-w-0 rounded-xl border p-4 ${comment.isPinned ? "border-blue-200 bg-blue-50/40" : "border-slate-200"}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm">
                  {comment.deleted ? (
                    <span className="font-semibold text-slate-500">
                      {text("Bình luận đã xoá", "Deleted comment")}
                    </span>
                  ) : (
                    <UserNameLink
                      userId={comment.authorId}
                      name={comment.username}
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {date(comment.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {comment.isPinned && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">
                    <Pin aria-hidden="true" className="size-3" />
                    {text("Đã ghim", "Pinned")}
                  </span>
                )}
                {canModerate && !comment.deleted && (
                  <>
                    {!root && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-10"
                        disabled={mutation.isPending || query.isFetching}
                        onClick={() =>
                          mutation.mutate({
                            id: comment.id,
                            pinned: !comment.isPinned,
                          })
                        }
                      >
                        <Pin aria-hidden="true" className="mr-1 size-4" />
                        {comment.isPinned
                          ? text("Bỏ ghim", "Unpin")
                          : text("Ghim", "Pin")}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="min-h-10 text-red-700 hover:text-red-800"
                      disabled={mutation.isPending || query.isFetching}
                      onClick={() => {
                        mutation.reset();
                        setSelected(comment);
                      }}
                    >
                      <Trash2 aria-hidden="true" className="mr-1 size-4" />
                      {text("Xoá", "Delete")}
                    </Button>
                  </>
                )}
              </div>
            </div>
            {!comment.deleted && (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700 [overflow-wrap:anywhere]">
                {comment.replyToName && (
                  <span className="font-semibold">@{comment.replyToName} </span>
                )}
                {comment.body}
              </p>
            )}
            {!root && comment.replyCount > 0 && (
              <div className="mt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-expanded={expanded === comment.id}
                  onClick={() =>
                    setExpanded(expanded === comment.id ? null : comment.id)
                  }
                >
                  {expanded === comment.id
                    ? text("Ẩn trả lời", "Hide replies")
                    : `${text("Xem trả lời", "View replies")} (${comment.replyCount})`}
                </Button>
                {expanded === comment.id && (
                  <div className="mt-3 border-l-2 border-slate-200 pl-3">
                    <CommentList root={comment.id} />
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      {!query.isError && (
        <Pager
          page={page}
          setPage={setPage}
          total={result?.total ?? 0}
          busy={query.isFetching}
        />
      )}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !mutation.isPending) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {text("Xoá bình luận?", "Delete comment?")}
            </DialogTitle>
            <DialogDescription>
              {text(
                "Nội dung sẽ bị xoá. Các phản hồi trong cuộc thảo luận vẫn được giữ lại.",
                "The content will be deleted. Replies in the discussion will be preserved.",
              )}
            </DialogDescription>
          </DialogHeader>
          <p className="max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm [overflow-wrap:anywhere]">
            {selected?.body}
          </p>
          {mutation.isError && (
            <p role="alert" className="text-sm text-red-700">
              {text(
                "Không thể xoá. Vui lòng thử lại.",
                "Could not delete. Please retry.",
              )}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => setSelected(null)}
            >
              {text("Huỷ", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={mutation.isPending}
              onClick={() => selected && mutation.mutate({ id: selected.id })}
            >
              {mutation.isPending
                ? text("Đang xoá…", "Deleting…")
                : text("Xoá bình luận", "Delete comment")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export function ExamCommentsTab() {
  const { text } = useContext();
  return (
    <section className={surface}>
      <div>
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          <MessageSquare aria-hidden="true" className="size-5 text-blue-600" />
          {text("Quản lý bình luận", "Comment management")}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {text(
            "Ghim bình luận chính để đưa lên đầu cuộc thảo luận. Mở trả lời để kiểm duyệt từng phản hồi.",
            "Pin a root comment to bring it to the top. Expand replies to moderate each response.",
          )}
        </p>
      </div>
      <CommentList />
    </section>
  );
}
