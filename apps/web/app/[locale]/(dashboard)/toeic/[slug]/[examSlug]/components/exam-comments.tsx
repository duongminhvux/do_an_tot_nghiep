'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, Send, ThumbsUp, MessageCircle, CornerDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommentItem {
  id: string;
  author: string;
  avatarColor: string;
  badge?: string;
  createdAt: string;
  content: string;
  likes: number;
  isLiked?: boolean;
  replies?: {
    id: string;
    author: string;
    badge?: string;
    createdAt: string;
    content: string;
  }[];
}

const INITIAL_COMMENTS: CommentItem[] = [
  {
    id: 'c1',
    author: 'Hoàng Long',
    avatarColor: 'bg-blue-600',
    badge: '850 TOEIC',
    createdAt: '2 giờ trước',
    content: 'Đề này phần Listening Part 3 nói hơi nhanh từ câu 50 đến 65, đặc biệt có một số giọng Anh-Úc khá lạ tai. Các bạn nên luyện nghe kỹ ngữ điệu của speaker nữ nhé!',
    likes: 8,
    isLiked: false,
    replies: [
      {
        id: 'r1',
        author: 'Minh Anh',
        badge: 'Học viên',
        createdAt: '1 giờ trước',
        content: 'Chuẩn luôn bạn ơi, đoạn đó mình cũng bị lỡ 2 câu. Phải nghe kỹ từ khóa mới bắt kịp.',
      },
    ],
  },
  {
    id: 'c2',
    author: 'Thu Trang',
    avatarColor: 'bg-emerald-600',
    badge: 'Học viên',
    createdAt: '1 ngày trước',
    content: 'Part 7 đoạn văn 3 đoạn (Triple Passage) cuối cùng hơi dài, mình suýt không kịp giờ. May mà câu hỏi đi theo thứ tự đoạn văn nên scan thông tin vẫn kịp.',
    likes: 5,
    isLiked: false,
  },
  {
    id: 'c3',
    author: 'Văn Đức',
    avatarColor: 'bg-purple-600',
    badge: 'Học viên',
    createdAt: '2 ngày trước',
    content: 'Cho mình hỏi câu 128 Part 5 chọn đáp án nào vậy mọi người, phân vân giữa B và C quá ạ?',
    likes: 3,
    isLiked: false,
    replies: [
      {
        id: 'r2',
        author: 'Daily English Mentor',
        badge: 'Giáo viên',
        createdAt: '1 ngày trước',
        content: 'Đáp án B nhé bạn, vì sau giới từ "by" cần một V-ing đóng vai trò danh động từ mang tân ngữ phía sau.',
      },
    ],
  },
];

interface ExamCommentsProps {
  currentUser?: any;
}

