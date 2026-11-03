"use client";

import { useState } from "react";
import useSWR from "swr";
import { formatClock, formatTime } from "@/lib/format";
import { errorMessage, keys, startTimer, stopTimer, updateEntry, type Entry } from "@/lib/tracker";
import { useNow } from "@/lib/useNow";
import { PlayIcon, StopIcon } from "./icons";
import { Skeleton } from "./ui";

/** Start/stop timer with a comment. Shared by Home and Track. */
export default function TimerCard() {
  const { data: entry, isLoading } = useSWR<Entry | null>(keys.current);
  if (isLoading && entry === undefined) return <Skeleton className="h-52" />;
  // Re-key on the entry so the comment field starts from the server value.
  return <Timer key={entry?.id ?? "idle"} entry={entry ?? null} />;
}

function Timer({ entry }: { entry: Entry | null }) {
  const running = entry?.is_running ?? false;
  const now = useNow(1000, running);
  const [description, setDescription] = useState(entry?.description ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  // Save the comment while running when the field loses focus.
  async function saveDescription() {
    if (!entry || description === entry.description) return;
    await run(() => updateEntry(entry.id, { description }));
  }

  const elapsed = entry ? (now - new Date(entry.start_time).getTime()) / 1000 : 0;

  return (
    <section
      aria-label="Timer"
      className={`relative overflow-hidden rounded-3xl p-5 shadow-sm ring-1 transition-colors sm:p-6 ${
        running
          ? "bg-gradient-to-br from-teal-500 to-emerald-600 text-white ring-teal-600/20 dark:from-teal-600 dark:to-emerald-800"
          : "bg-white ring-zinc-900/5 dark:bg-zinc-900 dark:ring-white/10"
      }`}
    >
      {running && (
        <div aria-hidden="true" className="absolute -top-16 -right-16 size-48 rounded-full bg-white/10 blur-2xl" />
      )}
      <div className="relative flex items-center justify-between gap-4">
        <div>
          <p className={`flex items-center gap-2 text-sm font-medium ${running ? "text-teal-50" : "muted"}`}>
            {running && (
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
                <span className="relative inline-flex size-2.5 rounded-full bg-white" />
              </span>
            )}
            {running && entry ? `Running since ${formatTime(entry.start_time)}` : "Not tracking"}
          </p>
          <p
            className={`mt-1 font-mono text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl ${
              running ? "" : "text-zinc-300 dark:text-zinc-700"
            }`}
            role="timer"
            aria-live="off"
          >
            {formatClock(elapsed)}
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => (running ? stopTimer(description) : startTimer(description)))}
          aria-label={running ? "Stop timer" : "Start timer"}
          className={`flex size-16 shrink-0 items-center justify-center rounded-full shadow-lg transition active:scale-95 disabled:opacity-60 sm:size-20 ${
            running
              ? "bg-white text-rose-600 shadow-black/10 hover:bg-rose-50"
              : "bg-teal-600 text-white shadow-teal-600/30 hover:bg-teal-700 dark:bg-teal-500 dark:text-zinc-950 dark:hover:bg-teal-400"
          }`}
        >
          {running ? <StopIcon className="size-7" /> : <PlayIcon className="ml-1 size-7" />}
        </button>
      </div>

      <label className="relative mt-5 block">
        <span className="sr-only">Comment</span>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={running ? saveDescription : undefined}
          maxLength={2000}
          placeholder={running ? "What are you doing?" : "What will you work on? (optional)"}
          className={`min-h-11 w-full rounded-2xl px-3.5 py-2 text-base outline-none transition ${
            running
              ? "bg-white/15 text-white placeholder:text-teal-50/70 focus:bg-white/25 focus:ring-4 focus:ring-white/20"
              : "input"
          }`}
        />
      </label>
      {error && (
        <p role="alert" className={`mt-3 text-sm ${running ? "text-white" : "alert-error"}`}>
          {error}
        </p>
      )}
    </section>
  );
}
