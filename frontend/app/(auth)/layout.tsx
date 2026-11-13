import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { LogoMark } from "@/components/icons";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-1 flex-col items-center justify-center overflow-hidden px-4 py-10">
      {/* Soft background glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-teal-300/40 to-emerald-400/20 blur-3xl dark:from-teal-500/20 dark:to-emerald-700/10"
      />
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <LogoMark className="size-12" />
          <div>
            <p className="text-xl font-semibold tracking-tight">fstracker</p>
            <p className="muted">Your volunteer hours, simply tracked.</p>
          </div>
        </div>
        <div className="card p-6 sm:p-8">{children}</div>
        <p className="mt-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
          <Link href="/privacy" className="underline hover:text-zinc-700 dark:hover:text-zinc-200">
            Privacy policy
          </Link>
        </p>
      </div>
    </div>
  );
}
