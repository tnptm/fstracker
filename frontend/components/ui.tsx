"use client";

import { useEffect, useRef } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "./icons";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 md:mb-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className = "h-32" }: { className?: string }) {
  return <div className={`animate-pulse rounded-3xl bg-zinc-200/70 dark:bg-zinc-800/70 ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-44" />
      <Skeleton className="h-64" />
    </div>
  );
}

/** ‹ November 2026 › */
export function Switcher({
  label,
  onPrev,
  onNext,
  nextDisabled,
  prevLabel,
  nextLabel,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
  prevLabel: string;
  nextLabel: string;
}) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-zinc-900/5 dark:bg-zinc-900 dark:ring-white/10">
      <button type="button" className="icon-btn size-9" onClick={onPrev} aria-label={prevLabel}>
        <ChevronLeftIcon />
      </button>
      <span className="min-w-32 text-center text-sm font-semibold" aria-live="polite">
        {label}
      </span>
      <button
        type="button"
        className="icon-btn size-9 disabled:opacity-30"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={nextLabel}
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}

/**
 * Native <dialog> modal: a bottom sheet on phones, centered card on larger screens.
 * Gets focus trapping, Esc-to-close and the inert background from the browser.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()} // backdrop click
      aria-labelledby="modal-title"
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-3xl bg-white p-0 text-zinc-900 shadow-2xl backdrop:bg-zinc-950/40 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-md sm:rounded-3xl dark:bg-zinc-900 dark:text-zinc-100"
    >
      {open && (
        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-6">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-300 sm:hidden dark:bg-zinc-700" />
          <div className="mb-4 flex items-center justify-between">
            <h2 id="modal-title" className="text-lg font-semibold">
              {title}
            </h2>
            <button type="button" className="icon-btn -mr-2" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
