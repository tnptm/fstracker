"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR, { mutate } from "swr";
import { acceptPrivacyPolicy, type User } from "@/lib/api";
import { useResetOnHide } from "@/lib/useResetOnHide";

/**
 * Shown to signed-in users who have not accepted the current privacy policy
 * version (accounts created before the policy existed, or before it changed).
 */
export default function PrivacyNotice() {
  const { data: user } = useSWR<User>("/api/auth/me");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useResetOnHide(() => {
    setPending(false);
    setError(false);
  });

  if (!user || user.privacy_accepted) return null;

  async function onAccept() {
    setPending(true);
    setError(false);
    try {
      await mutate("/api/auth/me", await acceptPrivacyPolicy(), { revalidate: false });
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <div
      role="region"
      aria-label="Privacy policy"
      className="border-b border-teal-200 bg-teal-50 dark:border-teal-500/20 dark:bg-teal-500/10"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 text-sm text-teal-900 sm:flex-row sm:items-center dark:text-teal-100">
        <p className="flex-1">
          We have a privacy policy that explains how your data is used. It is only used to run the
          app and is never shared with third parties.{" "}
          <Link href="/privacy" target="_blank" rel="noopener" className="font-semibold underline">
            Read the privacy policy
          </Link>
          .
          {error && <span className="ml-1 text-rose-700 dark:text-rose-300">Could not save. Try again.</span>}
        </p>
        <button type="button" onClick={onAccept} disabled={pending} className="btn btn-primary shrink-0">
          {pending ? "Saving…" : "I have read and accept it"}
        </button>
      </div>
    </div>
  );
}
