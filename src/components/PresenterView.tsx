import { useEffect } from "react";
import { CornersIn, Presentation, WifiHigh } from "@phosphor-icons/react";
import type { NotefyRoom } from "../types";
import { getPublicOrigin } from "../lib/device";
import { isRichHtmlEmpty } from "../lib/export";
import { QrCodeBox } from "./QrCodeBox";
import { PadEditor } from "./PadEditor";
import { ThemeToggle } from "./ui/ThemeToggle";

interface PresenterViewProps {
  room: NotefyRoom;
  viewerCount: number;
  onExit: () => void;
}

export function PresenterView({ room, viewerCount, onExit }: PresenterViewProps) {
  const origin = getPublicOrigin();
  const displayOrigin = origin.replace(/^https?:\/\//i, "");
  const shareUrl = `${origin}/view/${room.readOnlyCode}`;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onExit]);

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex flex-col overflow-hidden bg-[var(--bg-surface)] text-[var(--text-primary)] lg:flex-row">
      {/* Left Rail / Top Banner with Giant QR, Access Code & URL */}
      <aside className="flex shrink-0 flex-col justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-6 lg:w-[23rem] lg:border-r lg:border-b-0 lg:p-8 xl:w-[26rem]">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-soft-text)]">
              <Presentation size={15} weight="duotone" />
              Presenter Mode · Live
            </div>
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
              <button
                type="button"
                onClick={onExit}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
              >
                <CornersIn size={15} />
                Exit
              </button>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {room.title || "Shared Note"}
            </h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-primary)]" />
              <WifiHigh size={14} weight="bold" className="text-[var(--accent-primary)]" />
              Updates live · {viewerCount} viewing
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xs">
            <QrCodeBox value={shareUrl} size={232} showDownload={false} />
            <div className="w-full space-y-2 text-center">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                  Access Code
                </div>
                <div className="mt-0.5 font-mono text-2xl font-bold tracking-wider uppercase text-[var(--text-primary)]">
                  {room.readOnlyCode}
                </div>
              </div>
              <div className="break-all rounded-xl bg-[var(--bg-canvas)] px-3.5 py-2 font-mono text-xs font-semibold text-[var(--accent-primary)] ring-1 ring-[var(--border-subtle)]">
                {displayOrigin}/view/{room.readOnlyCode}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-6 hidden text-xs text-[var(--text-muted)] lg:block">
          Press <kbd className="rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[11px]">Esc</kbd> to exit Presenter Mode.
        </p>
      </aside>

      {/* Main Live Note Canvas */}
      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8 sm:px-12 lg:px-16 lg:py-12">
        {!isRichHtmlEmpty(room.padContent) ? (
          <div className="max-w-4xl">
            <PadEditor
              key={room.id}
              value={room.padContent}
              updatedAt={room.padUpdatedAt}
              readOnly
              presenterScale
            />
          </div>
        ) : (
          <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-3xl border border-dashed border-[var(--border-strong)] p-10 text-center">
            <p className="text-xl font-semibold text-[var(--text-secondary)]">
              Waiting for notes…
            </p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Anything typed into this note will appear here automatically.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
