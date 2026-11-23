import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@ui-sdk/react/popover";
import {
  Check,
  CloudSlash,
  Copy,
  DeviceMobile,
  Eye,
  Key,
  Laptop,
  LockKey,
  Notepad,
  QrCode,
  SidebarSimple,
  Timer,
} from "@phosphor-icons/react";
import type { NotefyRoom, PresenceMember } from "../types";
import { copyTextToClipboard } from "../lib/device";
import { formatCountdown } from "../lib/parsers";
import { ExportMenu } from "./ExportMenu";
import { ThemeToggle } from "./ui/ThemeToggle";

interface HeaderProps {
  room: NotefyRoom;
  presence: PresenceMember[];
  canEdit: boolean;
  isOffline?: boolean;
  isDraft?: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onUpdateTitle: (title: string) => void;
  onOpenShare: () => void;
  onNotify: (text: string) => void;
}

export function Header({
  room,
  presence,
  canEdit,
  isOffline = false,
  isDraft = false,
  sidebarOpen,
  onToggleSidebar,
  onUpdateTitle,
  onOpenShare,
  onNotify,
}: HeaderProps) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(room.title);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    setTitleDraft(room.title);
  }, [room.title]);

  const editDevices = presence.filter((p) => p.mode === "edit");
  const viewers = presence.filter((p) => p.mode === "view");
  const syncingCount = editDevices.length;
  const showPresence = syncingCount > 1 || viewers.length > 0;

  const handleCopyCode = async () => {
    const ok = await copyTextToClipboard(room.displayCode);
    if (ok) {
      setCopiedCode(true);
      onNotify(`Copied access code ${room.displayCode}`);
      window.setTimeout(() => setCopiedCode(false), 1600);
    }
  };

  const commitTitle = () => {
    setEditingTitle(false);
    if (titleDraft.trim() !== room.title) {
      onUpdateTitle(titleDraft);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitTitle();
    } else if (e.key === "Escape") {
      setTitleDraft(room.title);
      setEditingTitle(false);
    }
  };

  return (
    <header className="print-hidden sticky top-0 z-30 h-14 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md">
      <div className="flex h-full items-center justify-between gap-2 px-3 sm:px-6">
        {/* Left: Sidebar Toggle (hidden on < sm since mobile bottom bar has Notes) + Title + Access Code */}
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Open sidebar"
            title="Open sidebar"
            className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] sm:inline-flex ${sidebarOpen ? "lg:hidden" : ""
              }`}
          >
            <SidebarSimple size={18} />
          </button>

          {!sidebarOpen && (
            <Link
              to="/"
              aria-label="Notefy Home"
              title="Notefy Home"
              className="hidden h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)] text-white transition hover:bg-[var(--accent-primary-hover)] lg:flex dark:text-[#0d1f1d]"
            >
              <Notepad size={16} weight="duotone" />
            </Link>
          )}

          <div className="flex min-w-0 flex-1 items-center gap-2">
            {editingTitle && canEdit ? (
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={handleTitleKeyDown}
                placeholder="Untitled Note"
                autoFocus
                className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--accent-primary)] bg-[var(--bg-canvas)] px-2 text-base font-semibold text-[var(--text-primary)] focus:outline-none sm:w-64 sm:flex-none sm:text-sm"
              />
            ) : (
              <div className="flex min-w-0 flex-col sm:flex-row sm:items-center sm:gap-2">
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => canEdit && setEditingTitle(true)}
                  title={canEdit ? "Click to rename note" : undefined}
                  className="truncate text-left text-sm font-bold leading-tight tracking-tight text-[var(--text-primary)] hover:text-[var(--accent-primary)] disabled:hover:text-[var(--text-primary)] sm:text-[15px]"
                >
                  {room.title || "Untitled Note"}
                </button>

                {/* Compact tappable mobile code chip under title; pill beside title on sm+ */}
                {isDraft ? (
                  <button
                    type="button"
                    onClick={() =>
                      onNotify("Offline draft — gets a unique 4-char code automatically once online")
                    }
                    title="Saved locally; will receive a 4-character code when back online"
                    className="mt-0.5 inline-flex w-fit shrink-0 items-center gap-1 rounded-md bg-[var(--status-burn-soft)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--status-burn)] sm:mt-0 sm:rounded-lg sm:px-2 sm:py-1 sm:text-[11px]"
                  >
                    <CloudSlash size={12} weight="duotone" />
                    <span>Offline Draft</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    title="Copy access code for another device"
                    className="mt-0.5 inline-flex w-fit shrink-0 items-center gap-1 font-mono text-[10px] font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] sm:mt-0 sm:gap-1.5 sm:rounded-lg sm:border sm:border-[var(--border-subtle)] sm:bg-[var(--bg-canvas)] sm:px-2 sm:py-1 sm:text-[11px] sm:hover:border-[var(--border-strong)]"
                  >
                    {isOffline ? (
                      <CloudSlash size={11} weight="duotone" className="text-[var(--status-burn)] sm:h-3 sm:w-3" />
                    ) : (
                      <Key size={11} weight="duotone" className="text-[var(--accent-primary)] sm:h-3 sm:w-3" />
                    )}
                    <span>{room.displayCode}</span>
                    {copiedCode ? (
                      <Check size={11} weight="bold" className="animate-pop-in text-[var(--accent-primary)]" />
                    ) : (
                      <Copy size={10} className="opacity-70 sm:h-[11px] sm:w-[11px]" />
                    )}
                  </button>
                )}
              </div>
            )}

            {room.hasPin && (
              <span
                title={
                  room.pinScope === "all"
                    ? "PIN locked · End-to-End Encrypted"
                    : "Edit PIN locked · Encrypted at rest"
                }
                className="inline-flex shrink-0 items-center text-[var(--accent-primary)]"
              >
                <LockKey size={15} weight="duotone" />
              </span>
            )}

            {room.expiresAt && (
              <span className="hidden shrink-0 items-center gap-1 rounded-md bg-[var(--status-burn-soft)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--status-burn)] md:inline-flex">
                <Timer size={11} weight="duotone" />
                {formatCountdown(room.expiresAt)}
              </span>
            )}
          </div>
        </div>

        {/* Right: Presence (shown only when 2+ devices or viewers are live) + Export + Share + Theme */}
        <div className="flex shrink-0 items-center gap-1.5">
          {showPresence && (
            <Popover>
              <PopoverTrigger
                aria-label="Connected devices"
                className="animate-fade-in inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)] md:px-2.5"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-primary)]" />
                <span className="font-mono text-[11px] md:hidden">
                  {Math.max(1, syncingCount) + viewers.length}
                </span>
                <span className="hidden md:inline">{Math.max(1, syncingCount)} online</span>
                {viewers.length > 0 && (
                  <span className="hidden text-[var(--text-muted)] md:inline">
                    · {viewers.length} viewing
                  </span>
                )}
              </PopoverTrigger>

              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-60 origin-(--transform-origin) rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 shadow-xl shadow-black/15 transition-[opacity,scale] duration-150 data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:scale-96 data-ending-style:opacity-0 dark:shadow-black/50"
              >
                <PopoverTitle className="text-xs font-semibold text-[var(--text-primary)]">
                  Connected Right Now
                </PopoverTitle>
                <div className="mt-2.5 space-y-1.5">
                  {editDevices.map((member) => (
                    <div
                      key={member.clientId}
                      className="flex items-center justify-between rounded-lg bg-[var(--bg-subtle)]/70 px-2.5 py-1.5 text-xs"
                    >
                      <span className="inline-flex items-center gap-1.5 text-[var(--text-primary)]">
                        {member.deviceLabel === "Phone" ? (
                          <DeviceMobile size={14} weight="duotone" className="text-[var(--accent-primary)]" />
                        ) : (
                          <Laptop size={14} weight="duotone" className="text-[var(--accent-primary)]" />
                        )}
                        {member.deviceLabel}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--accent-primary)]">Editing</span>
                    </div>
                  ))}
                  {viewers.length > 0 && (
                    <div className="flex items-center justify-between rounded-lg bg-[var(--bg-subtle)]/50 px-2.5 py-1.5 text-xs text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1.5">
                        <Eye size={14} weight="duotone" />
                        Read-only viewers
                      </span>
                      <span className="font-mono text-[11px] font-semibold">{viewers.length}</span>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}

          <ExportMenu room={room} onNotify={onNotify} />

          <button
            type="button"
            onClick={onOpenShare}
            className="hidden h-9 items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[var(--accent-primary-hover)] sm:inline-flex dark:text-[#0d1f1d]"
          >
            <QrCode size={16} weight="duotone" />
            <span>Share</span>
          </button>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
