"use client";
import { useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { isAxiosError } from "axios";
import { Button } from "@/components/ui/button";
import { surface } from "@/components/ui/page";
import { cn } from "@/lib/utils";
import {
  COMMENT_EMOJIS,
  toeicCommunityService,
  type ExamComment,
  type CommunityPage,
} from "@/services/toeic-community.service";

const nextPage = (page: CommunityPage<ExamComment>) =>
  page.page * page.pageSize < page.total ? page.page + 1 : undefined;
function CommentComposer({
  examId,
  replyToId,
  onDone,
  onCancel,
  targetName,
}: {
  examId: string;
  replyToId?: string;
  onDone?: () => void;
  onCancel?: () => void;
  targetName?: string;
}) {
  const { t } = useTranslation("toeic");
  const cache = useQueryClient();
  const [body, setBody] = useState("");
  const [picker, setPicker] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const send = useMutation({
    mutationFn: () =>
      toeicCommunityService.post(examId, body.trim(), replyToId),
    onSuccess: () => {
      setBody("");
      setPicker(false);
      void cache.invalidateQueries({ queryKey: ["toeic-comments", examId] });
      onDone?.();
    },
  });
  const insertEmoji = (emoji: string) => {
    const start = input.current?.selectionStart ?? body.length,
      end = input.current?.selectionEnd ?? body.length;
    const updated = body.slice(0, start) + emoji + body.slice(end);
    if (updated.length > 2000) return;
    setBody(updated);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(
        start + emoji.length,
        start + emoji.length,
      );
    });
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (body.trim() && !send.isPending) send.mutate();
      }}
      className="space-y-2"
    >
      {replyToId && (
        <p className="text-xs font-medium text-blue-700">
          {t("community.replyingTo", {
            name: targetName || t("community.learner"),
          })}
        </p>
      )}
      <label className="sr-only" htmlFor={`comment-${replyToId ?? "new"}`}>
        {t("community.commentLabel")}
      </label>
      <textarea
        id={`comment-${replyToId ?? "new"}`}
        ref={input}
        rows={replyToId ? 2 : 3}
        maxLength={2000}
        disabled={send.isPending}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={t("exam_detail.comments_placeholder")}
        className="w-full resize-y rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={send.isPending}
          aria-expanded={picker}
          onClick={() => setPicker((open) => !open)}
        >
          {t("community.addEmoji")}
        </Button>
        <span className="mr-auto text-xs text-slate-400">
          {body.length}/2000
        </span>
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={send.isPending}
            onClick={onCancel}
          >
            {t("community.cancel")}
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={send.isPending || !body.trim()}
        >
          {t(
            send.isPending
              ? "community.sending"
              : "exam_detail.btn_send_comment",
          )}
        </Button>
      </div>
      {picker && (
        <div
          role="group"
          aria-label={t("community.emojiPicker")}
          className="flex flex-wrap gap-1 rounded-lg border p-2"
        >
          {[...COMMENT_EMOJIS, "😊", "💪", "🔥", "🙏", "✅", "📚"].map(
            (emoji) => (
              <button
                key={emoji}
                type="button"
                disabled={send.isPending}
                aria-label={t("community.insertEmoji", { emoji })}
                onClick={() => insertEmoji(emoji)}
                className="rounded p-2 text-xl hover:bg-slate-100 focus-visible:ring-2"
              >
                {emoji}
              </button>
            ),
          )}
        </div>
      )}
      {send.isError && (
        <p role="alert" className="text-sm text-red-700">
          {t(
            isAxiosError(send.error) && send.error.response?.status === 429
              ? "community.rateLimit"
              : "community.sendError",
          )}
        </p>
      )}
    </form>
  );
}

