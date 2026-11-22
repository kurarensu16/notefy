import { Toggle } from "@ui-sdk/react/toggle";
import { Moon, Sun } from "@phosphor-icons/react";
import { useNotefyUi } from "../../lib/uiContext";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useNotefyUi();
  const isDark = theme === "dark";

  return (
    <Toggle
      pressed={isDark}
      onPressedChange={() => toggleTheme()}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] ${className}`}
    >
      {isDark ? <Sun size={18} weight="duotone" /> : <Moon size={18} weight="duotone" />}
    </Toggle>
  );
}
