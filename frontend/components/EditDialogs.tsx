"use client";

import { useState } from "react";
import { formatDuration, fromDateTimeValue, toDateTimeValue } from "@/lib/format";
import {
  deleteEntry,
  deleteNote,
  errorMessage,
  NOTE_KINDS,
  updateEntry,
  updateNote,
  type DailyNote,
  type Entry,
  type NoteKind,
} from "@/lib/tracker";
import { Modal } from "./ui";

function useSubmit(onDone: () => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(action: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }
  return { pending, error, submit };
}

function DialogActions({ pending, onDelete }: { pending: boolean; onDelete: () => void }) {
  return (
    <div className="mt-2 flex gap-3">
      <button type="button" className="btn btn-ghost text-rose-600 dark:text-rose-400" disabled={pending} onClick={onDelete}>
        Delete
      </button>
      <button type="submit" className="btn btn-primary flex-1" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

export function EntryDialog({ entry, onClose }: { entry: Entry | null; onClose: () => void }) {
  return (
    <Modal open={entry !== null} onClose={onClose} title="Edit entry">
      {entry && <EntryForm key={entry.id} entry={entry} onClose={onClose} />}
    </Modal>
  );
}

function EntryForm({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const [start, setStart] = useState(toDateTimeValue(entry.start_time));
  const [end, setEnd] = useState(entry.end_time ? toDateTimeValue(entry.end_time) : "");
  const [description, setDescription] = useState(entry.description);
  const { pending, error, submit } = useSubmit(onClose);

  const seconds = start && end ? (new Date(end).getTime() - new Date(start).getTime()) / 1000 : null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(() =>
      updateEntry(entry.id, {
        start_time: fromDateTimeValue(start),
        // A running entry may stay running (empty end).
        end_time: end ? fromDateTimeValue(end) : entry.is_running ? null : undefined,
        description,
      }),
    );
  }

  function onDelete() {
    if (window.confirm("Delete this entry?")) submit(() => deleteEntry(entry.id));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="field">
        Start
        <input type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} className="input" />
      </label>
      <label className="field">
        End
        <input
          type="datetime-local"
          required={!entry.is_running}
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="input"
        />
        {entry.is_running && !end && <span className="text-xs font-normal text-zinc-500">Still running</span>}
      </label>
      {seconds !== null && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Duration: <strong className="text-zinc-900 dark:text-white">{seconds > 0 ? formatDuration(seconds) : "—"}</strong>
        </p>
      )}
      <label className="field">
        Comment
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} className="input resize-none py-2.5" />
      </label>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <DialogActions pending={pending} onDelete={onDelete} />
    </form>
  );
}

export function NoteDialog({ note, onClose }: { note: DailyNote | null; onClose: () => void }) {
  return (
    <Modal open={note !== null} onClose={onClose} title="Edit day note">
      {note && <NoteForm key={note.id} note={note} onClose={onClose} />}
    </Modal>
  );
}

function NoteForm({ note, onClose }: { note: DailyNote; onClose: () => void }) {
  const [date, setDate] = useState(note.date);
  const [kind, setKind] = useState<NoteKind>(note.kind);
  const [comment, setComment] = useState(note.comment);
  const { pending, error, submit } = useSubmit(onClose);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(() => updateNote(note.id, { date, kind, comment }));
  }

  function onDelete() {
    if (window.confirm("Delete this note?")) submit(() => deleteNote(note.id));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="field">
        Type
        <select value={kind} onChange={(e) => setKind(e.target.value as NoteKind)} className="input">
          {NOTE_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.emoji} {k.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Date
        <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="input" />
      </label>
      <label className="field">
        Comment
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} maxLength={2000} className="input resize-none py-2.5" />
      </label>
      {error && <p role="alert" className="alert-error">{error}</p>}
      <DialogActions pending={pending} onDelete={onDelete} />
    </form>
  );
}
