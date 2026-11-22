import React from "react";
import { ArrowClockwise, Notepad, WarningCircle } from "@phosphor-icons/react";

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Notefy runtime error:", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="notefy-dot-grid flex min-h-screen flex-col items-center justify-center bg-[var(--bg-canvas)] px-4 text-[var(--text-primary)]">
        <div className="animate-fade-up w-full max-w-md rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-7 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--status-danger-soft)] text-[var(--status-danger)]">
            <WarningCircle size={26} weight="duotone" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Something went wrong</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
            An unexpected error interrupted this screen. Your synced notes are safe — reload to
            continue.
          </p>
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-4 text-xs font-semibold text-white transition hover:bg-[var(--accent-primary-hover)] dark:text-[#0d1f1d]"
            >
              <ArrowClockwise size={15} weight="bold" />
              Reload Page
            </button>
            <a
              href="/"
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-4 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-subtle)]"
            >
              <Notepad size={15} weight="duotone" />
              Go Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
