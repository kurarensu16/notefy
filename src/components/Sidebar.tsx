import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuItemIcon,
  MenuSeparator,
  MenuTrigger,
} from "@ui-sdk/react/menu";
import { OTPInput, OTPInputGroup, OTPInputSlot } from "@ui-sdk/react/otp-input";
import {
  ArrowRight,
  CloudSlash,
  Copy,
  CopySimple,
  DotsThree,
  EyeSlash,
  Key,
  LinkSimple,
  LockKey,
  Notepad,
  PencilSimple,
  Plus,
  QrCode,
  SidebarSimple,
  SignOut,
  SortAscending,
  SortDescending,
  Timer,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { NotefyRoom } from "../types";
import { getClientId } from "../lib/clientState";
import { decryptClientE2ee, encryptClientE2ee, isE2eePayload } from "../lib/e2ee";
import {
  cacheRoomSnapshot,
  createOfflineDraft,
  deleteOfflineDraft,
  draftToRoomView,
  getCachedRoomSnapshot,
  getOfflineDraft,
  isOfflineDraftCode,
  queuePendingRoomEdit,
  removeCachedRoomSnapshot,
  updateOfflineDraft,
} from "../lib/offlineStore";
import { useNotefyUi } from "../lib/uiContext";
import { copyTextToClipboard } from "../lib/device";
import { formatRelativeTime } from "../lib/parsers";
import { Spinner } from "./ui/LoadingStates";

interface SidebarProps {
  currentRoom: NotefyRoom;
  desktopOpen: boolean;
  mobileOpen: boolean;
  onToggleDesktop: () => void;
  onCloseMobile: () => void;
  onOpenShareForCurrent: () => void;
  onRequestLeaveClear: () => void;
}

export function Sidebar({
  currentRoom,
  desktopOpen,
  mobileOpen,
  onToggleDesktop,
  onCloseMobile,
  onOpenShareForCurrent,
  onRequestLeaveClear,
}: SidebarProps) {
  const navigate = useNavigate();
  const createInstant = useMutation(api.rooms.createInstant);
  const resolveCodeMut = useMutation(api.rooms.resolveCode);
  const updateTitle = useMutation(api.rooms.updateTitle);
  const duplicateMut = useMutation(api.rooms.duplicate);
  const deleteRoomMut = useMutation(api.rooms.deleteRoom);
  const restoreRoomMut = useMutation(api.rooms.restoreRoom);

  const {
    isOnline,
    bumpOfflineVersion,
    recentRooms,
    touchRecentRoom,
    forgetRecentRoom,
    getRoomSession,
    getRoomE2ee,
    pushToast,
  } = useNotefyUi();

  const recentCodes = useMemo(
    () => recentRooms.map((r) => r.code).filter((c) => !isOfflineDraftCode(c)),
    [recentRooms]
  );
  const liveMeta = useQuery(
    api.rooms.getRecentMeta,
    isOnline && recentCodes.length > 0 ? { codes: recentCodes } : "skip"
  );

  const [accessMode, setAccessMode] = useState<"code" | "custom">("code");
  const [otpCode, setOtpCode] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [checkingCode, setCheckingCode] = useState(false);
  const [codeShakeKey, setCodeShakeKey] = useState(0);

  const [renamingCode, setRenamingCode] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Lock background page scroll while mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const sortedRooms = useMemo(() => {
    const list = [...recentRooms];
    list.sort((a, b) => {
      const timeA = liveMeta?.[a.code]?.createdAt ?? a.visitedAt;
      const timeB = liveMeta?.[b.code]?.createdAt ?? b.visitedAt;
      return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
    });
    return list;
  }, [recentRooms, liveMeta, sortOrder]);

  const openOfflineDraft = (initialTitle = "", initialPad = "") => {
    const draft = createOfflineDraft(initialTitle, initialPad);
    touchRecentRoom(draftToRoomView(draft));
    bumpOfflineVersion();
    pushToast("Created offline draft (will sync when online)");
    onCloseMobile();
    navigate(`/${draft.draftId}`);
  };

  const handleNewNote = async () => {
    if (creating) return;
    if (!isOnline) {
      openOfflineDraft();
      return;
    }
    setCreating(true);
    try {
      const created = await createInstant({});
      cacheRoomSnapshot(created);
      touchRecentRoom(created);
      pushToast(`Created note (${created.displayCode})`);
      onCloseMobile();
      navigate(`/${created.displayCode}`);
    } catch {
      openOfflineDraft();
    } finally {
      setCreating(false);
    }
  };

  const resolveAndOpen = async (raw: string) => {
    const cleaned = raw
      .trim()
      .replace(/^https?:\/\/[^/]+\//i, "")
      .replace(/[?#].*$/, "")
      .replace(/^\/+|\/+$/g, "");
    if (!cleaned || checkingCode) return;

    if (isOfflineDraftCode(cleaned)) {
      const draft = getOfflineDraft(cleaned);
      if (draft) {
        setOtpCode("");
        setCodeInput("");
        setCodeError(null);
        onCloseMobile();
        navigate(`/${draft.draftId}`);
        return;
      }
    }

    if (!isOnline) {
      const cached = getCachedRoomSnapshot(cleaned);
      if (cached) {
        setOtpCode("");
        setCodeInput("");
        setCodeError(null);
        onCloseMobile();
        navigate(`/${cached.displayCode}`);
        return;
      }
      setCodeError("Offline — note isn't cached on this device.");
      setCodeShakeKey((k) => k + 1);
      return;
    }

    setCheckingCode(true);
    try {
      const res = await resolveCodeMut({
        rawCode: cleaned,
        clientId: getClientId(),
      });
      if (res.kind === "edit") {
        setOtpCode("");
        setCodeInput("");
        setCodeError(null);
        onCloseMobile();
        pushToast(`Opened note (${res.displayCode})`);
        navigate(`/${res.displayCode}`);
        return;
      }
      if (res.kind === "view") {
        setOtpCode("");
        setCodeInput("");
        setCodeError(null);
        onCloseMobile();
        navigate(`/view/${res.readOnlyCode}`);
        return;
      }
      if (res.kind === "rate_limited") {
        setCodeError(res.error);
        setCodeShakeKey((k) => k + 1);
        return;
      }
      setCodeError(`No note found for "${cleaned.toUpperCase()}".`);
      setCodeShakeKey((k) => k + 1);
    } catch {
      const cached = getCachedRoomSnapshot(cleaned);
      if (cached) {
        setOtpCode("");
        setCodeInput("");
        setCodeError(null);
        onCloseMobile();
        navigate(`/${cached.displayCode}`);
        return;
      }
      setCodeError("Connection error while checking code.");
      setCodeShakeKey((k) => k + 1);
    } finally {
      setCheckingCode(false);
    }
  };

  const handleOpenByCode = (e: React.FormEvent) => {
    e.preventDefault();
    void resolveAndOpen(codeInput);
  };

  const commitInlineRename = async (entryCode: string, roomId?: Id<"rooms">) => {
    setRenamingCode(null);
    if (isOfflineDraftCode(entryCode)) {
      const updated = updateOfflineDraft(entryCode, { title: renameDraft.trim() });
      if (updated) {
        touchRecentRoom(draftToRoomView(updated));
        bumpOfflineVersion();
        pushToast("Draft renamed");
      }
      return;
    }
    if (!roomId) return;
    if (!isOnline) {
      const cached = getCachedRoomSnapshot(entryCode);
      const e2eeKey = getRoomE2ee(roomId);
      const nextTitle = e2eeKey
        ? await encryptClientE2ee(renameDraft.trim(), e2eeKey)
        : renameDraft.trim();
      if (cached) {
        cacheRoomSnapshot({ ...cached, title: nextTitle, updatedAt: Date.now() });
        queuePendingRoomEdit(cached, { title: nextTitle });
        touchRecentRoom({ code: cached.code, displayCode: cached.displayCode, title: renameDraft.trim() });
        bumpOfflineVersion();
        pushToast("Renamed locally (will sync when online)");
      }
      return;
    }
    try {
      const e2eeKey = getRoomE2ee(roomId);
      const nextTitle = e2eeKey
        ? await encryptClientE2ee(renameDraft.trim(), e2eeKey)
        : renameDraft;
      await updateTitle({
        roomId,
        title: nextTitle,
        sessionToken: getRoomSession(roomId),
      });
      pushToast("Note renamed");
    } catch {
      pushToast("Unlock PIN to rename this note", { tone: "danger" });
    }
  };

  const navigateAwayFrom = (removedCode: string) => {
    const next = recentRooms.find((r) => r.code !== removedCode);
    if (next) {
      navigate(`/${next.displayCode}`, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  };

  const handleRowAction = async (
    action: string,
    entry: { code: string; displayCode: string; title: string },
    live?: {
      id: Id<"rooms">;
      code: string;
      displayCode: string;
      title: string;
      hasPin: boolean;
      expiresAt: number | null;
      updatedAt: number;
    }
  ) => {
    const isActive = entry.code === currentRoom.code;
    const targetRoomId = (live?.id ?? (isActive ? (currentRoom.id as Id<"rooms">) : undefined));
    const displayCode = live?.displayCode || entry.displayCode;

    if (action === "rename") {
      setRenameDraft(live?.title || entry.title || "");
      setRenamingCode(entry.code);
      return;
    }

    if (action === "copy-code") {
      const ok = await copyTextToClipboard(displayCode);
      pushToast(ok ? `Copied code ${displayCode}` : "Could not copy code");
      return;
    }

    if (action === "duplicate") {
      if (isOfflineDraftCode(entry.code)) {
        const src = getOfflineDraft(entry.code);
        if (src) {
          openOfflineDraft(src.title ? `${src.title} (Copy)` : "Untitled Note (Copy)", src.padContent);
        }
        return;
      }
      if (!isOnline) {
        const srcTitle = isActive ? currentRoom.title : entry.title;
        const srcPad = isActive
          ? currentRoom.padContent
          : getCachedRoomSnapshot(entry.code)?.padContent ?? "";
        openOfflineDraft(srcTitle ? `${srcTitle} (Copy)` : "Untitled Note (Copy)", srcPad);
        return;
      }
      if (!targetRoomId) return;
      try {
        const cloned = await duplicateMut({
          roomId: targetRoomId,
          sessionToken: getRoomSession(targetRoomId),
          ...(isActive
            ? {
                overrideTitle: currentRoom.title,
                overridePadContent: currentRoom.padContent,
              }
            : {}),
        });
        cacheRoomSnapshot(cloned);
        touchRecentRoom(cloned);
        pushToast(`Duplicated as ${cloned.displayCode}`);
        onCloseMobile();
        navigate(`/${cloned.displayCode}`);
      } catch {
        pushToast("Unlock PIN to duplicate this note", { tone: "danger" });
      }
      return;
    }

    if (action === "share") {
      onCloseMobile();
      if (!isActive) {
        navigate(`/${displayCode}`);
        window.setTimeout(() => onOpenShareForCurrent(), 60);
      } else {
        onOpenShareForCurrent();
      }
      return;
    }

    if (action === "remove-list") {
      forgetRecentRoom(entry.code);
      pushToast("Removed from sidebar (note stays accessible via code)");
      if (isActive) {
        onCloseMobile();
        navigateAwayFrom(entry.code);
      }
      return;
    }

    if (action === "delete") {
      if (isOfflineDraftCode(entry.code)) {
        deleteOfflineDraft(entry.code);
        forgetRecentRoom(entry.code);
        bumpOfflineVersion();
        pushToast("Deleted offline draft", { tone: "danger" });
        if (isActive) {
          onCloseMobile();
          navigateAwayFrom(entry.code);
        }
        return;
      }
      if (!isOnline) {
        pushToast("Connect online to delete a synced note permanently", { tone: "danger" });
        return;
      }
      if (!targetRoomId) {
        forgetRecentRoom(entry.code);
        return;
      }
      try {
        const e2eeKey = getRoomE2ee(targetRoomId);
        const snapshot = await deleteRoomMut({
          roomId: targetRoomId,
          sessionToken: getRoomSession(targetRoomId),
        });
        removeCachedRoomSnapshot(entry.code);
        forgetRecentRoom(entry.code);
        if (!snapshot) return;

        let restoreSnapshot = snapshot;
        if (isE2eePayload(snapshot.title) || isE2eePayload(snapshot.padContent)) {
          const [decTitle, decPad] = await Promise.all([
            decryptClientE2ee(snapshot.title, e2eeKey),
            decryptClientE2ee(snapshot.padContent, e2eeKey),
          ]);
          restoreSnapshot = {
            ...snapshot,
            title: decTitle.ok ? decTitle.text : isActive ? currentRoom.title : "",
            padContent: decPad.ok ? decPad.text : isActive ? currentRoom.padContent : "",
          };
        }

        if (isActive) {
          onCloseMobile();
          navigateAwayFrom(entry.code);
        }
        pushToast(`Deleted "${restoreSnapshot.title || restoreSnapshot.displayCode}"`, {
          tone: "danger",
          durationMs: 5000,
          action: {
            label: "Undo",
            onClick: () => {
              void restoreRoomMut(restoreSnapshot).then((restored) => {
                touchRecentRoom(restored);
                pushToast("Note restored");
                navigate(`/${restored.displayCode}`);
              });
            },
          },
        });
      } catch {
        pushToast("Unlock PIN before deleting this note", { tone: "danger" });
      }
    }
  };

  const sidebarContent = (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {/* Top Brand + Single Collapse Button */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4">
        <Link
          to="/"
          onClick={onCloseMobile}
          className="flex items-center gap-2 transition hover:opacity-85"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent-primary)] text-white dark:text-[#0d1f1d]">
            <Notepad size={16} weight="duotone" />
          </span>
          <span className="text-sm font-bold tracking-tight">Notefy</span>
        </Link>

        <button
          type="button"
          onClick={() => {
            if (mobileOpen) onCloseMobile();
            else onToggleDesktop();
          }}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
        >
          {mobileOpen ? <X size={16} weight="bold" /> : <SidebarSimple size={17} />}
        </button>
      </div>

      {/* Primary Action + Enter Access Code */}
      <div className="space-y-3 border-b border-[var(--border-subtle)] p-3">
        <button
          type="button"
          onClick={() => void handleNewNote()}
          disabled={creating}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 text-xs font-semibold text-white shadow-2xs transition hover:bg-[var(--accent-primary-hover)] active:scale-[0.98] disabled:opacity-75 dark:text-[#0d1f1d]"
        >
          {creating ? (
            <>
              <Spinner size={14} />
              Creating…
            </>
          ) : (
            <>
              <Plus size={15} weight="bold" />
              New Note
            </>
          )}
        </button>

        <div className="space-y-2">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {accessMode === "code" ? "Open by Code" : "Open by Link"}
            </span>
            <button
              type="button"
              onClick={() => {
                setAccessMode((m) => (m === "code" ? "custom" : "code"));
                setCodeError(null);
              }}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            >
              {accessMode === "code" ? (
                <>
                  <LinkSimple size={11} weight="bold" />
                  Link
                </>
              ) : (
                <>
                  <Key size={11} weight="bold" />
                  4-char
                </>
              )}
            </button>
          </div>

          {accessMode === "code" ? (
            <div className="animate-fade-in space-y-1.5">
              <div
                key={codeShakeKey}
                className={`group flex h-10 items-center justify-between gap-2 rounded-xl border bg-[var(--bg-surface)] px-3 transition ${
                  codeError
                    ? "border-[var(--status-danger)]/60 ring-2 ring-[var(--status-danger)]/15"
                    : "border-[var(--border-subtle)] hover:border-[var(--border-strong)] focus-within:border-[var(--accent-primary)] focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/15"
                } ${codeShakeKey > 0 ? "animate-shake" : ""}`}
              >
                <Key
                  size={15}
                  weight="duotone"
                  className={`shrink-0 transition-colors ${
                    codeError
                      ? "text-[var(--status-danger)]"
                      : otpCode.length > 0
                        ? "text-[var(--accent-primary)]"
                        : "text-[var(--text-muted)] group-focus-within:text-[var(--accent-primary)]"
                  }`}
                />

                <OTPInput
                  maxLength={4}
                  pattern="alphanumeric"
                  inputMode="text"
                  textAlign="center"
                  disabled={checkingCode}
                  aria-label="4-character access code"
                  value={otpCode}
                  onValueChange={(next) => {
                    setOtpCode(next.toUpperCase());
                    if (codeError) setCodeError(null);
                  }}
                  onValueCommit={(val) => {
                    void resolveAndOpen(val);
                  }}
                  className="flex flex-1 justify-center"
                >
                  <OTPInputGroup className="flex items-center justify-center gap-2.5">
                    {[0, 1, 2, 3].map((index) => (
                      <OTPInputSlot
                        key={index}
                        index={index}
                        className="notefy-otp-slot relative ml-0 flex h-6 w-6 items-center justify-center rounded-none border-0 border-b-2 border-[var(--border-strong)]/70 bg-transparent pb-0.5 font-mono text-sm font-bold uppercase text-[var(--text-primary)] shadow-none transition-colors duration-150 data-active:border-[var(--accent-primary)] data-active:outline-none data-filled:border-[var(--text-primary)]/45"
                      />
                    ))}
                  </OTPInputGroup>
                </OTPInput>

                <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {checkingCode ? (
                    <Spinner size={13} className="text-[var(--accent-primary)]" />
                  ) : otpCode.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOtpCode("");
                        setCodeError(null);
                      }}
                      aria-label="Clear code"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                    >
                      <X size={12} weight="bold" />
                    </button>
                  ) : null}
                </div>
              </div>

              {codeError && !checkingCode && (
                <p className="animate-fade-in inline-flex items-center gap-1 px-0.5 text-[11px] font-medium text-[var(--status-danger)]">
                  <WarningCircle size={13} weight="duotone" className="shrink-0" />
                  <span>{codeError}</span>
                </p>
              )}
            </div>
          ) : (
            <form onSubmit={handleOpenByCode} className="animate-fade-in space-y-1.5">
              <div
                key={codeShakeKey}
                className={`group flex h-10 items-center gap-1.5 rounded-xl border bg-[var(--bg-surface)] pl-3 pr-1.5 transition ${
                  codeError
                    ? "border-[var(--status-danger)]/60 ring-2 ring-[var(--status-danger)]/15"
                    : "border-[var(--border-subtle)] hover:border-[var(--border-strong)] focus-within:border-[var(--accent-primary)] focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/15"
                } ${codeShakeKey > 0 ? "animate-shake" : ""}`}
              >
                <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">/</span>
                <input
                  id="sidebar-code-input"
                  type="text"
                  value={codeInput}
                  disabled={checkingCode}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => {
                    setCodeInput(e.target.value);
                    if (codeError) setCodeError(null);
                  }}
                  placeholder="custom-link or URL"
                  aria-label="Enter custom link or URL to open a note"
                  className="min-w-0 flex-1 bg-transparent font-mono text-base text-[var(--text-primary)] placeholder:font-sans placeholder:text-sm placeholder:text-[var(--text-muted)] focus:outline-none sm:text-xs sm:placeholder:text-xs"
                />
                {codeInput.length > 0 && !checkingCode && (
                  <button
                    type="button"
                    onClick={() => {
                      setCodeInput("");
                      setCodeError(null);
                    }}
                    aria-label="Clear link input"
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                  >
                    <X size={12} weight="bold" />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!codeInput.trim() || checkingCode}
                  aria-label="Open note with link"
                  title="Open note"
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${
                    codeInput.trim() && !checkingCode
                      ? "bg-[var(--accent-primary)] text-white shadow-2xs hover:bg-[var(--accent-primary-hover)] active:scale-95 dark:text-[#0d1f1d]"
                      : "cursor-not-allowed bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                  }`}
                >
                  {checkingCode ? <Spinner size={12} /> : <ArrowRight size={13} weight="bold" />}
                </button>
              </div>
              {codeError && (
                <p className="animate-fade-in inline-flex items-center gap-1 px-0.5 text-[11px] font-medium text-[var(--status-danger)]">
                  <WarningCircle size={13} weight="duotone" className="shrink-0" />
                  <span>{codeError}</span>
                </p>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Notes List Section: fixed section header + ONLY the list scrolls */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <span>Your Notes</span>
            <span className="rounded-md bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-secondary)]">
              {recentRooms.length}
            </span>
          </div>

          <div
            role="group"
            aria-label="Sort notes"
            className="inline-flex items-center gap-0.5 rounded-lg bg-[var(--bg-subtle)]/80 p-0.5"
          >
            <button
              type="button"
              onClick={() => setSortOrder("newest")}
              aria-label="Sort by last added"
              aria-pressed={sortOrder === "newest"}
              title="Last added first"
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition ${
                sortOrder === "newest"
                  ? "bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-2xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <SortDescending size={14} weight={sortOrder === "newest" ? "bold" : "regular"} />
            </button>
            <button
              type="button"
              onClick={() => setSortOrder("oldest")}
              aria-label="Sort by first added"
              aria-pressed={sortOrder === "oldest"}
              title="First added first"
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md transition ${
                sortOrder === "oldest"
                  ? "bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-2xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <SortAscending size={14} weight={sortOrder === "oldest" ? "bold" : "regular"} />
            </button>
          </div>
        </div>

        <nav
          aria-label="Your notes"
          className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2.5 pb-2.5"
        >
          {sortedRooms.map((entry) => {
            const isDraft = isOfflineDraftCode(entry.code);
            const active = entry.code === currentRoom.code;
            const live = isDraft ? undefined : liveMeta?.[entry.code];
            const isRenaming = renamingCode === entry.code;
            const displayCode = live?.displayCode || entry.displayCode;
            const title = (active ? currentRoom.title : live?.title) || entry.title || "Untitled Note";
            const hasPin = active ? currentRoom.hasPin : Boolean(live?.hasPin);
            const expiresAt = active ? currentRoom.expiresAt : (live?.expiresAt ?? null);
            const targetId = isDraft
              ? undefined
              : (live?.id ??
                (active
                  ? (currentRoom.id as Id<"rooms">)
                  : (getCachedRoomSnapshot(entry.code)?.id as Id<"rooms"> | undefined)));

            return (
              <div
                key={entry.code}
                className={`group flex items-center rounded-xl transition ${
                  active
                    ? "bg-[var(--accent-soft)]/80 text-[var(--accent-soft-text)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]/80 hover:text-[var(--text-primary)]"
                }`}
              >
                {isRenaming ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void commitInlineRename(entry.code, targetId);
                    }}
                    className="flex min-w-0 flex-1 items-center px-2 py-1.5"
                  >
                    <input
                      type="text"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={() => void commitInlineRename(entry.code, targetId)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") setRenamingCode(null);
                      }}
                      placeholder="Note title…"
                      autoFocus
                      className="h-8 w-full rounded-lg border border-[var(--accent-primary)] bg-[var(--bg-surface)] px-2 text-base font-semibold text-[var(--text-primary)] focus:outline-none sm:h-7 sm:text-xs"
                    />
                  </form>
                ) : (
                  <Link
                    to={`/${displayCode}`}
                    onClick={onCloseMobile}
                    className="min-w-0 flex-1 py-2.5 pr-1 pl-2.5 sm:py-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold">{title}</span>
                      {isDraft && (
                        <CloudSlash size={12} weight="duotone" className="shrink-0 text-[var(--status-burn)]" />
                      )}
                      {hasPin && <LockKey size={12} weight="duotone" className="shrink-0 opacity-80" />}
                      {expiresAt && (
                        <Timer size={12} weight="duotone" className="shrink-0 text-[var(--status-burn)]" />
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] opacity-70">
                      <span className={`truncate ${isDraft ? "text-[var(--status-burn)]" : ""}`}>
                        {isDraft ? "Offline draft" : displayCode}
                      </span>
                      <span>·</span>
                      <span className="shrink-0">
                        {formatRelativeTime(live?.updatedAt ?? entry.visitedAt)}
                      </span>
                    </div>
                  </Link>
                )}

                {!isRenaming && (
                  <div className="mr-1 shrink-0">
                    <Menu
                      onAction={(val) => {
                        void handleRowAction(val, entry, live);
                      }}
                    >
                      <MenuTrigger
                        aria-label={`Actions for ${title}`}
                        className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 transition hover:bg-[var(--bg-surface)]/80 hover:text-[var(--text-primary)] sm:h-7 sm:w-7 ${
                          active
                            ? "text-[var(--accent-soft-text)] opacity-90"
                            : "text-[var(--text-muted)] opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 sm:data-open:opacity-100"
                        }`}
                      >
                        <DotsThree size={18} weight="bold" />
                      </MenuTrigger>

                      <MenuContent
                        side={mobileOpen ? "bottom" : "right"}
                        align={mobileOpen ? "end" : "start"}
                        sideOffset={6}
                        className="min-w-48 origin-(--transform-origin) rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-1.5 text-sm shadow-xl shadow-black/15 transition-[opacity,scale] duration-150 data-starting-style:scale-96 data-starting-style:opacity-0 data-ending-style:scale-96 data-ending-style:opacity-0 dark:shadow-black/50"
                      >
                        <MenuItem
                          value="rename"
                          disabled={!targetId && !isDraft}
                          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-primary)] outline-none data-highlighted:bg-[var(--bg-subtle)] data-disabled:opacity-40"
                        >
                          <MenuItemIcon>
                            <PencilSimple size={14} />
                          </MenuItemIcon>
                          Rename
                        </MenuItem>

                        <MenuItem
                          value="copy-code"
                          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-primary)] outline-none data-highlighted:bg-[var(--bg-subtle)]"
                        >
                          <MenuItemIcon>
                            <Copy size={14} />
                          </MenuItemIcon>
                          Copy code ({displayCode})
                        </MenuItem>

                        <MenuItem
                          value="duplicate"
                          disabled={!targetId}
                          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-primary)] outline-none data-highlighted:bg-[var(--bg-subtle)] data-disabled:opacity-40"
                        >
                          <MenuItemIcon>
                            <CopySimple size={14} />
                          </MenuItemIcon>
                          Duplicate
                        </MenuItem>

                        <MenuItem
                          value="share"
                          disabled={!targetId}
                          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-primary)] outline-none data-highlighted:bg-[var(--bg-subtle)] data-disabled:opacity-40"
                        >
                          <MenuItemIcon>
                            <QrCode size={14} weight="duotone" className="text-[var(--accent-primary)]" />
                          </MenuItemIcon>
                          Share / QR
                        </MenuItem>

                        <MenuSeparator className="my-1 h-px bg-[var(--border-subtle)]" />

                        <MenuItem
                          value="remove-list"
                          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-secondary)] outline-none data-highlighted:bg-[var(--bg-subtle)] data-highlighted:text-[var(--text-primary)]"
                        >
                          <MenuItemIcon>
                            <EyeSlash size={14} />
                          </MenuItemIcon>
                          Remove from list
                        </MenuItem>

                        <MenuItem
                          value="delete"
                          destructive
                          className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-[var(--status-danger)] outline-none data-highlighted:bg-[var(--status-danger-soft)]/60"
                        >
                          <MenuItemIcon>
                            <Trash size={14} />
                          </MenuItemIcon>
                          Delete permanently
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Footer: Leave & Clear Browser (safe-area aware on mobile) */}
      <div className="shrink-0 border-t border-[var(--border-subtle)] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-3">
        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onRequestLeaveClear();
          }}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--status-danger)]/40 hover:bg-[var(--status-danger-soft)]/50 hover:text-[var(--status-danger)] active:scale-[0.98]"
        >
          <SignOut size={14} />
          Leave &amp; Clear Browser
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop truly fixed rail (only the inner notes list scrolls) */}
      <aside
        aria-hidden={!desktopOpen}
        className={`print-hidden fixed inset-y-0 left-0 z-40 hidden h-dvh w-64 border-r border-[var(--border-subtle)] bg-[var(--bg-canvas)] transition-transform duration-200 ease-out lg:block ${
          desktopOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
      >
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="print-hidden fixed inset-0 z-50 flex lg:hidden">
          <div
            onClick={onCloseMobile}
            className="animate-fade-in fixed inset-0 bg-black/45 backdrop-blur-[2px]"
            aria-hidden="true"
          />
          <aside className="animate-drawer-in relative z-10 h-full w-72 max-w-[85vw] overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-canvas)] pt-[env(safe-area-inset-top)] shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
