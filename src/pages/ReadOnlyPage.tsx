import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { CopySimple, Eye, Notepad, Presentation } from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getClientId } from "../lib/clientState";
import { detectDeviceLabel } from "../lib/device";
import {
  decryptClientE2ee,
  deriveRoomE2eeKeyB64,
  isE2eePayload,
} from "../lib/e2ee";
import { useNotefyUi } from "../lib/uiContext";
import { useDocumentMeta } from "../lib/useDocumentMeta";
import { PadEditor } from "../components/PadEditor";
import { ExportMenu } from "../components/ExportMenu";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { PresenterView } from "../components/PresenterView";
import { PinGate } from "../components/PinGateModal";
import { NoteSkeleton, Spinner } from "../components/ui/LoadingStates";

export function ReadOnlyPage() {
  const navigate = useNavigate();
  const { shareCode = "" } = useParams<{ shareCode: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    getRoomSession,
    saveRoomSession,
    getRoomE2ee,
    saveRoomE2ee,
    touchRecentRoom,
    pushToast,
  } = useNotefyUi();

  const [knownRoomId, setKnownRoomId] = useState<string | null>(null);
  const sessionToken = knownRoomId ? getRoomSession(knownRoomId) : undefined;

  const state = useQuery(api.rooms.getReadOnlyState, { shareCode, sessionToken });
  const duplicateMut = useMutation(api.rooms.duplicate);
  const unlockRoomAction = useAction(api.security.unlockRoom);
  const heartbeat = useMutation(api.presence.heartbeat);
  const leavePresence = useMutation(api.presence.leave);

  const [presenterMode, setPresenterMode] = useState(searchParams.get("presenter") === "1");
  const [savingCopy, setSavingCopy] = useState(false);
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

  const prevShareRef = useRef(shareCode);
  useEffect(() => {
    if (prevShareRef.current !== shareCode) {
      prevShareRef.current = shareCode;
      setKnownRoomId(null);
      setDecryptedState(null);
    }
  }, [shareCode]);

  const rawReadyRoom = state?.status === "ready" ? state.room : null;
  const roomE2eeKey = rawReadyRoom ? getRoomE2ee(rawReadyRoom.id) : undefined;
  const needsE2ee = Boolean(
    rawReadyRoom &&
      (isE2eePayload(rawReadyRoom.title) || isE2eePayload(rawReadyRoom.padContent))
  );

  useEffect(() => {
    if (!rawReadyRoom || !needsE2ee) {
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

  const readyRoom =
    rawReadyRoom && needsE2ee && decryptedState?.roomId === rawReadyRoom.id && !decryptedState.failed
      ? {
          ...rawReadyRoom,
          title: decryptedState.title,
          padContent: decryptedState.padContent,
        }
      : rawReadyRoom;

  const viewTitle =
    readyRoom && (!needsE2ee || (decryptedState?.roomId === readyRoom.id && !decryptedState.failed)) && readyRoom.title.trim()
      ? `${readyRoom.title.trim()} — Notefy`
      : "Shared Note — Notefy";
  useDocumentMeta(viewTitle, { noIndex: true });

  // Viewer live presence heartbeat
  useEffect(() => {
    if (!readyRoom) return;
    const roomId = readyRoom.id as Id<"rooms">;
    const clientId = getClientId();
    const deviceLabel = detectDeviceLabel();

    const sendPing = () => {
      if (document.visibilityState === "hidden") return;
      void heartbeat({ roomId, clientId, deviceLabel, mode: "view" });
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
  }, [readyRoom?.id, heartbeat, leavePresence]);

  // Press `P` to toggle Big-Screen Presenter Mode
  useEffect(() => {
    if (!readyRoom) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (inField) return;
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        setPresenterMode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readyRoom]);

  const togglePresenter = (next: boolean) => {
    setPresenterMode(next);
    if (next) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
      if (searchParams.has("presenter")) {
        searchParams.delete("presenter");
        setSearchParams(searchParams, { replace: true });
      }
    }
  };

  if (state === undefined) {
    return <NoteSkeleton withSidebar={false} />;
  }

  if (state.status === "not_found" || state.status === "disabled") {
    return (
      <div className="notefy-dot-grid flex min-h-screen flex-col items-center justify-center bg-[var(--bg-canvas)] px-4">
        <div className="animate-fade-up w-full max-w-md rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-7 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-subtle)] text-[var(--text-muted)]">
            <Eye size={26} weight="duotone" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            {state.status === "disabled" ? "Read-only sharing is paused" : "Shared note not found"}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {state.status === "disabled"
              ? "The owner has temporarily turned off read-only access for this note."
              : "This read-only link or code may have expired or been regenerated."}
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-[var(--accent-primary)] px-4 text-xs font-semibold text-white dark:text-[#0d1f1d]"
          >
            Open Notefy
          </Link>
        </div>
      </div>
    );
  }

  if (state.status === "locked") {
    return (
      <PinGate
        roomLabel={state.room.readOnlyCode.toUpperCase()}
        subtitle="The owner locked this shared note with a PIN."
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
          pushToast("Unlocked shared note");
          return { ok: true };
        }}
      />
    );
  }

  if (needsE2ee) {
    if (!decryptedState || decryptedState.roomId !== state.room.id) {
      return <NoteSkeleton withSidebar={false} />;
    }
    if (decryptedState.failed) {
      return (
        <PinGate
          roomLabel={state.room.readOnlyCode.toUpperCase()}
          subtitle="Enter this shared note's PIN to decrypt it locally on your device."
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
            pushToast("Decrypted shared note");
            return { ok: true };
          }}
        />
      );
    }
  }

  const room = readyRoom!;
  const viewerCount = Math.max(
    1,
    state.presence.filter((m) => m.mode === "view").length
  );

  if (presenterMode) {
    return (
      <PresenterView
        room={room}
        viewerCount={viewerCount}
        onExit={() => togglePresenter(false)}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-surface)] text-[var(--text-primary)]">
      <header className="print-hidden sticky top-0 z-30 h-14 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-md">
        <div className="flex h-full items-center justify-between gap-2 px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              to="/"
              aria-label="Notefy Home"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)] text-white shadow-xs dark:text-[#0d1f1d]"
            >
              <Notepad size={18} weight="duotone" />
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-sm font-bold tracking-tight sm:text-[15px]">
                {room.title || "Shared Note"}
              </h1>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent-soft-text)]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent-primary)]" />
                Read-Only · Live
              </span>
              {viewerCount > 1 && (
                <span className="hidden shrink-0 font-mono text-[11px] text-[var(--text-muted)] sm:inline">
                  {viewerCount} viewing
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              disabled={savingCopy}
              onClick={async () => {
                if (savingCopy) return;
                setSavingCopy(true);
                try {
                  const cloned = await duplicateMut({
                    roomId: room.id,
                    sessionToken: getRoomSession(room.id),
                    overrideTitle: room.title,
                    overridePadContent: room.padContent,
                  });
                  touchRecentRoom(cloned);
                  pushToast(`Saved your editable copy (${cloned.displayCode})`);
                  navigate(`/${cloned.displayCode}`);
                } catch {
                  pushToast("Could not save a copy right now", { tone: "danger" });
                } finally {
                  setSavingCopy(false);
                }
              }}
              title="Save an editable copy to your own notes"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-primary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)] active:scale-[0.98] disabled:opacity-60"
            >
              {savingCopy ? (
                <Spinner size={14} />
              ) : (
                <CopySimple size={15} weight="duotone" className="text-[var(--accent-primary)]" />
              )}
              <span className="hidden sm:inline">{savingCopy ? "Copying…" : "Save a Copy"}</span>
            </button>
            <ExportMenu room={room} onNotify={(msg) => pushToast(msg)} />
            <button
              type="button"
              onClick={() => togglePresenter(true)}
              title="Big-Screen Presenter Mode (Press P)"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-[var(--accent-primary-hover)] dark:text-[#0d1f1d]"
            >
              <Presentation size={16} weight="duotone" />
              <span className="hidden sm:inline">Present</span>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <PadEditor
          key={room.id}
          value={room.padContent}
          updatedAt={room.padUpdatedAt}
          readOnly
          onCopied={() => pushToast("Copied note to clipboard")}
        />
      </main>
    </div>
  );
}
