"use client";

/**
 * Shared building blocks for learner pages, so every page has the same frame,
 * header, cards and states. Conventions:
 * - Page: <PageShell> (bg, padding, max 1400px) + <PageHeader>.
 * - Surfaces: rounded-xl, border-slate-200, shadow-sm, white (`surface`).
 * - Primary colour: blue-600 (`bg-primary`); module colours only tint icons.
 * - Titles: h1 text-2xl/3xl bold, panel titles text-base semibold.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, ArrowLeft, ChevronRight, Inbox, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const surface = "min-w-0 rounded-xl border border-slate-200 bg-white shadow-sm";

const widths = {
  narrow: "max-w-4xl",
  default: "max-w-[1400px]",
} as const;

export function PageShell({
  children,
  width = "default",
  className,
}: {
  children: ReactNode;
  width?: keyof typeof widths;
  className?: string;
}) {
  return (
    <div className="min-h-full min-w-0 w-full bg-background px-3 py-4 sm:py-6 sm:px-6 lg:px-8">
      <div className={cn("mx-auto min-w-0 w-full space-y-6", widths[width], className)}>
        {children}
      </div>
    </div>
  );
}

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  back,
  breadcrumbs,
  actions,
  icon: Icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Small coloured label above the title. */
  eyebrow?: ReactNode;
  /** A single "back" link (detail pages). */
  back?: { href: string; label: string };
  /** A trail for nested browsing pages; use instead of `back`. */
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <header className="space-y-3">
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-slate-500">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300" />}
              {crumb.href ? (
                <Link href={crumb.href} className="transition-colors hover:text-blue-600">
                  {crumb.label}
                </Link>
              ) : (
                <span className="max-w-[260px] truncate font-medium text-slate-700">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Icon className="h-6 w-6" />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-600">{eyebrow}</p>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
            {description && <p className="mt-1.5 max-w-3xl text-sm text-slate-500">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
      </div>
    </header>
  );
}

export function Card({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(surface, className)} {...props}>
      {children}
    </div>
  );
}

/** A titled card section. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn(surface, "p-4 sm:p-6", className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export const tones = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
  orange: "bg-orange-50 text-orange-600",
  amber: "bg-amber-50 text-amber-600",
  pink: "bg-pink-50 text-pink-600",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-600",
} as const;
export type Tone = keyof typeof tones;

export function StatCard({
  icon: Icon,
  tone = "blue",
  label,
  value,
  hint,
  className,
}: {
  icon?: LucideIcon;
  tone?: Tone;
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(surface, "flex items-start gap-4 p-5", className)}>
      {Icon && (
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
      </div>
    </div>
  );
}

const badgeTones = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  orange: "bg-orange-50 text-orange-700 ring-orange-100",
  red: "bg-red-50 text-red-700 ring-red-100",
  violet: "bg-violet-50 text-violet-700 ring-violet-100",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
} as const;

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTones;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Underline tabs for switching views inside a page. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  items: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("flex gap-1 overflow-x-auto border-b border-slate-200 scrollbar-none", className)}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            "-mb-px cursor-pointer whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
            value === item.value
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

/** Pill toggle for 2–4 options (filters, chart modes). */
export function Segmented<T extends string | number>({
  items,
  value,
  onChange,
  className,
}: {
  items: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-lg bg-slate-100 p-1", className)}>
      {items.map((item) => (
        <button
          key={String(item.value)}
          type="button"
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            "cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
            value === item.value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function LoadingState({ label, className }: { label?: ReactNode; className?: string }) {
  return (
    <div
      role="status"
      className={cn("flex min-h-[220px] items-center justify-center gap-2.5 text-sm text-slate-500", className)}
    >
      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
      {label}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = "Thử lại",
  className,
}: {
  message: ReactNode;
  onRetry?: () => void;
  retryLabel?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
        className,
      )}
    >
      <AlertCircle className="h-5 w-5 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
