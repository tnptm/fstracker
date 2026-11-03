"use client";

import { useRef, useState } from "react";
import { formatDuration, toDayKey } from "@/lib/format";
import { createEntry, errorMessage } from "@/lib/tracker";

/** Add a finished entry afterwards. An end time before the start means it ended the next day. */
export default function ManualEntryForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [today] = useState(() => toDayKey(new Date()));
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const overnight = start !== "" && end !== "" && end <= start;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const date = String(form.get("date"));
    const startAt = new Date(`${date}T${start}`);
    const endAt = new Date(`${date}T${end}`);
    if (overnight) endAt.setDate(endAt.getDate() + 1);

    setPending(true);
    setMessage(null);
    try {
      const entry = await createEntry({
        start_time: startAt.toISOString(),
        end_time: endAt.toISOString(),
        description: String(form.get("description") ?? ""),
      });
      setMessage({ ok: true, text: `Saved ${formatDuration(entry.duration_seconds)}.` });
      formRef.current?.reset();
      setStart("");
      setEnd("");
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card" aria-labelledby="manual-title">
      <h2 id="manual-title" className="card-title">Add time manually</h2>
      <p className="muted mt-0.5">Forgot the timer? Add a finished session.</p>
      <form ref={formRef} onSubmit={onSubmit} className="mt-4 grid grid-cols-2 gap-3">
        <label className="field col-span-2">
          Date
          <input name="date" type="date" required defaultValue={today} max={today} className="input" />
        </label>
        <label className="field">
          Start
          <input type="time" required value={start} onChange={(e) => setStart(e.target.value)} className="input" />
        </label>
        <label className="field">
          End
          <input type="time" required value={end} onChange={(e) => setEnd(e.target.value)} className="input" />
        </label>
        {overnight && (
          <p className="col-span-2 -mt-1 text-xs text-zinc-500 dark:text-zinc-400">Ends the next day.</p>
        )}
        <label className="field col-span-2">
          Comment
          <input name="description" maxLength={2000} placeholder="Optional" className="input" />
        </label>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`col-span-2 ${message.ok ? "alert-success" : "alert-error"}`}>
            {message.text}
          </p>
        )}
        <button type="submit" disabled={pending} className="btn btn-primary col-span-2">
          {pending ? "Saving…" : "Add entry"}
        </button>
      </form>
    </section>
  );
}
