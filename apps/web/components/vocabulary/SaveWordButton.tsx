'use client';

import React from 'react';
import { Bookmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { savedWordsService } from '@/services/saved-words.service';

export interface SaveWordButtonProps {
  /**
   * Word ID to manage save state automatically.
   */
  wordId?: string;

  /**
   * Word text/spelling for notifications and activity logs.
   */
  wordText?: string;

  /**
   * Controlled saved state. If provided, takes precedence over internal state.
   */
  isSaved?: boolean;

  /**
   * Callback fired when clicked. In controlled mode, you should toggle state here.
   */
  onToggle?: () => void;

  /**
   * Visual style variant.
   * - 'pill': Standard bordered button with icon and label (used in SrsRatingBar).
   * - 'icon-only': Square or circular icon button (great for card headers or list rows).
   * - 'ghost': Clean borderless button with icon and optional label.
   */
  variant?: 'pill' | 'icon-only' | 'ghost';

  /**
   * Button size.
   */
  size?: 'sm' | 'md' | 'lg';

  /**
   * Force show/hide text label. Defaults to true for 'pill', false for 'icon-only'.
   */
  showLabel?: boolean;

  /**
   * Optional keyboard shortcut key (e.g. 'S') displayed in tooltip.
   */
  shortcutKey?: string;

  /**
   * Additional custom CSS classes.
   */
  className?: string;

  /**
   * Disabled state.
   */
  disabled?: boolean;
}

export function SaveWordButton({
  wordId,
  wordText,
  isSaved: controlledIsSaved,
  onToggle,
  variant = 'pill',
  size = 'sm',
  showLabel,
  shortcutKey,
  className = '',
  disabled = false,
}: SaveWordButtonProps) {
  const { t } = useTranslation('vocabulary');
  const queryClient = useQueryClient();

  // Autonomous mode: Query saved word IDs list if wordId is provided and controlledIsSaved is undefined
  const isAutonomous = controlledIsSaved === undefined && Boolean(wordId);

  const { data: savedIdsRes } = useQuery({
    queryKey: ['saved-word-ids'],
    queryFn: () => savedWordsService.getSavedIds(),
    enabled: isAutonomous,
    staleTime: 60 * 1000,
  });

  const autonomousIsSaved = Boolean(
    wordId && Array.isArray(savedIdsRes?.data) && savedIdsRes.data.includes(wordId)
  );

  const isSaved = controlledIsSaved !== undefined ? controlledIsSaved : autonomousIsSaved;

  const toggleMutation = useMutation({
    mutationFn: (id: string) => savedWordsService.toggle(id, wordText),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-word-ids'] });
      queryClient.invalidateQueries({ queryKey: ['saved-words'] });
      queryClient.invalidateQueries({ queryKey: ['saved-words-stats'] });
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    if (onToggle) {
      onToggle();
    } else if (wordId && isAutonomous) {
      toggleMutation.mutate(wordId);
    }
  };

  const keyLabel = t('srs.shortcut_key', 'Phím');
  const actionLabel = isSaved ? t('srs.saved', 'Đã lưu') : t('srs.save', 'Lưu');
  const tooltip = shortcutKey
    ? `${actionLabel} (${keyLabel} ${shortcutKey})`
    : actionLabel;

  const shouldRenderLabel =
    showLabel !== undefined ? showLabel : variant !== 'icon-only';

  // Size configurations
  const sizeConfig = {
    sm: {
      pill: 'px-3 py-0.5 text-xs gap-1.5',
      icon: 'p-1.5',
      iconSize: 'w-3.5 h-3.5',
    },
    md: {
      pill: 'px-3.5 py-1 text-xs gap-1.5 font-semibold',
      icon: 'p-2',
      iconSize: 'w-4 h-4',
    },
    lg: {
      pill: 'px-4 py-1.5 text-sm gap-2 font-bold',
      icon: 'p-2.5',
      iconSize: 'w-5 h-5',
    },
  }[size];

  // Variant styles
  let variantStyle = '';
  if (variant === 'pill') {
    variantStyle = isSaved
      ? 'bg-sky-100 text-sky-700 border-sky-300 shadow-2xs font-semibold'
      : 'bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-700 border-slate-200 hover:border-sky-200 font-semibold';
  } else if (variant === 'icon-only') {
    variantStyle = isSaved
      ? 'text-sky-600 hover:text-rose-600 hover:bg-rose-50'
      : 'text-slate-400 hover:text-sky-600 hover:bg-slate-100';
  } else if (variant === 'ghost') {
    variantStyle = isSaved
      ? 'text-sky-600 hover:bg-sky-50'
      : 'text-slate-500 hover:text-sky-600 hover:bg-slate-50';
  }

  const iconColor = isSaved ? 'fill-sky-500 text-sky-500' : 'text-slate-400';

  return (
    <button
      type="button"
      disabled={disabled || toggleMutation.isPending}
      onClick={handleClick}
      title={tooltip}
      className={`inline-flex items-center justify-center rounded-lg transition-all cursor-pointer border select-none disabled:opacity-50 disabled:pointer-events-none ${
        variant === 'icon-only' ? sizeConfig.icon : sizeConfig.pill
      } ${
        variant === 'icon-only' || variant === 'ghost' ? 'border-transparent' : ''
      } ${variantStyle} ${className}`}
    >
      <Bookmark
        className={`${sizeConfig.iconSize} transition-colors ${iconColor} ${
          toggleMutation.isPending ? 'animate-pulse' : ''
        }`}
      />
      {shouldRenderLabel && <span>{actionLabel}</span>}
    </button>
  );
}

export default SaveWordButton;
