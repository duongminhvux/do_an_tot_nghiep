'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { UserAvatar } from '@/components/users/user-avatar';
import type { NewUserItem } from './dashboard-data';

interface NewUsersCardProps {
  locale: string;
  users: NewUserItem[];
  loading?: boolean;
  formatMinutes: (minutes: number) => string;
}

export function NewUsersCard({
  locale,
  users,
  loading,
  formatMinutes,
}: NewUsersCardProps) {
  const { t } = useTranslation('dashboard');

  return (
    <div className="flex h-full flex-col rounded border border-blue-100/80 bg-white p-3.5 shadow-[0_5px_18px_-14px_rgba(37,99,235,0.45)]">
      <h2 className="text-[15px] font-bold text-blue-950">
        {t('newUsers.title')}
      </h2>

      {loading ? (
        <div className="mt-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-7 w-7 shrink-0 rounded-full bg-slate-100" />
              <div className="flex-1 space-y-1.5">
                <div
                  className="h-3.5 rounded bg-slate-100"
                  style={{ width: `${60 - i * 6}%` }}
                />
                <div
                  className="h-3 rounded bg-slate-50"
                  style={{ width: `${30 - i * 3}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="mt-6 text-center text-sm text-slate-400">
          {t('empty')}
        </p>
      ) : (
        <ul className="mt-4 flex-1 divide-y divide-slate-100">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex items-center gap-3 py-3 first:pt-1 last:pb-1"
            >
              <UserAvatar name={user.name} email={user.email} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  {user.name}
                </p>
              </div>
              <span className="shrink-0 text-xs text-slate-400">
                {formatMinutes(user.minutesAgo)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-slate-100 pt-4">
        <Link
          href={`/${locale}/users`}
          className="inline-flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
        >
          {t('newUsers.viewAll')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
