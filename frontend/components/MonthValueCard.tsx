"use client";

import { useState } from "react";
import useSWR from "swr";
import { addMonths, formatMonth, toMonthKey } from "@/lib/format";
import { errorMessage } from "@/lib/tracker";
import { MinusIcon, PlusIcon } from "./icons";
import { Switcher } from "./ui";

type Props<T> = {
  title: string;
  description: string;
  unit: string;
  min: number;
  max: number;
  /** SWR key listing the year's values. */
  listKey: (year: number) => string;
  read: (item: T) => number;
  save: (month: string, value: number) => Promise<unknown>;
};

/** Edit one number per month (courses held, hour goal) with a stepper. */
export default function MonthValueCard<T extends { month: string }>(props: Props<T>) {
  const [month, setMonth] = useState(() => toMonthKey(new Date()));
  const year = Number(month.slice(0, 4));
  const { data, isLoading } = useSWR<T[]>(props.listKey(year));
  const saved = data?.find((item) => item.month === month);
  const savedValue = saved ? props.read(saved) : null;

  return (
    <section className="card" aria-label={props.title}>
      <h2 className="card-title">{props.title}</h2>
      <p className="muted mt-0.5">{props.description}</p>
      {/* A custom switcher: <input type="month"> is missing in Firefox. */}
      <div className="mt-4 flex justify-center">
        <Switcher
          label={formatMonth(month)}
          onPrev={() => setMonth((m) => addMonths(m, -1))}
          onNext={() => setMonth((m) => addMonths(m, 1))}
          prevLabel="Previous month"
          nextLabel="Next month"
        />
      </div>
      {/* Re-key per month (and once loaded) so the stepper starts from the saved value. */}
      <Stepper
        key={`${month}:${isLoading ? "loading" : "ready"}`}
        {...props}
        month={month}
        savedValue={savedValue}
        loading={isLoading}
      />
    </section>
  );
}

function Stepper<T>({
  month,
  savedValue,
  loading,
  unit,
  min,
  max,
  save,
}: Props<T> & { month: string; savedValue: number | null; loading: boolean }) {
  const [value, setValue] = useState(savedValue ?? min);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = value !== savedValue;
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n || 0)));

  async function onSave() {
    setPending(true);
    setMessage(null);
    try {
      await save(month, value);
      setMessage({ ok: true, text: `Saved for ${formatMonth(month)}.` });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-secondary size-12 rounded-full p-0" onClick={() => setValue((v) => clamp(v - 1))} aria-label={`Decrease ${unit}`}>
          <MinusIcon />
        </button>
        <label className="flex flex-1 flex-col items-center">
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            value={value}
            disabled={loading}
            onChange={(e) => setValue(clamp(Number(e.target.value)))}
            className="w-24 bg-transparent text-center text-4xl font-semibold tabular-nums outline-none [appearance:textfield] focus:text-teal-700 dark:focus:text-teal-300 [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="muted">{unit}</span>
        </label>
        <button type="button" className="btn btn-secondary size-12 rounded-full p-0" onClick={() => setValue((v) => clamp(v + 1))} aria-label={`Increase ${unit}`}>
          <PlusIcon />
        </button>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`mt-3 ${message.ok ? "alert-success" : "alert-error"}`}>
          {message.text}
        </p>
      )}
      <button type="button" disabled={pending || loading || !dirty} onClick={onSave} className="btn btn-primary mt-4 w-full">
        {pending ? "Saving…" : savedValue === null ? "Save" : dirty ? "Update" : "Saved"}
      </button>
    </div>
  );
}