function CommentCard({
  item,
  examId,
  onReplySent,
}: {
  item: ExamComment;
  examId: string;
  onReplySent?: () => void;
}) {
  const { t, i18n } = useTranslation("toeic");
  const [replying, setReplying] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  const cache = useQueryClient();
  const refresh = () =>
    void cache.invalidateQueries({ queryKey: ["toeic-comments", examId] });
  const react = useMutation({
    mutationFn: (emoji: string) =>
      toeicCommunityService.react(
        examId,
        item.id,
        item.myReaction === emoji ? null : emoji,
      ),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => toeicCommunityService.remove(examId, item.id),
    onSuccess: () => {
      setConfirmDelete(false);
      refresh();
    },
  });
  const name = item.username || t("community.learner");
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="text-sm font-semibold text-slate-800">
          {item.deleted ? t("community.deleted") : name}
        </span>
        {item.isMine && (
          <span className="text-blue-700">{t("community.you")}</span>
        )}
        <time className="text-slate-400" dateTime={item.createdAt}>
          {new Date(item.createdAt).toLocaleString(
            i18n.language === "en" ? "en-GB" : "vi-VN",
          )}
        </time>
      </div>
      {item.replyToId && item.replyToName && (
        <p className="text-xs text-slate-500">
          ↳ {t("community.replyingTo", { name: item.replyToName })}
        </p>
      )}
      <p
        className={cn(
          "whitespace-pre-wrap break-words text-sm leading-relaxed",
          item.deleted ? "italic text-slate-400" : "text-slate-700",
        )}
      >
        {item.deleted ? t("community.deletedBody") : item.body}
      </p>
      {!item.deleted && (
        <>
          <div
            role="group"
            aria-label={t("community.reactions")}
            className="flex flex-wrap items-center gap-2"
          >
            {COMMENT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={t("community.reactWith", { emoji })}
                aria-pressed={item.myReaction === emoji}
                disabled={react.isPending}
                onClick={() => react.mutate(emoji)}
                className={cn(
                  "rounded-full border px-2 py-1 text-xs transition hover:bg-blue-50 disabled:opacity-50",
                  item.myReaction === emoji
                    ? "border-blue-400 bg-blue-50 text-blue-700"
                    : "border-slate-200",
                )}
              >
                <span aria-hidden="true">{emoji}</span>{" "}
                {item.reactions[emoji] ?? 0}
              </button>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setReplying((open) => !open)}
            >
              {t("exam_detail.reply_action")}
            </Button>
            {item.isMine && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
              >
                {t("community.delete")}
              </Button>
            )}
          </div>
          {react.isError && (
            <p role="alert" className="text-xs text-red-700">
              {t("community.reactionError")}
            </p>
          )}
          {confirmDelete && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-3">
              <p className="mr-auto text-xs">{t("community.deleteConfirm")}</p>
              <Button
                size="sm"
                variant="outline"
                disabled={remove.isPending}
                onClick={() => setConfirmDelete(false)}
              >
                {t("community.cancel")}
              </Button>
              <Button
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                {t("community.delete")}
              </Button>
            </div>
          )}
          {remove.isError && (
            <p role="alert" className="text-xs text-red-700">
              {t("community.deleteError")}
            </p>
          )}
          {replying && (
            <div className="rounded-lg bg-slate-50 p-3">
              <CommentComposer
                examId={examId}
                replyToId={item.id}
                targetName={name}
                onCancel={() => setReplying(false)}
                onDone={() => {
                  setReplying(false);
                  onReplySent?.();
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
function CommentThread({
  root,
  examId,
  viewerId,
}: {
  root: ExamComment;
  examId: string;
  viewerId: string;
}) {
  const { t } = useTranslation("toeic");
  const [expanded, setExpanded] = useState(false);
  const replies = useInfiniteQuery({
    queryKey: ["toeic-comments", examId, viewerId, "replies", root.id],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      toeicCommunityService.comments(examId, pageParam, root.id),
    getNextPageParam: nextPage,
    enabled: expanded,
    staleTime: 15000,
  });
  return (
    <article className="space-y-3 border-b border-slate-100 py-5 last:border-b-0">
      <CommentCard
        item={root}
        examId={examId}
        onReplySent={() => setExpanded(true)}
      />
      {(root.replyCount > 0 || expanded) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
        >
          {t(expanded ? "community.hideReplies" : "community.showReplies", {
            count: root.replyCount,
          })}
        </Button>
      )}
      {expanded && (
        <div className="ml-2 space-y-4 border-l-2 border-slate-100 pl-3 sm:ml-5 sm:pl-5">
          {replies.isPending && (
            <p role="status" className="text-xs text-slate-400">
              {t("community.loading")}
            </p>
          )}
          {replies.isError && (
            <div role="alert">
              <p className="text-xs">{t("community.loadError")}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void replies.refetch()}
              >
                {t("community.retry")}
              </Button>
            </div>
          )}
          {replies.data?.pages
            .flatMap((page) => page.items)
            .map((reply) => (
              <div key={reply.id} className="rounded-lg bg-slate-50 p-3">
                <CommentCard item={reply} examId={examId} />
              </div>
            ))}
          {replies.hasNextPage && (
            <Button
              size="sm"
              variant="outline"
              disabled={replies.isFetchingNextPage}
              onClick={() => void replies.fetchNextPage()}
            >
              {t("community.moreReplies")}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
export function ExamComments({
  examId,
  viewerId,
}: {
  examId: string;
  viewerId?: string;
}) {
  const { t } = useTranslation("toeic");
  const query = useInfiniteQuery({
    queryKey: ["toeic-comments", examId, viewerId, "roots"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      toeicCommunityService.comments(examId, pageParam),
    getNextPageParam: nextPage,
    enabled: !!examId && !!viewerId,
    staleTime: 15000,
  });
  return (
    <section className={cn(surface, "space-y-4 p-5 sm:p-6")}>
      <h2 className="font-semibold text-slate-900">
        {t("exam_detail.comments_title")}{" "}
        {query.data && (
          <span className="text-sm font-normal text-slate-500">
            ({query.data.pages[0]?.total ?? 0})
          </span>
        )}
      </h2>
      {!viewerId ? (
        <p className="text-sm">{t("community.login")}</p>
      ) : (
        <>
          <CommentComposer examId={examId} />
          {query.isPending && (
            <div
              role="status"
              aria-label={t("community.loading")}
              className="h-36 animate-pulse rounded-lg bg-slate-100"
            />
          )}
          {query.isError && (
            <div role="alert">
              <p>{t("community.loadError")}</p>
              <Button variant="outline" onClick={() => void query.refetch()}>
                {t("community.retry")}
              </Button>
            </div>
          )}
          {query.data?.pages[0]?.total === 0 && (
            <p className="py-4 text-sm text-slate-500">
              {t("community.commentsEmpty")}
            </p>
          )}
          {query.data?.pages
            .flatMap((page) => page.items)
            .map((item) => (
              <CommentThread
                key={item.id}
                root={item}
                examId={examId}
                viewerId={viewerId}
              />
            ))}
          {query.hasNextPage && (
            <Button
              variant="outline"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {t("community.moreComments")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
