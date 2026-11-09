"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

/** Account disclosure with native semantics, outside-click dismissal and keyboard navigation. */
export function AccountDropdown({
  name,
  email,
  avatarUrl,
  subtitle,
  label,
  busy,
  children,
}: {
  name: string;
  email?: string;
  avatarUrl?: string;
  subtitle: string;
  label: string;
  busy: boolean;
  children: ReactNode;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [brokenAvatar, setBrokenAvatar] = useState<string | null>(null);
  const showAvatar = !!avatarUrl && brokenAvatar !== avatarUrl;
  const avatar = (size: string) => (
    <span
      aria-hidden="true"
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-blue-50 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-200`}
    >
      {busy ? (
        <Loader2 className="size-4 motion-safe:animate-spin" />
      ) : showAvatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="size-full object-cover"
          onError={() => setBrokenAvatar(avatarUrl ?? null)}
        />
      ) : (
        name[0]?.toUpperCase()
      )}
    </span>
  );
  const close = (restoreFocus = false) => {
    if (root.current) root.current.open = false;
    if (restoreFocus) trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };
    const focus = (event: FocusEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    document.addEventListener("focusin", focus);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("focusin", focus);
    };
  }, [open]);
  return (
    <details
      ref={root}
      className="relative shrink-0"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary
        ref={trigger}
        role="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-disabled={busy}
        onClick={(event) => {
          if (busy) event.preventDefault();
        }}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key) && !busy) {
            event.preventDefault();
            if (root.current) root.current.open = true;
            requestAnimationFrame(() => {
              const items = panel.current?.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              );
              (event.key === "ArrowUp"
                ? items?.[items.length - 1]
                : items?.[0]
              )?.focus();
            });
          }
        }}
        className={`flex h-10 cursor-pointer list-none items-center gap-2.5 rounded-xl border bg-white px-1 text-left outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500 sm:h-11 sm:pl-1.5 sm:pr-3 [&::-webkit-details-marker]:hidden ${open ? "border-blue-200 bg-blue-50/60" : "border-slate-200"}`}
      >
        {avatar("size-8")}
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-36 truncate text-[13px] font-semibold leading-5 text-slate-800">
            {name}
          </span>
          <span className="block max-w-36 truncate text-[11px] leading-4 text-slate-500">
            {subtitle}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`hidden size-3.5 shrink-0 text-slate-400 transition-transform motion-reduce:transition-none sm:block ${open ? "rotate-180" : ""}`}
        />
      </summary>
      <div
        ref={panel}
        role="menu"
        aria-label={label}
        className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-lg"
        onClick={(event) => {
          if (
            (event.target as HTMLElement).closest(
              '[role="menuitem"]:not(:disabled)',
            )
          )
            close(true);
        }}
        onKeyDown={(event) => {
          if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const items = Array.from(
            panel.current?.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ) ?? [],
          );
          const index = items.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? items.length - 1
                : (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    items.length) %
                  items.length;
          items[next]?.focus();
        }}
      >
        <div className="mb-1 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
          {avatar("size-10")}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-5 text-slate-900">
              {name}
            </p>
            <p className="truncate text-xs leading-5 text-slate-500">{email}</p>
          </div>
        </div>
        <div role="separator" className="my-1 h-px bg-slate-100" />
        {children}
      </div>
    </details>
  );
}
