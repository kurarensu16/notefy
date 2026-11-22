import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { CircleNotch } from "@phosphor-icons/react";

export function Spinner({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <CircleNotch
      size={size}
      weight="bold"
      className={`animate-spin ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Slim top route-transition progress bar (Linear/Vercel style).
 */
export function RouteProgressBar() {
  const location = useLocation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 320);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="print-hidden pointer-events-none fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden bg-[var(--accent-primary)]/15"
    >
      <div className="animate-progress-sweep h-full w-1/2 rounded-full bg-[var(--accent-primary)]" />
    </div>
  );
}

/**
 * Full-width notepad loading skeleton (used on async loads & Convex hydration).
 */
export function NoteSkeleton({ withSidebar = true }: { withSidebar?: boolean }) {
  return (
    <div className="flex min-h-screen bg-[var(--bg-surface)]">
      {withSidebar && (
        <aside className="hidden w-64 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4 lg:block">
          <div className="flex items-center gap-2.5 pb-4">
            <div className="notefy-skeleton h-7 w-7 rounded-lg" />
            <div className="notefy-skeleton h-4 w-20 rounded-md" />
          </div>
          <div className="notefy-skeleton mt-3 h-9 w-full rounded-xl" />
          <div className="notefy-skeleton mt-3 h-9 w-full rounded-xl" />
          <div className="mt-6 space-y-2.5">
            <div className="notefy-skeleton h-11 w-full rounded-xl" />
            <div className="notefy-skeleton h-11 w-full rounded-xl" />
            <div className="notefy-skeleton h-11 w-4/5 rounded-xl" />
          </div>
        </aside>
      )}

      <div className="flex flex-1 flex-col">
        <div className="flex h-14 items-center justify-between border-b border-[var(--border-subtle)] px-6">
          <div className="flex items-center gap-3">
            <div className="notefy-skeleton h-5 w-40 rounded-md" />
            <div className="notefy-skeleton h-6 w-16 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <div className="notefy-skeleton h-9 w-20 rounded-xl" />
            <div className="notefy-skeleton h-9 w-20 rounded-xl" />
          </div>
        </div>

        <div className="flex h-11 items-center gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/60 px-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="notefy-skeleton h-6 w-6 rounded-md" />
          ))}
        </div>

        <div className="flex-1 space-y-4 px-6 py-8 sm:px-10 lg:px-14">
          <div className="notefy-skeleton h-8 w-64 rounded-lg" />
          <div className="notefy-skeleton h-4 w-full max-w-2xl rounded-md" />
          <div className="notefy-skeleton h-4 w-5/6 max-w-xl rounded-md" />
          <div className="pt-3 space-y-2.5">
            <div className="notefy-skeleton h-4 w-72 rounded-md" />
            <div className="notefy-skeleton h-4 w-80 rounded-md" />
            <div className="notefy-skeleton h-4 w-60 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
