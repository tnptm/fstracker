"use client";

import { useState } from "react";
import { formatHours, formatMonth, formatShortMonth } from "@/lib/format";
import type { MonthStats } from "@/lib/tracker";

/** Round axis: smallest "nice" step giving at most 4 intervals. */
function niceScale(max: number) {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500];
  const step = steps.find((s) => max / s <= 4) ?? Math.ceil(max / 4);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  return { top, ticks };
}

/**
 * Hours per month (single series, columns) with the monthly goal as a tick.
 * Each column is a focusable hit target with a tooltip; the table on the
 * Stats page carries every value without hovering.
 */
export default function MonthlyChart({ months, currentMonth }: { months: MonthStats[]; currentMonth: string }) {
  const [active, setActive] = useState<number | null>(null);
  const hours = months.map((m) => m.seconds / 3600);
  const { top, ticks } = niceScale(Math.max(1, ...hours, ...months.map((m) => m.goal_hours ?? 0)));
  const pct = (v: number) => `${(v / top) * 100}%`;
  const hasGoals = months.some((m) => m.goal_hours);
  const activeMonth = active !== null ? months[active] : null;

  return (
    <figure className="select-none">
      <figcaption className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[3px] bg-[var(--chart-series)]" aria-hidden="true" />
          Hours
        </span>
        {hasGoals && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3.5 rounded-full bg-[var(--chart-goal)]" aria-hidden="true" />
            Goal
          </span>
        )}
      </figcaption>

      <div className="relative h-56 pl-8 sm:h-64">
        {/* Gridlines + y ticks */}
        {ticks.map((t) => (
          <div key={t} className="absolute right-0 left-8 border-t border-[var(--chart-grid)]" style={{ bottom: pct(t) }}>
            <span className="absolute -top-2 -left-8 w-6 text-right text-[11px] text-zinc-500 tabular-nums dark:text-zinc-400">
              {t}
            </span>
          </div>
        ))}

        <div className="absolute inset-y-0 right-0 left-8 grid grid-cols-12" onPointerLeave={() => setActive(null)}>
          {months.map((m, i) => {
            const h = hours[i];
            const isCurrent = m.month === currentMonth;
            return (
              <button
                key={m.month}
                type="button"
                className="group relative h-full rounded-lg outline-none focus-visible:bg-zinc-500/10"
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(i)}
                aria-label={`${formatMonth(m.month)}: ${formatHours(m.seconds)} hours${
                  m.goal_hours ? `, goal ${m.goal_hours} hours` : ""
                }`}
              >
                {h > 0 && (
                  <span
                    className={`absolute bottom-0 left-1/2 w-[min(24px,62%)] -translate-x-1/2 rounded-t-[4px] bg-[var(--chart-series)] transition-[filter,height] duration-500 ${
                      active === i ? "brightness-110" : ""
                    }`}
                    style={{ height: pct(h) }}
                  />
                )}
                {m.goal_hours ? (
                  <span
                    className="absolute left-1/2 h-0.5 w-[min(34px,82%)] -translate-x-1/2 rounded-full bg-[var(--chart-goal)]"
                    style={{ bottom: pct(m.goal_hours) }}
                  />
                ) : null}
                {/* Selective direct label: current month only. */}
                {isCurrent && h > 0 && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 pb-1 text-[11px] font-semibold text-zinc-900 tabular-nums dark:text-white"
                    style={{ bottom: pct(h) }}
                  >
                    {formatHours(m.seconds)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeMonth && active !== null && (
          <div
            role="status"
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-xl bg-zinc-900 px-3 py-2 text-xs whitespace-nowrap text-zinc-300 shadow-lg dark:bg-zinc-100 dark:text-zinc-600"
            style={{
              // Keep the tooltip inside the plot near the edges.
              left: `calc(2rem + (100% - 2rem) * ${Math.min(0.88, Math.max(0.12, (active + 0.5) / 12))})`,
            }}
          >
            <p className="text-sm font-semibold text-white dark:text-zinc-900">{formatHours(activeMonth.seconds)} h</p>
            <p>{formatMonth(activeMonth.month)}</p>
            {activeMonth.goal_hours ? (
              <p>
                Goal {activeMonth.goal_hours} h · {Math.round((activeMonth.seconds / 3600 / activeMonth.goal_hours) * 100)} %
              </p>
            ) : null}
          </div>
        )}
      </div>

      <div className="mt-2 grid grid-cols-12 pl-8" aria-hidden="true">
        {months.map((m) => (
          <span
            key={m.month}
            className={`text-center text-[11px] ${
              m.month === currentMonth ? "font-semibold text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            <span className="sm:hidden">{formatShortMonth(m.month).charAt(0)}</span>
            <span className="hidden sm:inline">{formatShortMonth(m.month)}</span>
          </span>
        ))}
      </div>
    </figure>
  );
}
