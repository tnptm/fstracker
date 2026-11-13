"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, register } from "@/lib/api";
import { useResetOnHide } from "@/lib/useResetOnHide";

type FieldErrors = Record<string, string[]>;

function toErrors(err: unknown): FieldErrors {
  if (err instanceof ApiError) {
    if (err.status === 429) {
      return { form: ["Too many sign-up attempts. Please try again later."] };
    }
    if (err.status === 403) {
      return { form: ["Your session expired. Reload the page and try again."] };
    }
    if (err.data && typeof err.data === "object") {
      const out: FieldErrors = {};
      for (const [key, value] of Object.entries(err.data)) {
        const k = key === "non_field_errors" || key === "detail" ? "form" : key;
        out[k] = Array.isArray(value) ? value.map(String) : [String(value)];
      }
      return out;
    }
  }
  return { form: ["Registration failed. Please try again."] };
}

export default function RegisterForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  // The random username the server picked; shown once after sign-up.
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useResetOnHide(() => {
    setPending(false);
    setErrors({});
    setCreated(null);
    setCopied(false);
    formRef.current?.reset();
  });

  async function copyUsername() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created);
      setCopied(true);
    } catch {
      setCopied(false); // the name is selectable on screen, copy it by hand
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "");
    if (form.get("accept_privacy") !== "on") {
      setErrors({
        accept_privacy: ["You must accept the privacy policy to create an account."],
      });
      return;
    }
    setPending(true);
    setErrors({});
    try {
      const user = await register({
        password: get("password"),
        password_confirm: get("password_confirm"),
        accept_privacy: form.get("accept_privacy") === "on",
        website: get("website"),
      });
      setCreated(user.username);
      setPending(false);
    } catch (err) {
      setErrors(toErrors(err));
      setPending(false);
    }
  }


  const fieldError = (name: string) =>
    errors[name]?.map((msg) => (
      <span key={msg} className="text-xs font-normal text-rose-600 dark:text-rose-400">
        {msg}
      </span>
    ));

  if (created) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold tracking-tight">Your account is ready</h2>
        <p className="muted">
          This is your username. You need it together with your password to log in.
        </p>
        <p
          className="rounded-2xl bg-zinc-100 px-4 py-3 text-center font-mono text-xl font-semibold tracking-wider break-all select-all dark:bg-zinc-800"
          data-testid="new-username"
        >
          {created}
        </p>
        <button type="button" onClick={copyUsername} className="btn btn-secondary w-full">
          {copied ? "Copied" : "Copy username"}
        </button>
        <p role="note" className="alert-error">
          Save both now. We store no email, so a lost username or password cannot be recovered.
          You can see your username later under Account.
        </p>
        <button
          type="button"
          onClick={() => {
            router.replace("/");
            router.refresh();
          }}
          className="btn btn-primary w-full"
        >
          Continue
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <p className="muted">
        No name or email is needed. We create a random username for you, and you choose a
        password.
      </p>
      <label className="field">
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          className="input"
        />
        {fieldError("password")}
      </label>
      <label className="field">
        Confirm password
        <input
          name="password_confirm"
          type="password"
          autoComplete="new-password"
          required
          maxLength={128}
          className="input"
        />
        {fieldError("password_confirm")}
      </label>

      <div className="rounded-2xl bg-zinc-50 p-3.5 text-sm dark:bg-zinc-800/60">
        <p className="muted">
          Your data is used only to run the app and is never shared with third parties. You
          can export your data or delete your account at any time.
        </p>
        <label className="mt-3 flex items-start gap-3 font-medium text-zinc-700 dark:text-zinc-300">
          <input
            name="accept_privacy"
            type="checkbox"
            required
            aria-describedby="accept-privacy-error"
            className="mt-0.5 size-5 shrink-0 accent-teal-600"
          />
          <span>
            I have read and accept the{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener"
              className="font-medium text-teal-700 underline dark:text-teal-300"
            >
              privacy policy
            </Link>
            .
          </span>
        </label>
        <div id="accept-privacy-error" className="mt-1.5 flex flex-col">
          {fieldError("accept_privacy")}
        </div>
      </div>

      {/* Honeypot: invisible to people and screen readers; bots tend to fill it. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {errors.form && (
        <p role="alert" className="alert-error">
          {errors.form.join(" ")}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-2 w-full"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
