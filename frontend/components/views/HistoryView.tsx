"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  addMonths,
  formatDay,
  formatDuration,
  formatHours,
  formatMonth,
  formatTime,
  toDayKey,
  toMonthKey,
} from "@/lib/format";
import { keys, NOTE_KINDS, type DailyNote, type Entry } from "@/lib/tracker";
import { EntryDialog, NoteDialog } from "../EditDialogs";
import { PencilIcon, PlusIcon } from "../icons";
import { PageHeader, Skeleton, Switcher } from "../ui";

type Day = { key: string; entries: Entry[]; note?: DailyNote; seconds: number };

export default function HistoryView() {
  const [thisMonth] = useState(() => toMonthKey(new Date()));
  const [month, setMonth] = useState(thisMonth);
  const { data: entries, isLoading } = useSWR<Entry[]>(keys.entries(month));
  const { data: notes } = useSWR<DailyNote[]>(keys.notes(month));
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [editNote, setEditNote] = useState<DailyNote | null>(null);

  const days = useMemo(() => {
    const map = new Map<string, Day>();
    const day = (key: string) => {
      if (!map.has(key)) map.set(key, { key, entries: [], seconds: 0 });
      return map.get(key)!;
    };
    for (const e of entries ?? []) {
      const d = day(toDayKey(new Date(e.start_time)));
      d.entries.push(e);
      d.seconds += e.duration_seconds;
    }
    for (const n of notes ?? []) day(n.date).note = n;
    return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
  }, [entries, notes]);

  const total = entries?.reduce((sum, e) => sum + e.duration_seconds, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="History"
        subtitle={entries ? `${formatHours(total)} h · ${entries.length} entries` : " "}
        action={
          <Link href="/track" className="btn btn-secondary hidden sm:inline-flex">
            <PlusIcon className="size-4" /> Add
          </Link>
        }
      />
      <div className="mb-4 flex justify-center sm:justify-start">
        <Switcher
          label={formatMonth(month)}
          onPrev={() => setMonth((m) => addMonths(m, -1))}
          onNext={() => setMonth((m) => addMonths(m, 1))}
          nextDisabled={month >= thisMonth}
          prevLabel="Previous month"
          nextLabel="Next month"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : days.length === 0 ? (
        <div className="card py-12 text-center">
          <p className="font-medium">Nothing recorded in {formatMonth(month)}.</p>
          <Link href="/track" className="btn btn-primary mt-4">
            Track time
          </Link>
        </div>
      ) : (
        <ol className="space-y-3">
          {days.map((d) => (
            <li key={d.key} className="card p-0">
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <h2 className="font-semibold">{formatDay(d.key)}</h2>
                {d.seconds > 0 && (
                  <span className="text-sm font-medium text-zinc-600 tabular-nums dark:text-zinc-400">
                    {formatDuration(d.seconds)}
                  </span>
                )}
              </div>
              {d.note && <NoteRow note={d.note} onEdit={() => setEditNote(d.note!)} />}
              <ul>
                {d.entries
                  .slice()
                  .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  .map((e) => (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setEditEntry(e)}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left transition last:rounded-b-3xl hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800/60"
                        aria-label={`Edit entry ${formatTime(e.start_time)}${e.end_time ? ` to ${formatTime(e.end_time)}` : ", running"}`}
                      >
                        <span
                          className={`h-9 w-1 shrink-0 rounded-full ${e.is_running ? "animate-pulse bg-emerald-500" : "bg-[var(--chart-series)]"}`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium tabular-nums">
                            {formatTime(e.start_time)} – {e.end_time ? formatTime(e.end_time) : "running"}
                          </span>
                          <span className="block truncate text-sm text-zinc-500 dark:text-zinc-400">
                            {e.description || "No comment"}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-medium tabular-nums">
                          {formatDuration(e.duration_seconds)}
                        </span>
                        <PencilIcon className="size-4 shrink-0 text-zinc-400" />
                      </button>
                    </li>
                  ))}
              </ul>
              {d.entries.length === 0 && <div className="h-2" />}
            </li>
          ))}
        </ol>
      )}

      <EntryDialog entry={editEntry} onClose={() => setEditEntry(null)} />
      <NoteDialog note={editNote} onClose={() => setEditNote(null)} />
    </>
  );
}

function NoteRow({ note, onEdit }: { note: DailyNote; onEdit: () => void }) {
  const kind = NOTE_KINDS.find((k) => k.value === note.kind);
  return (
    <button
      type="button"
      onClick={onEdit}
      className="mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-center gap-3 rounded-2xl bg-amber-50 px-3 py-2.5 text-left text-sm transition hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/15"
      aria-label={`Edit note: ${note.kind_label}`}
    >
      <span aria-hidden="true">{kind?.emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="font-medium text-amber-900 dark:text-amber-200">{note.kind_label}</span>
        {note.comment && <span className="block truncate text-amber-800/80 dark:text-amber-200/70">{note.comment}</span>}
      </span>
      <PencilIcon className="size-4 shrink-0 text-amber-700/60 dark:text-amber-300/60" />
    </button>
  );
}
