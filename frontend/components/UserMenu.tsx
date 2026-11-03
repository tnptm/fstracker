"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { logout, type User } from "@/lib/api";
import { useResetOnHide } from "@/lib/useResetOnHide";
import { LogOutIcon } from "./icons";

export default function UserMenu() {
  const router = useRouter();
  const { data: user } = useSWR<User>("/api/auth/me");
  const [pending, setPending] = useState(false);

  useResetOnHide(() => setPending(false));

  async function onLogout() {
    setPending(true);
    await logout().catch(() => {});
    // Drop every cached response so the next user never sees this user's data.
    await mutate(() => true, undefined, { revalidate: false });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {user && (
        <span className="hidden max-w-40 truncate text-sm text-zinc-600 sm:inline dark:text-zinc-400">
          {user.username}
        </span>
      )}
      <button
        type="button"
        onClick={onLogout}
        disabled={pending}
        className="icon-btn disabled:opacity-50"
        aria-label="Log out"
        title="Log out"
      >
        <LogOutIcon />
      </button>
    </div>
  );
}
