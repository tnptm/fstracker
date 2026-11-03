"use client";

import { useState } from "react";
import useSWR from "swr";
import { formatHours, formatMonthName, toMonthKey } from "@/lib/format";
import { keys, saveGoal, type Goal, type Stats } from "@/lib/tracker";
import MonthProgress from "../MonthProgress";
import MonthValueCard from "../MonthValueCard";
import MonthlyChart from "../MonthlyChart";
import { PageHeader, Skeleton, Switcher } from "../ui";

export default function StatsView() {
  const [thisMonth] = useState(() => toMonthKey(new Date()));
  const thisYear = Number(thisMonth.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const { data, isValidating } = useSWR<Stats>(keys.stats(year));

  return (
    <>
      <PageHeader title="Stats" subtitle="Your monthly hours and goals." />

      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {data ? <MonthProgress stats={data.current} /> : <Skeleton className="h-52" />}
        <MonthValueCard<Goal>
          title="Monthly goal"
          description="Target hours for a month."
          unit="hours"
          min={1}
          max={744}
          listKey={keys.goals}
          read={(g) => g.hour_goal}
          save={saveGoal}
        />
      </div>

      <section className="card mt-4 md:mt-6" aria-labelledby="year-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="year-title" className="card-title">
            Hours per month
          </h2>
          <Switcher
            label={String(year)}
            onPrev={() => setYear((y) => y - 1)}
            onNext={() => setYear((y) => y + 1)}
            nextDisabled={year >= thisYear}
            prevLabel="Previous year"
            nextLabel="Next year"
          />
        </div>

        {!data ? (
          <Skeleton className="h-64" />
        ) : (
          // Refetch keeps the frame: previous year stays visible, dimmed.
          <div className={`transition-opacity ${isValidating && data.year.year !== year ? "opacity-50" : ""}`}>
            <div className="mb-6 grid grid-cols-3 gap-3">
              <Kpi label="Total hours" value={formatHours(data.year.total_seconds)} />
              <Kpi label="Entries" value={String(data.year.total_entries)} />
              <Kpi label="Courses" value={String(data.year.total_courses)} />
            </div>
            <MonthlyChart months={data.year.months} currentMonth={thisMonth} />
            <YearTable stats={data} currentMonth={thisMonth} />
          </div>
        )}
      </section>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/50">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function YearTable({ stats, currentMonth }: { stats: Stats; currentMonth: string }) {
  const rows = stats.year.months.filter((m) => m.seconds > 0 || m.goal_hours || m.courses || m.day_notes);
  if (rows.length === 0) return <p className="muted mt-6 text-center">No data for {stats.year.year}.</p>;
  return (
    <div className="-mx-5 mt-6 overflow-x-auto px-5">
      <table className="w-full text-sm">
        <caption className="sr-only">Monthly totals for {stats.year.year}</caption>
        <thead>
          <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <th scope="col" className="py-2 pr-3 font-medium">Month</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Hours</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Goal</th>
            <th scope="col" className="py-2 pr-3 text-right font-medium">Of goal</th>
            <th scope="col" className="py-2 text-right font-medium sm:pr-3">Courses</th>
            <th scope="col" className="hidden py-2 text-right font-medium sm:table-cell">Day notes</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((m) => (
            <tr
              key={m.month}
              className={`border-b border-zinc-100 last:border-0 dark:border-zinc-800/60 ${
                m.month === currentMonth ? "font-semibold" : "font-normal"
              }`}
            >
              <th scope="row" className="py-2.5 pr-3 text-left [font-weight:inherit]">{formatMonthName(m.month)}</th>
              <td className="py-2.5 pr-3 text-right">{formatHours(m.seconds)}</td>
              <td className="py-2.5 pr-3 text-right">{m.goal_hours ?? "—"}</td>
              <td className="py-2.5 pr-3 text-right">
                {m.goal_hours ? `${Math.round((m.seconds / 3600 / m.goal_hours) * 100)} %` : "—"}
              </td>
              <td className="py-2.5 text-right sm:pr-3">{m.courses ?? "—"}</td>
              <td className="hidden py-2.5 text-right sm:table-cell">{m.day_notes || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
