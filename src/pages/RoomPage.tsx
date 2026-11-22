import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { LockKey, Notepad, PlusCircle } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getClientId } from "../lib/clientState";
import { detectDeviceLabel } from "../lib/device";
import {
  decryptClientE2ee,
  deriveRoomE2eeKeyB64,
  encryptClientE2ee,
  isE2eePayload,
} from "../lib/e2ee";
import { validateSlug } from "../lib/parsers";
import { useNotefyUi } from "../lib/uiContext";
import { useDocumentMeta } from "../lib/useDocumentMeta";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { PadEditor } from "../components/PadEditor";
import { SharePairModal } from "../components/SharePairModal";
import { LeaveClearDialog } from "../components/LeaveClearDialog";
import { PinGate } from "../components/PinGateModal";
import { NoteSkeleton, Spinner } from "../components/ui/LoadingStates";

export function RoomPage() {
  const navigate = useNavigate();
  const { code = "" } = useParams<{ code: string }>();
  const {
    touchRecentRoom,
    clearLocalState,
    getRoomSession,
    saveRoomSession,
    getRoomE2ee,
    saveRoomE2ee,
    pushToast,
  } = useNotefyUi();

  const [knownRoomId, setKnownRoomId] = useState<string | null>(null);
  const sessionToken = knownRoomId ? getRoomSession(knownRoomId) : undefined;

  const state = useQuery(api.rooms.getRoomState, { code, sessionToken });
  const createOrClaim = useMutation(api.rooms.createOrClaim);
  const updateTitle = useMutation(api.rooms.updateTitle);
  const updatePad = useMutation(api.rooms.updatePad);
  const deleteRoomMut = useMutation(api.rooms.deleteRoom);
  const unlockRoomAction = useAction(api.security.unlockRoom);
  const heartbeat = useMutation(api.presence.heartbeat);
  const leavePresence = useMutation(api.presence.leave);

  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [inlinePin, setInlinePin] = useState("");
  const [inlinePinError, setInlinePinError] = useState<string | null>(null);
  const [unlockingInline, setUnlockingInline] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [decryptedState, setDecryptedState] = useState<{
    roomId: string;
    title: string;
    padContent: string;
    failed: boolean;
  } | null>(null);

  const currentRoomId =
    state && (state.status === "ready" || state.status === "locked") ? state.room.id : null;

  useEffect(() => {
    if (currentRoomId && currentRoomId !== knownRoomId) {
      setKnownRoomId(currentRoomId);
    }
  }, [currentRoomId, knownRoomId]);

  // Reset knownRoomId when switching to a different route code
  const prevCodeRef = useRef(code);
  useEffect(() => {
    if (prevCodeRef.current !== code) {
      prevCodeRef.current = code;
      setKnownRoomId(null);
      setDecryptedState(null);
      setUnlockOpen(false);
      setInlinePin("");
      setInlinePinError(null);
    }
  }, [code]);

  // Record in recent notes list when ready
  const rawReadyRoom = state?.status === "ready" ? state.room : null;
  const canEdit = state?.status === "ready" ? state.canEdit : false;
  const roomE2eeKey = rawReadyRoom ? getRoomE2ee(rawReadyRoom.id) : undefined;
  const needsE2ee = Boolean(
    rawReadyRoom &&
      (isE2eePayload(rawReadyRoom.title) || isE2eePayload(rawReadyRoom.padContent))
  );

  // Decrypt client-side E2EE payloads transparently when pinScope === "all"
  useEffect(() => {
    if (!rawReadyRoom) {
      setDecryptedState(null);
      return;
    }
    if (!needsE2ee) {
      setDecryptedState(null);
      return;
    }

    let cancelled = false;
    void Promise.all([
      decryptClientE2ee(rawReadyRoom.title, roomE2eeKey),
      decryptClientE2ee(rawReadyRoom.padContent, roomE2eeKey),
    ]).then(([tRes, pRes]) => {
      if (cancelled) return;
      if (!tRes.ok || !pRes.ok) {
        setDecryptedState({
          roomId: rawReadyRoom.id,
          title: "",
          padContent: "",
          failed: true,
        });
      } else {
        setDecryptedState({
          roomId: rawReadyRoom.id,
          title: tRes.text,
          padContent: pRes.text,
          failed: false,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    rawReadyRoom?.id,
    rawReadyRoom?.title,
    rawReadyRoom?.padContent,
    needsE2ee,
    roomE2eeKey,
  ]);

  const e2eeReady =
    !needsE2ee ||
    Boolean(rawReadyRoom && decryptedState?.roomId === rawReadyRoom.id && !decryptedState.failed);

  const readyRoom =
    rawReadyRoom && needsE2ee && decryptedState?.roomId === rawReadyRoom.id && !decryptedState.failed
      ? {
          ...rawReadyRoom,
          title: decryptedState.title,
          padContent: decryptedState.padContent,
        }
      : rawReadyRoom;

  useEffect(() => {
    if (!readyRoom || !e2eeReady) return;
    touchRecentRoom(readyRoom);
  }, [
    readyRoom?.id,
    readyRoom?.code,
    readyRoom?.displayCode,
    readyRoom?.title,
    e2eeReady,
    touchRecentRoom,
  ]);

  const pageTitle =
    readyRoom && e2eeReady && readyRoom.title.trim()
      ? `${readyRoom.title.trim()} — Notefy`
      : readyRoom
        ? `${readyRoom.displayCode} — Notefy`
        : "Notefy";
  useDocumentMeta(pageTitle, { noIndex: true });

  // Live Convex presence heartbeat (25s) + immediate leave on unmount / pagehide
  useEffect(() => {
    if (!readyRoom) return;
    const roomId = readyRoom.id as Id<"rooms">;
    const clientId = getClientId();
    const deviceLabel = detectDeviceLabel();
    const mode = canEdit ? "edit" : "view";

    const sendPing = () => {
      if (document.visibilityState === "hidden") return;
      void heartbeat({ roomId, clientId, deviceLabel, mode });
    };

    sendPing();
    const timer = window.setInterval(sendPing, 25_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") sendPing();
    };
    const onPageHide = () => {
      void leavePresence({ roomId, clientId });
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      void leavePresence({ roomId, clientId });
    };
  }, [readyRoom?.id, canEdit, heartbeat, leavePresence]);

  // Loading state while Convex hydrates
  if (state === undefined) {
    return <NoteSkeleton withSidebar />;
  }

  // Not found
  if (state.status === "not_found") {
    const slugStatus = validateSlug(code);
    return (
      <div className="notefy-dot-grid flex min-h-screen flex-col items-center justify-center bg-[var(--bg-canvas)] px-4">
        <div className="animate-fade-up w-full max-w-md rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-7 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
            <Notepad size={26} weight="duotone" />
          </div>
          {slugStatus === "valid" ? (
            <>
              <h1 className="text-xl font-bold tracking-tight">
                No note found for <span className="font-mono text-[var(--accent-primary)]">{code}</span>
              </h1>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Double-check the access code, or start a new note using this custom link.
              </p>
              <button
                type="button"
                disabled={claiming}
                onClick={async () => {
                  setClaiming(true);
                  try {
                    const res = await createOrClaim({ rawSlug: code });
                    if (res.ok) {
                      touchRecentRoom(res.room);
                      pushToast(`Created note at /${res.room.displayCode}`);
                    } else {
                      pushToast(res.error, { tone: "danger" });
                    }
                  } finally {
                    setClaiming(false);
                  }
                }}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-primary)] px-5 text-sm font-semibold text-white transition hover:bg-[var(--accent-primary-hover)] disabled:opacity-70 dark:text-[#0d1f1d]"
              >
                {claiming ? (
                  <>
                    <Spinner size={16} />
                    Creating…
                  </>
                ) : (
                  <>
                    <PlusCircle size={18} weight="duotone" />
                    Create note at /{code}
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold tracking-tight">Invalid note link</h1>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Access codes and custom links must be 3–40 characters using letters, numbers, and hyphens.
              </p>
            </>
          )}
          <Link
            to="/"
            className="mt-4 inline-block text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            ← Back to Notefy home
          </Link>
        </div>
      </div>
    );
  }

  // Full-note PIN lock
  if (state.status === "locked") {
    return (
      <PinGate
        roomLabel={state.room.displayCode}
        onUnlock={async (pin) => {
          const res = await unlockRoomAction({
            roomId: state.room.id,
            pin,
            clientId: getClientId(),
          });
          if (!res.ok) {
            return { ok: false, error: res.error };
          }
          const e2eeKey = await deriveRoomE2eeKeyB64(pin, state.room.id);
          if (e2eeKey) {
            saveRoomE2ee(state.room.id, e2eeKey);
          }
          if (res.sessionToken) {
            saveRoomSession(state.room.id, res.sessionToken);
          }
          pushToast("Note unlocked");
          return { ok: true };
        }}
      />
    );
  }

  // If server session is valid but client-side E2EE key is missing/mismatched, ask for PIN to decrypt locally
  if (needsE2ee) {
    if (!decryptedState || decryptedState.roomId !== state.room.id) {
      return <NoteSkeleton withSidebar />;
    }
    if (decryptedState.failed) {
      return (
        <PinGate
          roomLabel={state.room.displayCode}
          subtitle="Enter this note's PIN to decrypt it locally on your device."
          onUnlock={async (pin) => {
            const res = await unlockRoomAction({
              roomId: state.room.id,
              pin,
              clientId: getClientId(),
            });
            if (!res.ok) {
              return { ok: false, error: res.error };
            }
            const e2eeKey = await deriveRoomE2eeKeyB64(pin, state.room.id);
            if (e2eeKey) {
              saveRoomE2ee(state.room.id, e2eeKey);
            }
            if (res.sessionToken) {
              saveRoomSession(state.room.id, res.sessionToken);
            }
            pushToast("Note decrypted & unlocked");
            return { ok: true };
          }}
        />
      );
    }
  }

  const room = readyRoom!;
  const presence = state.presence;
  const activeSession = getRoomSession(room.id);

  const handleUpdateTitle = async (title: string) => {
    const payload =
      room.hasPin && room.pinScope === "all" && roomE2eeKey
        ? await encryptClientE2ee(title.trim(), roomE2eeKey)
        : title;
    void updateTitle({
      roomId: room.id,
      title: payload,
      sessionToken: activeSession,
    });
  };

  const handleUpdatePad = async (next: string) => {
    const payload =
      room.hasPin && room.pinScope === "all" && roomE2eeKey
        ? await encryptClientE2ee(next, roomE2eeKey)
        : next;
    void updatePad({
      roomId: room.id,
      padContent: payload,
      sessionToken: activeSession,
    });
  };

  const handleToggleSidebar = () => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setDesktopSidebarOpen((prev) => !prev);
    } else {
      setMobileSidebarOpen((prev) => !prev);
    }
  };

  const handleLeaveOnly = async () => {
    setLeaveDialogOpen(false);
    await leavePresence({ roomId: room.id, clientId: getClientId() }).catch(() => {});
    clearLocalState();
    pushToast("Left & cleared this browser");
    navigate("/", { replace: true });
  };

  const handleDeleteAndLeave = async () => {
    setLeaveDialogOpen(false);
    try {
      await deleteRoomMut({ roomId: room.id, sessionToken: activeSession });
    } catch {
      // ignore if already gone
    }
    clearLocalState();
    pushToast("Deleted note & cleared this browser", { tone: "danger" });
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-[var(--bg-surface)] text-[var(--text-primary)]">
      <Sidebar
        currentRoom={room}
        desktopOpen={desktopSidebarOpen}
        mobileOpen={mobileSidebarOpen}
        onToggleDesktop={() => setDesktopSidebarOpen((o) => !o)}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        onOpenShareForCurrent={() => setShareOpen(true)}
        onRequestLeaveClear={() => setLeaveDialogOpen(true)}
      />

      {/* Full-Width Edge-to-Edge Notepad Column (offset smoothly for fixed desktop sidebar) */}
      <div
        className={`flex min-h-screen min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out ${
          desktopSidebarOpen ? "lg:pl-64" : "lg:pl-0"
        }`}
      >
        <Header
          room={room}
          presence={presence}
          canEdit={canEdit}
          sidebarOpen={desktopSidebarOpen}
          onToggleSidebar={handleToggleSidebar}
          onUpdateTitle={(title) => {
            void handleUpdateTitle(title);
          }}
          onOpenShare={() => setShareOpen(true)}
          onNotify={(msg) => pushToast(msg)}
        />

        {/* Edit-only PIN lock banner */}
        {room.hasPin && !canEdit && (
          <div className="print-hidden border-b border-[var(--border-subtle)] bg-[var(--accent-soft)]/50 px-5 py-2 text-xs sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 font-medium text-[var(--accent-soft-text)]">
                <LockKey size={15} weight="duotone" />
                Viewing only — enter the PIN to edit this note.
              </span>

              {unlockOpen ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (unlockingInline) return;
                    setUnlockingInline(true);
                    try {
                      const res = await unlockRoomAction({
                        roomId: room.id,
                        pin: inlinePin,
                        clientId: getClientId(),
                      });
                      if (!res.ok) {
                        setInlinePinError(res.error);
                      } else {
                        if (res.sessionToken) {
                          saveRoomSession(room.id, res.sessionToken);
                        }
                        setInlinePin("");
                        setInlinePinError(null);
                        setUnlockOpen(false);
                        pushToast("Editing unlocked");
                      }
                    } finally {
                      setUnlockingInline(false);
                    }
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="password"
                    value={inlinePin}
                    disabled={unlockingInline}
                    onChange={(e) => {
                      setInlinePin(e.target.value);
                      if (inlinePinError) setInlinePinError(null);
                    }}
                    placeholder="Enter PIN"
                    autoFocus
                    className="h-7 w-28 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-2 font-mono text-xs text-[var(--text-primary)]"
                  />
                  <button
                    type="submit"
                    disabled={unlockingInline || inlinePin.trim().length < 4}
                    className="inline-flex h-7 items-center gap-1 rounded-lg bg-[var(--accent-primary)] px-2.5 text-xs font-semibold text-white disabled:opacity-50 dark:text-[#0d1f1d]"
                  >
                    {unlockingInline ? <Spinner size={12} /> : "Unlock"}
                  </button>
                  {inlinePinError && (
                    <span className="text-[11px] font-medium text-[var(--status-danger)]">
                      {inlinePinError}
                    </span>
                  )}
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setUnlockOpen(true)}
                  className="rounded-lg bg-[var(--accent-primary)] px-2.5 py-1 text-xs font-semibold text-white dark:text-[#0d1f1d]"
                >
                  Unlock editing
                </button>
              )}
            </div>
          </div>
        )}

        {/* Full-Width Notepad */}
        <main className="flex flex-1 flex-col">
          <PadEditor
            key={room.id}
            value={room.padContent}
            updatedAt={room.padUpdatedAt}
            readOnly={!canEdit}
            onChange={(next) => {
              void handleUpdatePad(next);
            }}
            onCopied={() => pushToast("Copied note to clipboard")}
          />
        </main>
      </div>

      <SharePairModal
        room={room}
        open={shareOpen}
        onOpenChange={setShareOpen}
        canEdit={canEdit}
        onRequestLeaveClear={() => setLeaveDialogOpen(true)}
      />

      <LeaveClearDialog
        room={room}
        canDeleteCurrent={canEdit}
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        onLeaveOnly={() => void handleLeaveOnly()}
        onDeleteAndLeave={() => void handleDeleteAndLeave()}
      />
    </div>
  );
}
