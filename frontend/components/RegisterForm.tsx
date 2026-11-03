"use client";

import { useRef, useState } from "react";
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
  const formRef = useRef<HTMLFormElement>(null);

  useResetOnHide(() => {
    setPending(false);
    setErrors({});
    formRef.current?.reset();
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const get = (k: string) => String(form.get(k) ?? "");
    setPending(true);
    setErrors({});
    try {
      await register({
        username: get("username"),
        email: get("email"),
        password: get("password"),
        password_confirm: get("password_confirm"),
        website: get("website"),
      });
      router.replace("/");
      router.refresh();
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

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <label className="field">
        Username
        <input name="username" autoComplete="username" required maxLength={150} className="input" />
        {fieldError("username")}
      </label>
      <label className="field">
        Email
        <input name="email" type="email" autoComplete="email" required maxLength={254} className="input" />
        {fieldError("email")}
      </label>
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