export function ExamComments({ currentUser }: ExamCommentsProps) {
  const { t } = useTranslation('toeic');
  const [comments, setComments]           = useState<CommentItem[]>(INITIAL_COMMENTS);
  const [commentInput, setCommentInput]   = useState('');
  const [commentFilter, setCommentFilter] = useState<'all' | 'qa' | 'newest'>('all');
  const [replyingTo, setReplyingTo]       = useState<string | null>(null);
  const [replyInput, setReplyInput]       = useState('');

  const handleToggleLike = (id: string) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const isLiked = !c.isLiked;
          return {
            ...c,
            isLiked,
            likes: isLiked ? c.likes + 1 : c.likes - 1,
          };
        }
        return c;
      })
    );
  };

  const handleAddComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentInput.trim()) return;
    const authorName = currentUser?.fullName || currentUser?.username || 'Học viên';
    const newComment: CommentItem = {
      id: `c_${Date.now()}`,
      author: authorName,
      avatarColor: 'bg-blue-600',
      badge: 'Học viên',
      createdAt: 'Vừa xong',
      content: commentInput.trim(),
      likes: 0,
      isLiked: false,
    };
    setComments((prev) => [newComment, ...prev]);
    setCommentInput('');
  };

  const handleAddReply = (commentId: string) => {
    if (!replyInput.trim()) return;
    const authorName = currentUser?.fullName || currentUser?.username || 'Học viên';
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          return {
            ...c,
            replies: [
              ...(c.replies || []),
              {
                id: `r_${Date.now()}`,
                author: authorName,
                badge: 'Học viên',
                createdAt: 'Vừa xong',
                content: replyInput.trim(),
              },
            ],
          };
        }
        return c;
      })
    );
    setReplyInput('');
    setReplyingTo(null);
  };

  return (
    <div className="rounded border border-slate-200 bg-white shadow-xs p-5 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-50 text-blue-600">
            <MessageSquare className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{t('exam_detail.comments_title')}</h2>
            <p className="text-xs text-slate-500">{comments.length} bình luận & thảo luận từ cộng đồng</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 self-start sm:self-auto">
          {(['all', 'qa', 'newest'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setCommentFilter(filter)}
              className={cn(
                'px-3 py-1 text-xs rounded font-medium transition cursor-pointer',
                commentFilter === filter
                  ? 'bg-blue-50 text-blue-600 font-semibold border border-blue-100'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              )}
            >
              {t(`exam_detail.filter_${filter}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Form tạo bình luận */}
      <form onSubmit={handleAddComment} className="flex gap-3 items-start">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs shadow-xs">
          {((currentUser?.username?.[0] || 'N')).toUpperCase()}
        </div>
        <div className="flex-1 space-y-2">
          <div className="rounded border border-slate-200 bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition overflow-hidden">
            <textarea
              rows={3}
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              placeholder={t('exam_detail.comments_placeholder')}
              className="w-full p-3 text-sm text-slate-800 placeholder-slate-400 outline-none resize-none"
            />
            <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                Nhấn Gửi để đóng góp ý kiến
              </span>
              <button
                type="submit"
                disabled={!commentInput.trim()}
                className="inline-flex items-center gap-1.5 rounded bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <Send className="h-3 w-3" />
                {t('exam_detail.btn_send_comment')}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Danh sách bình luận */}
      <div className="space-y-4 pt-2">
        {comments.map((comment) => (
          <div key={comment.id} className="space-y-3 pb-4 border-b border-slate-100 last:border-b-0 last:pb-0">
            <div className="flex items-start gap-3">
              <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white font-bold text-xs', comment.avatarColor)}>
                {comment.author.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-slate-800">{comment.author}</span>
                  {comment.badge && (
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.2 rounded">
                      {comment.badge}
                    </span>
                  )}
                  <span className="text-xs text-slate-400">• {comment.createdAt}</span>
                </div>
                <p className="mt-1 text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                  {comment.content}
                </p>

                {/* Reaction / Reply bar */}
                <div className="mt-2.5 flex items-center gap-4 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => handleToggleLike(comment.id)}
                    className={cn(
                      'flex items-center gap-1 transition cursor-pointer',
                      comment.isLiked ? 'text-blue-600 font-bold' : 'text-slate-500 hover:text-blue-600'
                    )}
                  >
                    <ThumbsUp className={cn('h-3.5 w-3.5', comment.isLiked && 'fill-blue-600')} />
                    <span>{comment.likes > 0 ? comment.likes : t('exam_detail.like_action')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                    className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition cursor-pointer"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>{t('exam_detail.reply_action')}</span>
                  </button>
                </div>

                {/* Reply box if active */}
                {replyingTo === comment.id && (
                  <div className="mt-3 flex items-start gap-2 pl-2">
                    <CornerDownRight className="h-4 w-4 text-slate-300 mt-2 shrink-0" />
                    <div className="flex-1 flex gap-2">
                      <input
                        type="text"
                        value={replyInput}
                        onChange={(e) => setReplyInput(e.target.value)}
                        placeholder="Viết câu trả lời..."
                        className="flex-1 rounded border border-slate-200 px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-blue-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddReply(comment.id);
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddReply(comment.id)}
                        disabled={!replyInput.trim()}
                        className="rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition cursor-pointer"
                      >
                        Gửi
                      </button>
                    </div>
                  </div>
                )}

                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-3 pl-4 border-l-2 border-slate-100 space-y-2.5">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="text-xs bg-slate-50/70 p-2.5 rounded">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800">{reply.author}</span>
                          {reply.badge && (
                            <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100">
                              {reply.badge}
                            </span>
                          )}
                          <span className="text-slate-400">• {reply.createdAt}</span>
                        </div>
                        <p className="mt-1 text-slate-600 leading-normal">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
