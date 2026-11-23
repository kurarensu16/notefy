import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ui-sdk/react/dialog";
import { Broom, SignOut, Trash, X } from "@phosphor-icons/react";
import type { NotefyRoom } from "../types";

interface LeaveClearDialogProps {
  room: NotefyRoom;
  canDeleteCurrent: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeaveOnly: () => void;
  onDeleteAndLeave: () => void;
}

export function LeaveClearDialog({
  room,
  canDeleteCurrent,
  open,
  onOpenChange,
  onLeaveOnly,
  onDeleteAndLeave,
}: LeaveClearDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogBackdrop className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0" />
      <DialogContent className="fixed inset-x-0 bottom-0 top-auto left-0 z-[60] m-0 w-full overflow-hidden rounded-t-3xl rounded-b-none border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0 text-[var(--text-primary)] shadow-2xl transition-all duration-200 data-starting-style:translate-y-6 data-starting-style:opacity-0 data-ending-style:translate-y-6 data-ending-style:opacity-0 sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:w-[min(92vw,28rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border sm:data-starting-style:translate-y-0 sm:data-starting-style:scale-96 sm:data-ending-style:translate-y-0 sm:data-ending-style:scale-96">
        <div className="flex justify-center pt-2.5 pb-0.5 sm:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-[var(--border-strong)]/80" />
        </div>
        <div className="flex items-start justify-between gap-3 px-5 pt-3.5 pb-3 sm:px-6 sm:pt-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
              <Broom size={20} weight="duotone" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight">
                Leave &amp; Clear Browser?
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Choose whether to keep your note online or delete it permanently.
              </DialogDescription>
            </div>
          </div>

          <DialogClose
            aria-label="Close dialog"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-[var(--text-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={16} weight="bold" />
          </DialogClose>
        </div>

        <div className="space-y-2.5 px-5 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
          {/* Option 1: Safe leave & clear browser only */}
          <button
            type="button"
            onClick={onLeaveOnly}
            className="group flex w-full items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70 p-3.5 text-left transition hover:border-[var(--accent-primary)] hover:bg-[var(--bg-subtle)]/70 active:scale-[0.99]"
          >
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface)] text-[var(--accent-primary)] ring-1 ring-[var(--border-subtle)]">
              <SignOut size={16} weight="duotone" />
            </span>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                Just leave &amp; clear this browser
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                Wipes your recent list and PIN sessions here.{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  {room.title || "This note"}
                </span>{" "}
                stays saved and accessible anytime with code{" "}
                <span className="font-mono font-semibold text-[var(--accent-primary)]">
                  {room.displayCode}
                </span>
                .
              </p>
            </div>
          </button>

          {/* Option 2: Permanently delete current note + clear browser */}
          {canDeleteCurrent && (
            <button
              type="button"
              onClick={onDeleteAndLeave}
              className="group flex w-full items-start gap-3 rounded-2xl border border-[var(--status-danger)]/30 bg-[var(--status-danger-soft)]/35 p-3.5 text-left transition hover:border-[var(--status-danger)]/60 hover:bg-[var(--status-danger-soft)]/60 active:scale-[0.99]"
            >
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-surface)] text-[var(--status-danger)] ring-1 ring-[var(--status-danger)]/25">
                <Trash size={16} weight="duotone" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--status-danger)]">
                  Delete note &amp; clear browser
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                  Permanently deletes{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {room.title || "this note"}
                  </span>{" "}
                  so code <span className="font-mono font-semibold">{room.displayCode}</span> stops
                  working everywhere, and clears this browser.
                </p>
              </div>
            </button>
          )}

          <div className="pt-1.5 text-right">
            <DialogClose className="inline-flex h-9 cursor-pointer items-center justify-center rounded-xl px-4 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]">
              Cancel
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
