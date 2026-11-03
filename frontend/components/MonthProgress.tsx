"use client";

import Link from "next/link";
import { formatDuration, formatHours, formatMonth } from "@/lib/format";
import type { CurrentStats } from "@/lib/tracker";
import { CheckCircleIcon, TrendDownIcon, TrendUpIcon } from "./icons";

/** Current month vs goal: hero figure, meter with an "expected by today" tick, pace status. */
export default function MonthProgress({ stats, compact = false }: { stats: CurrentStats; compact?: boolean }) {
  const goalSeconds = stats.goal_hours ? stats.goal_hours * 3600 : null;
  const progress = Math.min(1, stats.progress ?? 0);
  const expected = goalSeconds && stats.expected_seconds !== null ? stats.expected_seconds / goalSeconds : null;

  return (
    <section className="card" aria-labelledby="progress-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="progress-title" className="muted font-medium">
            {formatMonth(stats.month)}
          </h2>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-5xl font-semibold tracking-tight">{formatHours(stats.seconds)}</span>
            <span className="text-lg text-zinc-500 dark:text-zinc-400">
              {goalSeconds ? `/ ${stats.goal_hours} h` : "h"}
            </span>
          </p>
        </div>
        {compact && (
          <Link href="/stats" className="text-sm font-medium text-teal-700 hover:underline dark:text-teal-300">
            Stats →
          </Link>
        )}
      </div>

      {goalSeconds ? (
        <>
          <div
            className="relative mt-4 h-3 rounded-full bg-teal-100 dark:bg-teal-950"
            role="meter"
            aria-label="Progress toward monthly goal"
            aria-valuemin={0}
            aria-valuemax={stats.goal_hours ?? 0}
            aria-valuenow={Math.round(stats.seconds / 360) / 10}
            aria-valuetext={`${formatHours(stats.seconds)} of ${stats.goal_hours} hours`}
          >
            <div
              className="h-full rounded-full bg-[var(--chart-series)] transition-[width] duration-700"
              style={{ width: `${progress * 100}%` }}
            />
            {expected !== null && expected < 1 && (
              <div
                className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-zinc-900 dark:bg-white"
                style={{ left: `${expected * 100}%` }}
                title="Expected by today"
              />
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
            <Pace stats={stats} />
            <span className="text-zinc-500 dark:text-zinc-400">
              {stats.remaining_seconds
                ? `${formatDuration(stats.remaining_seconds)} to go · ${stats.days_left} days left`
                : `${Math.round((stats.progress ?? 0) * 100)} % of goal`}
            </span>
          </div>
          {!compact && expected !== null && expected < 1 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span className="inline-block h-3 w-0.5 rounded-full bg-zinc-900 dark:bg-white" aria-hidden="true" />
              Expected by today if spread evenly ({formatHours(stats.expected_seconds ?? 0)} h)
            </p>
          )}
        </>
      ) : (
        <p className="muted mt-3">
          No goal set for this month.{" "}
          {compact ? (
            <Link href="/stats" className="font-medium text-teal-700 hover:underline dark:text-teal-300">
              Set a goal
            </Link>
          ) : (
            "Set one below."
          )}
        </p>
      )}
    </section>
  );
}

/** Status always pairs an icon and a label with the color. */
function Pace({ stats }: { stats: CurrentStats }) {
  if ((stats.progress ?? 0) >= 1) {
    return (
      <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircleIcon className="size-4" /> Goal reached
      </span>
    );
  }
  const diff = stats.seconds - (stats.expected_seconds ?? 0);
  // Within 30 minutes counts as on track.
  if (diff >= -1800) {
    return (
      <span className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
        <TrendUpIcon className="size-4" /> {diff > 1800 ? `${formatDuration(diff)} ahead` : "On track"}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
      <TrendDownIcon className="size-4" /> {formatDuration(-diff)} behind
    </span>
  );
}
