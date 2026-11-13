import Link from "next/link";
import PrivacyNotice from "@/components/PrivacyNotice";
import Providers from "@/components/Providers";
import { BottomNav, HeaderNav } from "@/components/NavLinks";
import ThemeToggle from "@/components/ThemeToggle";
import UserMenu from "@/components/UserMenu";
import { LogoMark } from "@/components/icons";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Providers>
      <div className="flex min-h-dvh flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-zinc-50/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/80">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
            <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <LogoMark />
              <span className="text-lg">fstracker</span>
            </Link>
            <HeaderNav />
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
        </header>
        <PrivacyNotice />
        {/* Bottom padding keeps content clear of the mobile tab bar. */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-8 md:pb-12">
          {children}
        </main>
        <BottomNav />
      </div>
    </Providers>
  );
}
