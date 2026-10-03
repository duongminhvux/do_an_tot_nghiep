'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { PassageItem } from '@/types';
import { BookOpen, FileText, Layers, Mail, Volume2, Megaphone, Newspaper, Bell, MessageSquare, Image as ImageIcon } from 'lucide-react';

interface ExamPassagesTabProps {
  passagesList: PassageItem[];
}

export function ExamPassagesTab({ passagesList }: ExamPassagesTabProps) {
  const { t } = useTranslation('assessment');

  const getPassageTypeIcon = (type?: string) => {
    switch (type) {
      case 'IMAGE':
        return <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />;
      case 'EMAIL':
        return <Mail className="h-3.5 w-3.5 text-blue-600" />;
      case 'ADVERTISEMENT':
        return <Megaphone className="h-3.5 w-3.5 text-amber-600" />;
      case 'ARTICLE':
        return <Newspaper className="h-3.5 w-3.5 text-emerald-600" />;
      case 'NOTICE':
        return <Bell className="h-3.5 w-3.5 text-purple-600" />;
      case 'CHAT':
        return <MessageSquare className="h-3.5 w-3.5 text-pink-600" />;
      default:
        return <FileText className="h-3.5 w-3.5 text-slate-600" />;
    }
  };

  const getPassageTypeBadge = (type?: string) => {
    switch (type) {
      case 'EMAIL':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'ADVERTISEMENT':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'ARTICLE':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'NOTICE':
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'CHAT':
        return 'bg-pink-100 text-pink-700 border-pink-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          <h3 className="text-base font-bold text-slate-900">
            {t('detailPage.passagesListTitle', { count: passagesList.length })}
          </h3>
        </div>
        <span className="text-xs font-semibold text-slate-500">
          Hỗ trợ bài đọc đơn, kép &amp; ba (Part 7)
        </span>
      </div>

      {passagesList.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          {t('detailPage.noPassagesDesc')}
        </div>
      ) : (
        <div className="space-y-4 text-xs">
          {passagesList.map((p) => {
            const childPassages = p.passages && p.passages.length > 0 ? p.passages : null;
            const passageCount = childPassages ? childPassages.length : 1;
            const clusterBadge =
              passageCount === 1
                ? 'Đoạn đơn'
                : passageCount === 2
                ? 'Đoạn kép (2 văn bản)'
                : `Đoạn ba (${passageCount} văn bản)`;

            const hasPassageImage = Boolean(p.imageUrl || childPassages?.some((cp) => cp.imageUrl));

            return (
              <div
                key={p._id}
                className="p-5 rounded-xl border border-slate-200 hover:border-blue-300 transition-all bg-slate-50/50 space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold text-xs">
                      {p.title || `Passage Group #${p.order}`}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {clusterBadge}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                    {p.audioUrl && (
                      <span className="inline-flex items-center gap-1 text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                        <Volume2 className="h-3 w-3" /> Audio
                      </span>
                    )}
                    {hasPassageImage && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                        <ImageIcon className="h-3 w-3" /> Có ảnh bài đọc
                      </span>
                    )}
                    <span>{p.section}</span>
                  </div>
                </div>

                {/* Multi-passage children view */}
                {childPassages ? (
                  <div className="space-y-2 pt-1">
                    {childPassages.map((cp, idx) => (
                      <div
                        key={cp._id || idx}
                        className="p-3.5 bg-white rounded-lg border border-slate-200/90 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-bold text-slate-800 text-xs">
                            <span
                              className={`px-2 py-0.5 rounded border text-[10px] font-bold flex items-center gap-1 ${getPassageTypeBadge(
                                cp.imageUrl ? 'IMAGE' : cp.type
                              )}`}
                            >
                              {getPassageTypeIcon(cp.imageUrl ? 'IMAGE' : cp.type)}
                              {cp.imageUrl ? 'IMAGE' : cp.type || 'TEXT'}
                            </span>
                            <span>{`${cp.imageUrl ? 'Hình ảnh' : 'Văn bản'} #${idx + 1}`}</span>
                          </div>
                        </div>
                        {cp.imageUrl && (
                          <div className="p-2 border rounded border-slate-200 bg-slate-50/50 flex justify-center max-h-80 overflow-hidden">
                            <img
                              src={cp.imageUrl}
                              alt={`Passage image ${idx + 1}`}
                              className="max-h-72 rounded object-contain"
                            />
                          </div>
                        )}
                        {cp.content && (
                          <p className="text-slate-600 text-xs line-clamp-3 leading-relaxed whitespace-pre-wrap">
                            {cp.content}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {p.imageUrl && (
                      <div className="p-2 border rounded border-slate-200 bg-white flex justify-center max-h-80 overflow-hidden">
                        <img
                          src={p.imageUrl}
                          alt={p.title || 'Passage image'}
                          className="max-h-72 rounded object-contain"
                        />
                      </div>
                    )}
                    {p.content && (
                      <p className="text-slate-600 text-xs bg-white p-3.5 rounded-lg border border-slate-200/90 leading-relaxed line-clamp-4 whitespace-pre-wrap">
                        {p.content}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
