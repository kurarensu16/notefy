import { ArrowCounterClockwise, CheckCircle, Flame, WarningCircle, X } from "@phosphor-icons/react";
import { useNotefyUi } from "../lib/uiContext";

export function ToastContainer() {
  const { toasts, dismissToast } = useNotefyUi();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="print-hidden pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:items-end"
    >
      {toasts.map((toast) => {
        const icon =
          toast.tone === "burn" ? (
            <Flame size={17} weight="duotone" className="shrink-0 text-[var(--status-burn)]" />
          ) : toast.tone === "danger" ? (
            <WarningCircle size={17} weight="duotone" className="shrink-0 text-[var(--status-danger)]" />
          ) : (
            <CheckCircle size={17} weight="duotone" className="shrink-0 text-[var(--accent-primary)]" />
          );

        return (
          <div
            key={toast.id}
            role="status"
            className="animate-toast-in pointer-events-auto relative overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3.5 py-2.5 shadow-lg shadow-black/10 dark:shadow-black/40"
          >
            <div className="flex items-center gap-2.5 text-sm text-[var(--text-primary)]">
              {icon}
              <span className="font-medium">{toast.text}</span>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action?.onClick();
                    dismissToast(toast.id);
                  }}
                  className="ml-1 inline-flex items-center gap-1 rounded-lg bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-soft-text)] transition hover:opacity-90"
                >
                  <ArrowCounterClockwise size={13} weight="bold" />
                  {toast.action.label}
                </button>
              )}
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismissToast(toast.id)}
                className="ml-0.5 rounded-md p-1 text-[var(--text-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
              >
                <X size={14} weight="bold" />
              </button>
            </div>
            {toast.action && (
              <div
                className="animate-toast-drain absolute inset-x-0 bottom-0 h-0.5 bg-[var(--accent-primary)]"
                style={{ animationDuration: `${toast.durationMs ?? 5000}ms` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
