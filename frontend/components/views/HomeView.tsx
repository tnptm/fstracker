"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { formatDay, formatDuration, formatLongDay, formatTime, toDayKey } from "@/lib/format";
import { keys, type Entry, type Stats } from "@/lib/tracker";
import type { User } from "@/lib/api";
import MonthProgress from "../MonthProgress";
import TimerCard from "../TimerCard";
import { Skeleton } from "../ui";

function greeting(hour: number) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomeView() {
  const [now] = useState(() => new Date());
  const { data: user } = useSWR<User>("/api/auth/me");
  const { data: stats } = useSWR<Stats>(keys.stats());
  const { data: recent } = useSWR<Entry[]>(keys.recent(5));

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <p className="muted">{formatLongDay(now)}</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {greeting(now.getHours())}
          {user ? `, ${user.first_name || user.username}` : ""} 👋
        </h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        <TimerCard />
        {stats ? <MonthProgress stats={stats.current} compact /> : <Skeleton className="h-52" />}
      </div>

      <div className="grid grid-cols-3 gap-3 md:gap-6">
        <Tile label="Today" value={stats ? formatDuration(stats.current.today_seconds) : "—"} />
        <Tile label="Entries this month" value={stats ? String(stats.current.entries) : "—"} />
        <Tile label="Courses this month" value={stats ? String(stats.current.courses ?? 0) : "—"} />
      </div>

      <section className="card" aria-labelledby="recent-title">
        <div className="flex items-center justify-between">
          <h2 id="recent-title" className="card-title">Recent activity</h2>
          <Link href="/history" className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-300">
            History →
          </Link>
        </div>
        {!recent ? (
          <Skeleton className="mt-4 h-24" />
        ) : recent.length === 0 ? (
          <p className="muted mt-3">No entries yet. Start the timer or add time manually.</p>
        ) : (
          <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
            {recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.description || "Volunteer work"}</p>
                  <p className="muted">
                    {formatDay(toDayKey(new Date(e.start_time)))} · {formatTime(e.start_time)}
                    {e.end_time ? `–${formatTime(e.end_time)}` : " – now"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-sm font-medium tabular-nums dark:bg-zinc-800">
                  {e.is_running ? "Running" : formatDuration(e.duration_seconds)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight sm:text-2xl">{value}</p>
    </div>
  );
}
