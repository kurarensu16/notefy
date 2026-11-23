import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ui-sdk/react/dialog";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";
import { Switch, SwitchThumb } from "@ui-sdk/react/switch";
import {
  ArrowsClockwise,
  ArrowSquareOut,
  Check,
  CheckCircle,
  CloudSlash,
  Copy,
  Eye,
  EyeSlash,
  Key,
  LockKey,
  LockKeyOpen,
  PencilSimple,
  PencilSimpleSlash,
  Presentation,
  QrCode,
  ShareNetwork,
  ShieldCheck,
  SignOut,
  Timer,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { NotefyRoom, PinScope, RoomExpiryMode } from "../types";
import { copyTextToClipboard, getPublicOrigin } from "../lib/device";
import { deriveRoomE2eeKeyB64, encryptClientE2ee } from "../lib/e2ee";
import { isOfflineDraftCode } from "../lib/offlineStore";
import { useNotefyUi } from "../lib/uiContext";
import { formatCountdown } from "../lib/parsers";
import { QrCodeBox } from "./QrCodeBox";
import { Spinner } from "./ui/LoadingStates";

interface SharePairModalProps {
  room: NotefyRoom;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
  onRequestLeaveClear: () => void;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function SharePairModal({
  room,
  open,
  onOpenChange,
  canEdit: canEditProp,
  onRequestLeaveClear,
}: SharePairModalProps) {
  const navigate = useNavigate();
  const updateSlugMut = useMutation(api.rooms.updateSlug);
  const regenerateEditMut = useMutation(api.rooms.regenerateEditCode);
  const updateReadOnlyMut = useMutation(api.rooms.updateReadOnly);
  const setRoomExpiryMut = useMutation(api.rooms.setRoomExpiry);
  const updateTitleMut = useMutation(api.rooms.updateTitle);
  const updatePadMut = useMutation(api.rooms.updatePad);
  const setPinAction = useAction(api.security.setPin);
  const removePinAction = useAction(api.security.removePin);

  const {
    isOnline,
    pushToast,
    getRoomSession,
    saveRoomSession,
    clearRoomSession,
    saveRoomE2ee,
    clearRoomE2ee,
    forgetRecentRoom,
    touchRecentRoom,
  } = useNotefyUi();

  const isDraft = isOfflineDraftCode(room.code);
  const canEdit = canEditProp && isOnline && !isDraft;
  const roomId = room.id as Id<"rooms">;
  const sessionToken = getRoomSession(room.id);

  const origin = getPublicOrigin();
  const editUrl = `${origin}/${room.displayCode}`;
  const readOnlyUrl = `${origin}/view/${room.readOnlyCode}`;
  const supportsNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const [tab, setTab] = useState<string>("sync");
  const [editCustomOpen, setEditCustomOpen] = useState(false);
  const [slugInput, setSlugInput] = useState(room.displayCode);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [savingSlug, setSavingSlug] = useState(false);
  const [rotatingEdit, setRotatingEdit] = useState(false);

  const [viewCustomOpen, setViewCustomOpen] = useState(false);
  const [viewSlugInput, setViewSlugInput] = useState(room.readOnlyCode);
  const [viewSlugError, setViewSlugError] = useState<string | null>(null);
  const [savingViewSlug, setSavingViewSlug] = useState(false);
  const [rotatingView, setRotatingView] = useState(false);

  const [pinInput, setPinInput] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinScope, setPinScope] = useState<PinScope>(room.pinScope);
  const [pinError, setPinError] = useState<string | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setSlugInput(room.displayCode);
    setViewSlugInput(room.readOnlyCode);
    setPinScope(room.pinScope);
    if (!open) {
      setEditCustomOpen(false);
      setViewCustomOpen(false);
      setSlugError(null);
      setViewSlugError(null);
      setPinError(null);
      setShowPin(false);
    }
  }, [room.displayCode, room.readOnlyCode, room.pinScope, open]);

  // Live debounced availability checks
  const debouncedEditSlug = useDebouncedValue(slugInput, 220);
  const editAvail = useQuery(
    api.rooms.checkCodeAvailability,
    open && editCustomOpen && !isDraft && isOnline && debouncedEditSlug.trim()
      ? { rawSlug: debouncedEditSlug, excludeRoomId: roomId, mode: "edit" }
      : "skip"
  );

  const debouncedViewSlug = useDebouncedValue(viewSlugInput, 220);
  const viewAvail = useQuery(
    api.rooms.checkCodeAvailability,
    open && viewCustomOpen && !isDraft && isOnline && debouncedViewSlug.trim()
      ? { rawSlug: debouncedViewSlug, excludeRoomId: roomId, mode: "readonly" }
      : "skip"
  );

  const copyValue = async (key: string, val: string, label: string) => {
    const ok = await copyTextToClipboard(val);
    if (ok) {
      setCopiedKey(key);
      pushToast(label);
      window.setTimeout(() => setCopiedKey(null), 1600);
    }
  };

  const handleNativeShare = async (url: string, code: string, modeText: string) => {
    try {
      await navigator.share({
        title: room.title || `Notefy (${code})`,
        text: `${modeText} — Access code: ${code.toUpperCase()}`,
        url,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  const handleSaveSlug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || savingSlug) return;
    setSavingSlug(true);
    try {
      const oldCode = room.code;
      const res = await updateSlugMut({
        roomId,
        newSlugRaw: slugInput,
        sessionToken,
      });
      if (!res.ok) {
        setSlugError(res.error);
        return;
      }
      setSlugError(null);
      setEditCustomOpen(false);
      if (oldCode !== res.room.code) forgetRecentRoom(oldCode);
      touchRecentRoom(res.room);
      pushToast(`Updated access code to ${res.room.displayCode}`);
      navigate(`/${res.room.displayCode}`, { replace: true });
    } finally {
      setSavingSlug(false);
    }
  };

  const handleRegenerateEdit = async () => {
    if (!canEdit || rotatingEdit) return;
    setRotatingEdit(true);
    try {
      const oldCode = room.code;
      const res = await regenerateEditMut({ roomId, sessionToken });
      if (!res.ok) {
        pushToast(res.error, { tone: "danger" });
        return;
      }
      if (oldCode !== res.room.code) forgetRecentRoom(oldCode);
      touchRecentRoom(res.room);
      setSlugInput(res.room.displayCode);
      setSlugError(null);
      pushToast(`Rotated edit code to ${res.room.displayCode} (old link revoked)`);
      navigate(`/${res.room.displayCode}`, { replace: true });
    } finally {
      setRotatingEdit(false);
    }
  };

  const handleSaveViewSlug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || savingViewSlug) return;
    setSavingViewSlug(true);
    try {
      const res = await updateReadOnlyMut({
        roomId,
        customCode: viewSlugInput,
        sessionToken,
      });
      if (!res.ok) {
        setViewSlugError(res.error);
        return;
      }
      setViewSlugError(null);
      setViewCustomOpen(false);
      pushToast(`Updated read-only code to ${res.room.readOnlyCode.toUpperCase()}`);
    } finally {
      setSavingViewSlug(false);
    }
  };

  const handleRegenerateView = async () => {
    if (!canEdit || rotatingView) return;
    setRotatingView(true);
    try {
      const res = await updateReadOnlyMut({
        roomId,
        regenerate: true,
        sessionToken,
      });
      if (res.ok) {
        setViewSlugInput(res.room.readOnlyCode);
        setViewSlugError(null);
        pushToast(`New read-only code: ${res.room.readOnlyCode.toUpperCase()} (old revoked)`);
      }
    } finally {
      setRotatingView(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || savingPin) return;
    setSavingPin(true);
    try {
      const prevWasFullLock = room.hasPin && room.pinScope === "all";
      const plainTitle = room.title;
      const plainPad = room.padContent;

      const res = await setPinAction({
        roomId,
        pin: pinInput,
        scope: pinScope,
        sessionToken,
      });
      if (!res.ok) {
        setPinError(res.error);
        return;
      }
      saveRoomSession(room.id, res.sessionToken);

      if (pinScope === "all") {
        const keyB64 = await deriveRoomE2eeKeyB64(pinInput, room.id);
        if (keyB64) {
          saveRoomE2ee(room.id, keyB64);
          const [encTitle, encPad] = await Promise.all([
            encryptClientE2ee(plainTitle.trim(), keyB64),
            encryptClientE2ee(plainPad, keyB64),
          ]);
          await Promise.all([
            updateTitleMut({
              roomId,
              title: encTitle,
              sessionToken: res.sessionToken,
            }),
            updatePadMut({
              roomId,
              padContent: encPad,
              sessionToken: res.sessionToken,
            }),
          ]);
        }
      } else {
        clearRoomE2ee(room.id);
        if (prevWasFullLock) {
          await Promise.all([
            updateTitleMut({
              roomId,
              title: plainTitle,
              sessionToken: res.sessionToken,
            }),
            updatePadMut({
              roomId,
              padContent: plainPad,
              sessionToken: res.sessionToken,
            }),
          ]);
        }
      }

      setPinError(null);
      setPinInput("");
      setShowPin(false);
      pushToast(
        pinScope === "all"
          ? "PIN lock & End-to-End Encryption enabled"
          : "PIN lock enabled for editing"
      );
    } finally {
      setSavingPin(false);
    }
  };

  const handleRemovePin = async () => {
    if (!canEdit || savingPin) return;
    setSavingPin(true);
    try {
      const wasFullLock = room.pinScope === "all";
      const plainTitle = room.title;
      const plainPad = room.padContent;

      const res = await removePinAction({ roomId, sessionToken });
      if (res.ok) {
        if (wasFullLock) {
          await Promise.all([
            updateTitleMut({ roomId, title: plainTitle }),
            updatePadMut({ roomId, padContent: plainPad }),
          ]);
        }
        clearRoomSession(room.id);
        clearRoomE2ee(room.id);
        pushToast("PIN lock removed");
      } else {
        setPinError(res.error);
      }
    } finally {
      setSavingPin(false);
    }
  };

  const renderAvailabilityHint = (
    avail: { status: "empty" | "reserved" | "invalid" | "same" | "taken" | "available"; normalized: string } | undefined,
    fallbackError: string | null
  ) => {
    if (fallbackError) {
      return (
        <p className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--status-danger)]">
          <WarningCircle size={13} weight="duotone" />
          {fallbackError}
        </p>
      );
    }
    if (!avail || avail.status === "empty" || avail.status === "same") return null;
    if (avail.status === "available") {
      return (
        <p className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-primary)]">
          <CheckCircle size={13} weight="duotone" />
          <span className="font-mono">{avail.normalized}</span> is available
        </p>
      );
    }
    if (avail.status === "taken") {
      return (
        <p className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--status-danger)]">
          <WarningCircle size={13} weight="duotone" />
          Already in use
        </p>
      );
    }
    if (avail.status === "reserved") {
      return (
        <p className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--status-danger)]">
          <WarningCircle size={13} weight="duotone" />
          Reserved path
        </p>
      );
    }
    return (
      <p className="text-[11px] text-[var(--text-muted)]">
        Use 3–40 letters, numbers, or single hyphens.
      </p>
    );
  };

  const expiryOptions: Array<{ value: RoomExpiryMode; label: string }> = [
    { value: "never", label: "Never" },
    { value: "24h", label: "24 hours" },
    { value: "7d", label: "7 days" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogBackdrop className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0" />
      <DialogContent className="fixed inset-x-0 bottom-0 top-auto left-0 z-50 m-0 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl rounded-b-none border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] p-0 text-[var(--text-primary)] shadow-2xl transition-all duration-200 data-starting-style:translate-y-6 data-starting-style:opacity-0 data-ending-style:translate-y-6 data-ending-style:opacity-0 sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:max-h-[90vh] sm:w-[min(94vw,35rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border sm:data-starting-style:translate-y-0 sm:data-starting-style:scale-96 sm:data-ending-style:translate-y-0 sm:data-ending-style:scale-96">
        {/* Mobile bottom-sheet grabber pill */}
        <div className="flex justify-center pt-2.5 pb-0.5 sm:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-[var(--border-strong)]/80" />
        </div>

        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-subtle)] px-5 pt-3.5 pb-3.5 sm:px-6 sm:pt-5 sm:pb-4">
          <div>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <QrCode size={20} weight="duotone" className="text-[var(--accent-primary)]" />
              Share &amp; Sync Note
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-[var(--text-secondary)]">
              Scan the QR, enter the 4-character code, or send a direct link.
            </DialogDescription>
          </div>
          <DialogClose
            aria-label="Close modal"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-xl text-[var(--text-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
          >
            <X size={18} weight="bold" />
          </DialogClose>
        </div>

        {/* Offline Draft View or Full Share Tabs */}
        {isDraft ? (
          <div className="px-5 pt-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
            <div className="rounded-2xl border border-[var(--status-burn)]/30 bg-[var(--status-burn-soft)]/50 p-5 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--bg-surface)] text-[var(--status-burn)] shadow-2xs">
                <CloudSlash size={22} weight="duotone" />
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)]">
                Saved as an offline draft
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                You&rsquo;re currently offline, so this note doesn&rsquo;t have a 4-character access
                code yet. Keep writing — the moment you reconnect, Notefy will automatically assign
                a unique code and unlock QR sharing.
              </p>
            </div>
            <div className="mt-4 border-t border-[var(--border-subtle)] pt-3">
              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onRequestLeaveClear();
                }}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--status-danger)]/40 bg-[var(--status-danger-soft)]/50 px-4 text-xs font-semibold text-[var(--status-danger)] transition hover:bg-[var(--status-danger-soft)]"
              >
                <SignOut size={16} weight="bold" />
                Leave &amp; Clear This Browser
              </button>
            </div>
          </div>
        ) : (
        <Tabs
          value={tab}
          onValueChange={(next) => next && setTab(next)}
          className="flex min-h-0 flex-1 flex-col"
        >
          {!isOnline && (
            <div className="flex items-center gap-2 border-b border-[var(--status-burn)]/25 bg-[var(--status-burn-soft)]/60 px-5 py-2 text-[11px] font-medium text-[var(--status-burn)] sm:px-6">
              <CloudSlash size={14} weight="duotone" className="shrink-0" />
              <span>You&rsquo;re offline — you can copy links, but changing codes or security requires internet.</span>
            </div>
          )}
          <TabsList
            aria-label="Share options"
            className="grid grid-cols-3 gap-1 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 p-1.5 px-4 sm:px-6"
          >
            <TabsTab
              value="sync"
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] data-selected:bg-[var(--bg-surface)] data-selected:text-[var(--text-primary)] data-selected:shadow-xs"
            >
              <Key size={15} weight="duotone" />
              Code &amp; Edit
            </TabsTab>
            <TabsTab
              value="readonly"
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] data-selected:bg-[var(--bg-surface)] data-selected:text-[var(--text-primary)] data-selected:shadow-xs"
            >
              <Eye size={15} weight="duotone" />
              Read-Only
            </TabsTab>
            <TabsTab
              value="security"
              className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] data-selected:bg-[var(--bg-surface)] data-selected:text-[var(--text-primary)] data-selected:shadow-xs"
            >
              <ShieldCheck size={15} weight="duotone" />
              Security
            </TabsTab>
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
            {/* TAB 1: COMPACT EDIT & SYNC */}
            <TabsPanel value="sync" className="animate-fade-in space-y-4 outline-none">
              <div className="flex flex-col items-center gap-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70 p-4 sm:flex-row sm:items-stretch">
                <QrCodeBox
                  value={editUrl}
                  size={144}
                  filename={`notefy-${room.code}-card.png`}
                  brandedCard={{
                    code: room.displayCode,
                    title: room.title || "Untitled Note",
                    modeLabel: "EDIT & SYNC",
                  }}
                  onNotify={(msg) => pushToast(msg)}
                  className="shrink-0"
                />

                <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 text-center sm:text-left">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Access Code (View &amp; Edit)
                    </div>
                    <div className="mt-1.5 flex items-center justify-center gap-1.5 sm:justify-start">
                      <button
                        type="button"
                        onClick={() => void copyValue("code", room.displayCode, "Access code copied")}
                        title="Click to copy access code"
                        className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-surface)] px-3.5 py-1.5 font-mono text-xl font-bold tracking-wider text-[var(--text-primary)] ring-1 ring-[var(--border-subtle)] transition hover:ring-[var(--accent-primary)]"
                      >
                        {room.displayCode}
                        {copiedKey === "code" ? (
                          <Check size={15} weight="bold" className="animate-pop-in text-[var(--accent-primary)]" />
                        ) : (
                          <Copy size={15} className="text-[var(--text-muted)]" />
                        )}
                      </button>

                      {canEdit && (
                        <button
                          type="button"
                          disabled={rotatingEdit}
                          onClick={() => void handleRegenerateEdit()}
                          title="Generate a new 4-character code (revokes old code)"
                          aria-label="Regenerate edit access code"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:opacity-50"
                        >
                          {rotatingEdit ? (
                            <Spinner size={15} />
                          ) : (
                            <ArrowsClockwise size={16} />
                          )}
                        </button>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                      Enter this code on another device or scan the QR to sync edits live.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                    <button
                      type="button"
                      onClick={() => void copyValue("edit-url", editUrl, "Share link copied")}
                      className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-[var(--accent-primary-hover)] active:scale-[0.98] dark:text-[#0d1f1d]"
                    >
                      {copiedKey === "edit-url" ? (
                        <Check size={14} weight="bold" className="animate-pop-in" />
                      ) : (
                        <Copy size={14} />
                      )}
                      {copiedKey === "edit-url" ? "Link Copied" : "Copy Link"}
                    </button>

                    {supportsNativeShare && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleNativeShare(editUrl, room.displayCode, "Edit live on Notefy")
                        }
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-subtle)]"
                      >
                        <ShareNetwork size={14} weight="duotone" />
                        Share
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Compact Direct URL & Expandable Custom Link */}
              <div className="space-y-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs text-[var(--text-secondary)]">
                    {editUrl}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditCustomOpen((v) => !v);
                        setSlugError(null);
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--accent-primary)] transition hover:bg-[var(--accent-soft)]/60"
                    >
                      <PencilSimple size={12} weight="bold" />
                      {editCustomOpen ? "Cancel" : "Customize"}
                    </button>
                  )}
                </div>

                {canEdit && editCustomOpen && (
                  <form
                    onSubmit={(e) => void handleSaveSlug(e)}
                    className="animate-fade-in space-y-1.5 border-t border-[var(--border-subtle)] pt-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 min-w-0 flex-1 items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 focus-within:border-[var(--accent-primary)]">
                        <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">/</span>
                        <input
                          type="text"
                          value={slugInput}
                          disabled={savingSlug}
                          autoFocus
                          onChange={(e) => {
                            setSlugInput(e.target.value);
                            if (slugError) setSlugError(null);
                          }}
                          placeholder="my-custom-link"
                          className="w-full bg-transparent pl-0.5 font-mono text-base text-[var(--text-primary)] focus:outline-none sm:text-xs"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={
                          savingSlug ||
                          slugInput.trim() === room.displayCode ||
                          (editAvail !== undefined &&
                            editAvail.status !== "available" &&
                            editAvail.status !== "same")
                        }
                        className="inline-flex h-9 min-w-[4rem] shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-white transition hover:bg-[var(--accent-primary-hover)] disabled:opacity-45 dark:text-[#0d1f1d]"
                      >
                        {savingSlug ? <Spinner size={13} /> : "Save"}
                      </button>
                    </div>
                    {renderAvailabilityHint(editAvail, slugError)}
                  </form>
                )}
              </div>
            </TabsPanel>

            {/* TAB 2: COMPACT READ-ONLY SHOWCASE */}
            <TabsPanel value="readonly" className="animate-fade-in space-y-4 outline-none">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    Read-Only View Link &amp; Code
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    Viewers see live updates and can copy or save their own copy—never edit yours.
                  </p>
                </div>
                <Switch
                  checked={room.readOnlyEnabled}
                  disabled={!canEdit}
                  aria-label="Enable read-only sharing"
                  onCheckedChange={(checked) => {
                    void updateReadOnlyMut({
                      roomId,
                      enabled: checked,
                      sessionToken,
                    }).then(() => {
                      pushToast(
                        checked ? "Read-only share link enabled" : "Read-only share link paused"
                      );
                    });
                  }}
                  className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-[var(--border-strong)] p-0.5 transition-colors data-checked:bg-[var(--accent-primary)] disabled:opacity-50"
                >
                  <SwitchThumb className="block h-5 w-5 rounded-full bg-white shadow-xs transition-transform data-checked:translate-x-5" />
                </Switch>
              </div>

              {room.readOnlyEnabled ? (
                <>
                  <div className="flex flex-col items-center gap-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]/70 p-4 sm:flex-row sm:items-stretch">
                    <QrCodeBox
                      value={readOnlyUrl}
                      size={144}
                      filename={`notefy-view-${room.readOnlyCode}-card.png`}
                      brandedCard={{
                        code: room.readOnlyCode.toUpperCase(),
                        title: room.title || "Shared Note",
                        modeLabel: "READ-ONLY VIEW",
                      }}
                      onNotify={(msg) => pushToast(msg)}
                      className="shrink-0"
                    />

                    <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 text-center sm:text-left">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                          Read-Only Code
                        </div>
                        <div className="mt-1.5 flex items-center justify-center gap-1.5 sm:justify-start">
                          <button
                            type="button"
                            onClick={() =>
                              void copyValue(
                                "ro-code",
                                room.readOnlyCode.toUpperCase(),
                                "Read-only code copied"
                              )
                            }
                            className="inline-flex items-center gap-2 rounded-xl bg-[var(--bg-surface)] px-3.5 py-1.5 font-mono text-xl font-bold tracking-wider uppercase text-[var(--text-primary)] ring-1 ring-[var(--border-subtle)] transition hover:ring-[var(--accent-primary)]"
                          >
                            {room.readOnlyCode}
                            {copiedKey === "ro-code" ? (
                              <Check size={15} weight="bold" className="animate-pop-in text-[var(--accent-primary)]" />
                            ) : (
                              <Copy size={15} className="text-[var(--text-muted)]" />
                            )}
                          </button>

                          {canEdit && (
                            <button
                              type="button"
                              disabled={rotatingView}
                              onClick={() => void handleRegenerateView()}
                              title="Regenerate read-only code (revokes old link)"
                              aria-label="Regenerate read-only code"
                              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] disabled:opacity-50"
                            >
                              {rotatingView ? <Spinner size={15} /> : <ArrowsClockwise size={16} />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              void copyValue("ro-url", readOnlyUrl, "Read-only link copied")
                            }
                            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 text-xs font-semibold text-white transition hover:bg-[var(--accent-primary-hover)] dark:text-[#0d1f1d]"
                          >
                            {copiedKey === "ro-url" ? (
                              <Check size={14} weight="bold" className="animate-pop-in" />
                            ) : (
                              <Copy size={14} />
                            )}
                            {copiedKey === "ro-url" ? "Copied" : "Copy Link"}
                          </button>

                          {supportsNativeShare && (
                            <button
                              type="button"
                              onClick={() =>
                                void handleNativeShare(
                                  readOnlyUrl,
                                  room.readOnlyCode,
                                  "View live note on Notefy"
                                )
                              }
                              aria-label="Share read-only link"
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--text-primary)] transition hover:bg-[var(--bg-subtle)]"
                            >
                              <ShareNetwork size={15} weight="duotone" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onOpenChange(false);
                              navigate(`/view/${room.readOnlyCode}`);
                            }}
                            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-[11px] font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-subtle)]"
                          >
                            <ArrowSquareOut size={13} />
                            Open View
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onOpenChange(false);
                              navigate(`/view/${room.readOnlyCode}?presenter=1`);
                            }}
                            className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--accent-primary)]/35 bg-[var(--accent-soft)]/70 px-2.5 text-[11px] font-semibold text-[var(--accent-soft-text)] transition hover:bg-[var(--accent-soft)]"
                          >
                            <Presentation size={13} weight="duotone" />
                            Presenter
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Compact Read-Only URL & Expandable Custom Slug */}
                  <div className="space-y-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs text-[var(--text-secondary)]">
                        {readOnlyUrl}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setViewCustomOpen((v) => !v);
                            setViewSlugError(null);
                          }}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[var(--accent-primary)] transition hover:bg-[var(--accent-soft)]/60"
                        >
                          <PencilSimple size={12} weight="bold" />
                          {viewCustomOpen ? "Cancel" : "Customize"}
                        </button>
                      )}
                    </div>

                    {canEdit && viewCustomOpen && (
                      <form
                        onSubmit={(e) => void handleSaveViewSlug(e)}
                        className="animate-fade-in space-y-1.5 border-t border-[var(--border-subtle)] pt-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 min-w-0 flex-1 items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 focus-within:border-[var(--accent-primary)]">
                            <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">
                              /view/
                            </span>
                            <input
                              type="text"
                              value={viewSlugInput}
                              disabled={savingViewSlug}
                              autoFocus
                              onChange={(e) => {
                                setViewSlugInput(e.target.value);
                                if (viewSlugError) setViewSlugError(null);
                              }}
                              placeholder="workshop-notes"
                              className="w-full bg-transparent pl-0.5 font-mono text-base text-[var(--text-primary)] focus:outline-none sm:text-xs"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={
                              savingViewSlug ||
                              viewSlugInput.trim().toLowerCase() === room.readOnlyCode ||
                              (viewAvail !== undefined &&
                                viewAvail.status !== "available" &&
                                viewAvail.status !== "same")
                            }
                            className="inline-flex h-9 min-w-[4rem] shrink-0 items-center justify-center rounded-xl bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-white transition hover:bg-[var(--accent-primary-hover)] disabled:opacity-45 dark:text-[#0d1f1d]"
                          >
                            {savingViewSlug ? <Spinner size={13} /> : "Save"}
                          </button>
                        </div>
                        {renderAvailabilityHint(viewAvail, viewSlugError)}
                      </form>
                    )}
                  </div>
                </>
              ) : (
                <p className="rounded-xl border border-dashed border-[var(--border-strong)] p-5 text-center text-xs text-[var(--text-secondary)]">
                  Read-only sharing is off. Toggle it on above to generate a live showcase link and QR code.
                </p>
              )}
            </TabsPanel>

            {/* TAB 3: SECURITY */}
            <TabsPanel value="security" className="animate-fade-in space-y-3.5 outline-none">
              {/* Compact unified encryption status strip */}
              <div className="flex items-center gap-2.5 rounded-xl border border-[var(--accent-primary)]/20 bg-[var(--accent-soft)]/45 px-3.5 py-2.5">
                <ShieldCheck
                  size={17}
                  weight="duotone"
                  className="shrink-0 text-[var(--accent-primary)]"
                />
                <p className="text-[11px] leading-snug text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--accent-soft-text)]">
                    {room.hasPin && room.pinScope === "all"
                      ? "End-to-End Encrypted"
                      : "Encrypted at rest (AES-256)"}
                  </span>
                  {" · "}
                  {room.hasPin && room.pinScope === "all"
                    ? "Only devices with your PIN can read this note."
                    : "Choose “Lock entire note” below for zero-knowledge E2EE."}
                </p>
              </div>

              {/* PIN Lock Card */}
              <div className="space-y-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]/65 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        room.hasPin
                          ? "bg-[var(--accent-soft)] text-[var(--accent-primary)]"
                          : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                      }`}
                    >
                      {room.hasPin ? (
                        <LockKey size={17} weight="duotone" />
                      ) : (
                        <LockKeyOpen size={17} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">
                          PIN Lock
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                            room.hasPin
                              ? "bg-[var(--accent-soft)] text-[var(--accent-soft-text)]"
                              : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                          }`}
                        >
                          {room.hasPin
                            ? room.pinScope === "all"
                              ? "E2EE"
                              : "Edit Lock"
                            : "Off"}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-[var(--text-secondary)]">
                        {room.hasPin
                          ? room.pinScope === "all"
                            ? "Hidden behind PIN · End-to-end encrypted"
                            : "Anyone can view · PIN required to edit"
                          : "Require a PIN to edit or unlock this note"}
                      </div>
                    </div>
                  </div>

                  {room.hasPin && canEdit && (
                    <button
                      type="button"
                      disabled={savingPin}
                      onClick={() => void handleRemovePin()}
                      className="shrink-0 rounded-lg border border-[var(--status-danger)]/30 bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--status-danger)] transition hover:bg-[var(--status-danger-soft)]/70 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {canEdit && (
                  <form onSubmit={(e) => void handleSavePin(e)} className="space-y-3">
                    {/* Two descriptive mode cards */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPinScope("edit")}
                        className={`group flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition ${
                          pinScope === "edit"
                            ? "border-[var(--accent-primary)] bg-[var(--bg-surface)] ring-1 ring-[var(--accent-primary)]/20 shadow-2xs"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/45 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)]"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-1">
                          <PencilSimpleSlash
                            size={15}
                            weight={pinScope === "edit" ? "duotone" : "regular"}
                            className={
                              pinScope === "edit"
                                ? "text-[var(--accent-primary)]"
                                : "text-[var(--text-muted)]"
                            }
                          />
                          {pinScope === "edit" && (
                            <Check size={13} weight="bold" className="text-[var(--accent-primary)]" />
                          )}
                        </div>
                        <div className="text-xs font-semibold text-[var(--text-primary)]">
                          Lock edits only
                        </div>
                        <div className="text-[10px] leading-snug text-[var(--text-secondary)]">
                          Anyone can view, PIN to edit
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setPinScope("all")}
                        className={`group flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition ${
                          pinScope === "all"
                            ? "border-[var(--accent-primary)] bg-[var(--bg-surface)] ring-1 ring-[var(--accent-primary)]/20 shadow-2xs"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface)]/45 hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)]"
                        }`}
                      >
                        <div className="flex w-full items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            <ShieldCheck
                              size={15}
                              weight={pinScope === "all" ? "duotone" : "regular"}
                              className={
                                pinScope === "all"
                                  ? "text-[var(--accent-primary)]"
                                  : "text-[var(--text-muted)]"
                              }
                            />
                            <span className="rounded bg-[var(--accent-soft)] px-1 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-[var(--accent-soft-text)]">
                              E2EE
                            </span>
                          </div>
                          {pinScope === "all" && (
                            <Check size={13} weight="bold" className="text-[var(--accent-primary)]" />
                          )}
                        </div>
                        <div className="text-xs font-semibold text-[var(--text-primary)]">
                          Lock entire note
                        </div>
                        <div className="text-[10px] leading-snug text-[var(--text-secondary)]">
                          Hidden &amp; end-to-end encrypted
                        </div>
                      </button>
                    </div>

                    {/* PIN Input with visibility toggle + crisp action button */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 min-w-0 flex-1 items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] pl-3 pr-1.5 transition focus-within:border-[var(--accent-primary)] focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/15">
                          <input
                            type={showPin ? "text" : "password"}
                            autoComplete="new-password"
                            value={pinInput}
                            disabled={savingPin}
                            onChange={(e) => {
                              setPinInput(e.target.value);
                              if (pinError) setPinError(null);
                            }}
                            placeholder={
                              room.hasPin
                                ? "Enter new PIN or passphrase"
                                : "Enter PIN or passphrase (4+ chars)"
                            }
                            className="w-full min-w-0 bg-transparent font-mono text-base text-[var(--text-primary)] placeholder:font-sans placeholder:text-sm placeholder:text-[var(--text-muted)] focus:outline-none sm:text-xs sm:placeholder:text-xs"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => setShowPin((v) => !v)}
                            aria-label={showPin ? "Hide PIN" : "Show PIN"}
                            title={showPin ? "Hide PIN" : "Show PIN"}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
                          >
                            {showPin ? <EyeSlash size={15} /> : <Eye size={15} />}
                          </button>
                        </div>

                        <button
                          type="submit"
                          disabled={pinInput.trim().length < 4 || savingPin}
                          className={`inline-flex h-10 min-w-[5rem] shrink-0 items-center justify-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition ${
                            pinInput.trim().length >= 4 && !savingPin
                              ? "bg-[var(--accent-primary)] text-white shadow-2xs hover:bg-[var(--accent-primary-hover)] active:scale-[0.98] dark:text-[#0d1f1d]"
                              : "cursor-not-allowed bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                          }`}
                        >
                          {savingPin ? (
                            <Spinner size={14} />
                          ) : (
                            <>
                              <LockKey size={13} weight="bold" />
                              {room.hasPin ? "Update" : "Lock"}
                            </>
                          )}
                        </button>
                      </div>

                      {pinError ? (
                        <p className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--status-danger)]">
                          <WarningCircle size={13} weight="duotone" />
                          {pinError}
                        </p>
                      ) : pinScope === "all" ? (
                        <p className="text-[11px] text-[var(--text-muted)]">
                          Save this PIN — end-to-end encrypted notes can&rsquo;t be recovered without it.
                        </p>
                      ) : null}
                    </div>
                  </form>
                )}
              </div>

              {/* Auto-Expiry Card */}
              <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]/65 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors ${
                        room.expiresAt
                          ? "bg-[var(--status-burn-soft)] text-[var(--status-burn)]"
                          : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                      }`}
                    >
                      <Timer size={17} weight={room.expiresAt ? "duotone" : "regular"} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">
                        Auto-Expiry
                      </div>
                      <div className="text-[11px] text-[var(--text-secondary)]">
                        {room.expiresAt
                          ? `Note self-destructs in ${formatCountdown(room.expiresAt)}`
                          : "Note stays active until you delete it"}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
                      room.expiresAt
                        ? "bg-[var(--status-burn-soft)] text-[var(--status-burn)]"
                        : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                    }`}
                  >
                    {room.expiresAt ? formatCountdown(room.expiresAt) : "Off"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-[var(--bg-subtle)] p-1">
                  {expiryOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={!canEdit}
                      onClick={() => {
                        void setRoomExpiryMut({
                          roomId,
                          mode: opt.value,
                          sessionToken,
                        }).then(() => {
                          pushToast(
                            opt.value === "never"
                              ? "Auto-expiry turned off"
                              : `Note will auto-delete in ${opt.label}`
                          );
                        });
                      }}
                      className={`rounded-lg py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                        room.roomExpiryMode === opt.value
                          ? "bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-[var(--border-subtle)] pt-3">
                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onRequestLeaveClear();
                  }}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[var(--status-danger)]/40 bg-[var(--status-danger-soft)]/50 px-4 text-xs font-semibold text-[var(--status-danger)] transition hover:bg-[var(--status-danger-soft)]"
                >
                  <SignOut size={16} weight="bold" />
                  Leave &amp; Clear This Browser
                </button>
              </div>
            </TabsPanel>
          </div>
        </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
