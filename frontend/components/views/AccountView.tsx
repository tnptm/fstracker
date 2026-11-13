"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import {
  ApiError,
  deleteAccount,
  exportMyData,
  removeEmail,
  type User,
} from "@/lib/api";
import { useResetOnHide } from "@/lib/useResetOnHide";
import { Modal, PageHeader, Skeleton } from "../ui";

type FieldErrors = Record<string, string[]>;

function toErrors(err: unknown, fallback: string): FieldErrors {
  if (err instanceof ApiError && err.data && typeof err.data === "object") {
    const out: FieldErrors = {};
    for (const [key, value] of Object.entries(err.data)) {
      const k = key === "non_field_errors" || key === "detail" ? "form" : key;
      out[k] = Array.isArray(value) ? value.map(String) : [String(value)];
    }
    return out;
  }
  return { form: [fallback] };
}

function FieldMessages({ errors, name }: { errors: FieldErrors; name: string }) {
  return errors[name]?.map((msg) => (
    <span key={msg} className="text-xs font-normal text-rose-600 dark:text-rose-400">
      {msg}
    </span>
  )) ?? null;
}

function ProfileCard({ user }: { user: User }) {
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useResetOnHide(() => {
    setCopied(false);
    setPending(false);
    setError(null);
  });

  async function copyUsername() {
    try {
      await navigator.clipboard.writeText(user.username);
      setCopied(true);
    } catch {
      setCopied(false); // selectable on screen, copy by hand
    }
  }

  async function onRemoveEmail() {
    setPending(true);
    setError(null);
    try {
      await mutate("/api/auth/me", await removeEmail(), { revalidate: false });
    } catch {
      setError("Could not remove the email. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">Your account</h2>
      <p className="muted mt-1">
        Your username is a random code, so the account does not reveal who you are. Log in with it
        and your password. If you lose either, the account cannot be recovered.
      </p>
      <p className="mt-4 rounded-2xl bg-zinc-100 px-4 py-3 text-center font-mono text-lg font-semibold tracking-wider break-all select-all dark:bg-zinc-800">
        {user.username}
      </p>
      <button type="button" onClick={copyUsername} className="btn btn-secondary mt-3 w-full">
        {copied ? "Copied" : "Copy username"}
      </button>
      {user.email && (
        <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="muted">
            An email address from an earlier sign-up is still stored on this account. It is not
            used for anything and you can remove it.
          </p>
          {error && (
            <p role="alert" className="alert-error mt-3">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={onRemoveEmail}
            disabled={pending}
            className="btn btn-secondary mt-3"
          >
            {pending ? "Removing…" : "Remove stored email"}
          </button>
        </div>
      )}
    </section>
  );
}

function ExportCard() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useResetOnHide(() => {
    setPending(false);
    setError(null);
  });

  async function onExport() {
    setPending(true);
    setError(null);
    try {
      const data = await exportMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fstracker-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not download your data. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">Your data</h2>
      <p className="muted mt-1">
        Download everything stored about you (account details, entries, day notes, goals and
        courses) as a JSON file.
      </p>
      {error && (
        <p role="alert" className="alert-error mt-3">
          {error}
        </p>
      )}
      <button type="button" onClick={onExport} disabled={pending} className="btn btn-secondary mt-4">
        {pending ? "Preparing…" : "Download my data"}
      </button>
    </section>
  );
}

function DeleteCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  useResetOnHide(() => {
    setOpen(false);
    setErrors({});
    setPending(false);
  });

  async function onDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    setPending(true);
    setErrors({});
    try {
      await deleteAccount(password);
      // Drop every cached response, then leave: the server already cleared the cookies.
      await mutate(() => true, undefined, { revalidate: false });
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setErrors(toErrors(err, "Could not delete your account. Please try again."));
      setPending(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">Delete account</h2>
      <p className="muted mt-1">
        Permanently deletes your account and all of your entries, day notes, goals and courses.
        This cannot be undone. You may want to download your data first.
      </p>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-danger mt-4">
        Delete my account
      </button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setErrors({});
        }}
        title="Delete your account?"
      >
        <form onSubmit={onDelete} className="flex flex-col gap-4">
          <p className="muted">
            Everything will be erased immediately and permanently. Enter your password to confirm.
          </p>
          <label className="field">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              className="input"
            />
            <FieldMessages errors={errors} name="password" />
          </label>
          {errors.form && (
            <p role="alert" className="alert-error">
              {errors.form.join(" ")}
            </p>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn btn-danger flex-1">
              {pending ? "Deleting…" : "Delete forever"}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

export default function AccountView() {
  const { data: user } = useSWR<User>("/api/auth/me");

  return (
    <>
      <PageHeader title="Account" subtitle="Your username, your data and your privacy." />
      {!user ? (
        <div className="space-y-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <div className="mx-auto max-w-xl space-y-4 md:space-y-6">
          <ProfileCard user={user} />
          <ExportCard />
          <section className="card">
            <h2 className="card-title">Privacy</h2>
            <p className="muted mt-1">
              We use your data only to run the app and never share it with third parties.{" "}
              <Link href="/privacy" className="font-medium text-teal-700 underline dark:text-teal-300">
                Read the privacy policy
              </Link>
              .
            </p>
          </section>
          <DeleteCard />
        </div>
      )}
    </>
  );
}
