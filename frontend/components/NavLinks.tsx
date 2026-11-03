"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HistoryIcon, HomeIcon, StatsIcon, TimerIcon } from "./icons";

const NAV = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/history", label: "History", Icon: HistoryIcon },
  { href: "/track", label: "Track", Icon: TimerIcon },
  { href: "/stats", label: "Stats", Icon: StatsIcon },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Desktop: inline links in the header. */
export function HeaderNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {NAV.map(({ href, label, Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition ${
              active
                ? "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile: fixed tab bar at the bottom, above the iOS home indicator. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/80 bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden dark:border-zinc-800 dark:bg-zinc-950/85"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 pt-2 pb-1.5 text-[11px] font-medium transition ${
                  active ? "text-teal-700 dark:text-teal-300" : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                <span
                  className={`flex h-7 w-14 items-center justify-center rounded-full transition ${
                    active ? "bg-teal-100 dark:bg-teal-500/20" : ""
                  }`}
                >
                  <Icon className="size-5" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
