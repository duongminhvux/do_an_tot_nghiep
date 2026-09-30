'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  avatarUrl?: string | null;
  name: string;
  email?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function UserAvatar({
  avatarUrl,
  name,
  email,
  size = 'md',
  className,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const initial = (name || email || 'U').charAt(0).toUpperCase();

  const sizeClasses = {
    sm: 'w-7 h-7 text-[11px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
    xl: 'w-14 h-14 text-xl',
  };

  if (avatarUrl && !imageError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setImageError(true)}
        className={cn(
          'rounded-full object-cover ring-1 ring-slate-200 shrink-0',
          sizeClasses[size],
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shrink-0 shadow-2xs select-none',
        sizeClasses[size],
        className
      )}
    >
      {initial}
    </div>
  );
}
