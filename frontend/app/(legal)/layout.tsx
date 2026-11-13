import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { LogoMark } from "@/components/icons";

// Public pages that must be readable signed in or out (e.g. the privacy policy).
export default function LegalLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <header className="border-b border-zinc-200/70 bg-zinc-50/80 pt-[env(safe-area-inset-top)] dark:border-zinc-800/70 dark:bg-zinc-950/80">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <LogoMark />
            <span className="text-lg">fstracker</span>
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 pb-[calc(3rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
