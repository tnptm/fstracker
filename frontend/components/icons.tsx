// Small inline icon set (24px grid, stroke = currentColor). Decorative by default.
type IconProps = React.SVGProps<SVGSVGElement>;

function Icon({ children, className = "size-5", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></Icon>
);
export const HistoryIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></Icon>
);
export const TimerIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2" /><path d="M10 2h4" /></Icon>
);
export const StatsIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 21h18" /><path d="M6 17v-5" /><path d="M11 17V7" /><path d="M16 17v-8" /><path d="M21 17V4" /></Icon>
);
export const SunIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Icon>
);
export const MoonIcon = (p: IconProps) => (
  <Icon {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" /></Icon>
);
export const MonitorIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></Icon>
);
export const LogOutIcon = (p: IconProps) => (
  <Icon {...p}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><path d="M10 17l-5-5 5-5" /><path d="M5 12h12" /></Icon>
);
export const UserIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Icon>
);
export const PlayIcon = (p: IconProps) => (
  <Icon {...p} fill="currentColor" stroke="none"><path d="M8 5.1v13.8a1 1 0 0 0 1.5.9l11-6.9a1 1 0 0 0 0-1.7l-11-6.9A1 1 0 0 0 8 5.1Z" /></Icon>
);
export const StopIcon = (p: IconProps) => (
  <Icon {...p} fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2.5" /></Icon>
);
export const PlusIcon = (p: IconProps) => <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>;
export const MinusIcon = (p: IconProps) => <Icon {...p}><path d="M5 12h14" /></Icon>;
export const ChevronLeftIcon = (p: IconProps) => <Icon {...p}><path d="m15 18-6-6 6-6" /></Icon>;
export const ChevronRightIcon = (p: IconProps) => <Icon {...p}><path d="m9 18 6-6-6-6" /></Icon>;
export const CloseIcon = (p: IconProps) => <Icon {...p}><path d="M18 6 6 18M6 6l12 12" /></Icon>;
export const PencilIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></Icon>
);
export const CheckCircleIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></Icon>
);
export const TrendUpIcon = (p: IconProps) => (
  <Icon {...p}><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></Icon>
);
export const TrendDownIcon = (p: IconProps) => (
  <Icon {...p}><path d="m3 7 6 6 4-4 8 8" /><path d="M15 17h6v-6" /></Icon>
);
export const NoteIcon = (p: IconProps) => (
  <Icon {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></Icon>
);
export const LogoMark = ({ className = "size-8" }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={`inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 text-white shadow-sm shadow-teal-600/30 ${className}`}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="size-[60%]">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2" />
    </svg>
  </span>
);
