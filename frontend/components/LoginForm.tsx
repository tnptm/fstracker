"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, login } from "@/lib/api";
import { useResetOnHide } from "@/lib/useResetOnHide";

// Only allow same-site relative redirects after login.
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear state and typed credentials when the page is hidden (e.g. after
  // login), so the form is fresh when the user returns after logging out.
  useResetOnHide(() => {
    setPending(false);
    setError(null);
    formRef.current?.reset();
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    try {
      await login(String(form.get("username")), String(form.get("password")));
      router.replace(safeNext(searchParams.get("next")));
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Invalid username or password."
          : "Login failed. Please try again.",
      );
      setPending(false);
    }
  }


  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="field">
        Username
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
          className="input"
        />
      </label>
      <label className="field">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input"
        />
      </label>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-2 w-full"
      >
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
