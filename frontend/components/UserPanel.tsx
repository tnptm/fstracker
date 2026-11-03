"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, logout, type User } from "@/lib/api";
import { useResetOnHide } from "@/lib/useResetOnHide";

export default function UserPanel() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [pending, setPending] = useState(false);

  // Also drop the user so a different account never sees the old name.
  useResetOnHide(() => {
    setPending(false);
    setUser(null);
  });

  useEffect(() => {
    apiFetch<User>("/api/auth/me").then(setUser).catch(() => {});
  }, []);

  async function onLogout() {
    setPending(true);
    await logout().catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">
        {user ? `Logged in as ${user.username}` : "Loading…"}
      </span>
      <button
        onClick={onLogout}
        disabled={pending}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        Log out
      </button>
    </div>
  );
}
