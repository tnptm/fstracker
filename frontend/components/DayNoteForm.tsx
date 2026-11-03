"use client";

import { useRef, useState } from "react";
import { toDayKey } from "@/lib/format";
import { createNote, errorMessage, NOTE_KINDS, type NoteKind } from "@/lib/tracker";

/** A note for a whole day without hours: day off, sick, etc. */
export default function DayNoteForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [today] = useState(() => toDayKey(new Date()));
  const [kind, setKind] = useState<NoteKind>("day_off");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setMessage(null);
    try {
      await createNote({
        date: String(form.get("date")),
        kind,
        comment: String(form.get("comment") ?? ""),
      });
      setMessage({ ok: true, text: "Note saved." });
      formRef.current?.reset();
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card" aria-labelledby="note-title">
      <h2 id="note-title" className="card-title">Day note</h2>
      <p className="muted mt-0.5">Mark a full day off, sick leave or anything else.</p>
      <form ref={formRef} onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <fieldset>
          <legend className="sr-only">Type</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {NOTE_KINDS.map((k) => (
              <label
                key={k.value}
                className={`flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border px-2 text-sm font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal-500 ${
                  kind === k.value
                    ? "border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200"
                    : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k.value}
                  checked={kind === k.value}
                  onChange={() => setKind(k.value)}
                  className="sr-only"
                />
                <span aria-hidden="true">{k.emoji}</span>
                {k.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">
          Date
          <input name="date" type="date" required defaultValue={today} className="input" />
        </label>
        <label className="field">
          Comment
          <textarea name="comment" rows={2} maxLength={2000} placeholder="Optional" className="input resize-none py-2.5" />
        </label>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={message.ok ? "alert-success" : "alert-error"}>
            {message.text}
          </p>
        )}
        <button type="submit" disabled={pending} className="btn btn-secondary">
          {pending ? "Saving…" : "Save note"}
        </button>
      </form>
    </section>
  );
}
