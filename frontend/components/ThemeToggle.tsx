"use client";

import { useTheme, type ThemePreference } from "@/lib/theme";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";

const NEXT: Record<ThemePreference, ThemePreference> = {
  system: "light",
  light: "dark",
  dark: "system",
};
const LABEL: Record<ThemePreference, string> = {
  system: "System theme",
  light: "Light theme",
  dark: "Dark theme",
};

export default function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const Icon = preference === "light" ? SunIcon : preference === "dark" ? MoonIcon : MonitorIcon;
  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => setPreference(NEXT[preference])}
      aria-label={`${LABEL[preference]} (click to change)`}
      title={LABEL[preference]}
    >
      <Icon />
    </button>
  );
}
