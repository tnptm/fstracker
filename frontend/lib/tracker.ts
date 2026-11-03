"use client";

// Typed client for the tracker API (backend/tracker). SWR keys are the API paths.
import { mutate } from "swr";
import { ApiError, apiFetch } from "./api";

export type Entry = {
  id: number;
  start_time: string;
  end_time: string | null;
  description: string;
  duration_seconds: number;
  is_running: boolean;
};

export type NoteKind = "day_off" | "sick" | "vacation" | "other";

export const NOTE_KINDS: { value: NoteKind; label: string; emoji: string }[] = [
  { value: "day_off", label: "Day off", emoji: "🌿" },
  { value: "sick", label: "Sick", emoji: "🤒" },
  { value: "vacation", label: "Vacation", emoji: "🏖️" },
  { value: "other", label: "Other", emoji: "📝" },
];

export type DailyNote = {
  id: number;
  date: string;
  kind: NoteKind;
  kind_label: string;
  comment: string;
};

export type MonthValue = { id: number; month: string; comments: string };
export type Goal = MonthValue & { hour_goal: number };
export type Courses = MonthValue & { course_number: number };

export type MonthStats = {
  month: string;
  seconds: number;
  entries: number;
  goal_hours: number | null;
  courses: number | null;
  day_notes: number;
};

export type CurrentStats = {
  month: string;
  seconds: number;
  today_seconds: number;
  entries: number;
  goal_hours: number | null;
  expected_seconds: number | null;
  remaining_seconds: number | null;
  progress: number | null;
  days_left: number;
  days_in_month: number;
  courses: number | null;
  day_notes: number;
};

export type Stats = {
  current: CurrentStats;
  year: {
    year: number;
    months: MonthStats[];
    total_seconds: number;
    total_entries: number;
    total_courses: number;
  };
};

export const keys = {
  current: "/api/entries/current",
  entries: (month: string) => `/api/entries?month=${month}`,
  recent: (limit: number) => `/api/entries?limit=${limit}`,
  notes: (month: string) => `/api/daily-comments?month=${month}`,
  goals: (year: number) => `/api/goals?year=${year}`,
  courses: (year: number) => `/api/courses?year=${year}`,
  stats: (year?: number) => (year ? `/api/stats?year=${year}` : "/api/stats"),
};

/** Revalidate all tracker data after a change (entries affect stats, etc.). */
export function refreshTrackerData() {
  return mutate(
    (key) => typeof key === "string" && key.startsWith("/api/") && !key.startsWith("/api/auth/"),
  );
}

const send = <T>(path: string, method: string, body?: unknown) =>
  apiFetch<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

async function andRefresh<T>(promise: Promise<T>): Promise<T> {
  const result = await promise;
  await refreshTrackerData();
  return result;
}

export const startTimer = (description: string) =>
  andRefresh(send<Entry>("/api/entries/start", "POST", { description }));
export const stopTimer = (description: string) =>
  andRefresh(send<Entry>("/api/entries/stop", "POST", { description }));

export type EntryInput = { start_time: string; end_time: string | null; description: string };
export const createEntry = (data: EntryInput) => andRefresh(send<Entry>("/api/entries", "POST", data));
export const updateEntry = (id: number, data: Partial<EntryInput>) =>
  andRefresh(send<Entry>(`/api/entries/${id}`, "PATCH", data));
export const deleteEntry = (id: number) => andRefresh(send<null>(`/api/entries/${id}`, "DELETE"));

export type NoteInput = { date: string; kind: NoteKind; comment: string };
export const createNote = (data: NoteInput) =>
  andRefresh(send<DailyNote>("/api/daily-comments", "POST", data));
export const updateNote = (id: number, data: NoteInput) =>
  andRefresh(send<DailyNote>(`/api/daily-comments/${id}`, "PATCH", data));
export const deleteNote = (id: number) =>
  andRefresh(send<null>(`/api/daily-comments/${id}`, "DELETE"));

export const saveGoal = (month: string, hour_goal: number) =>
  andRefresh(send<Goal>(`/api/goals/${month}`, "PUT", { hour_goal }));
export const saveCourses = (month: string, course_number: number) =>
  andRefresh(send<Courses>(`/api/courses/${month}`, "PUT", { course_number }));

/** Human-readable message from a DRF error response. */
export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!(err instanceof ApiError)) return fallback;
  if (err.status === 429) return "Too many requests. Please wait a moment.";
  const data = err.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") {
    const messages = Object.values(data as Record<string, unknown>).flat().map(String);
    if (messages.length) return messages.join(" ");
  }
  return fallback;
}
