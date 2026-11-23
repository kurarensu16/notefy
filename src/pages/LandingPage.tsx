import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { OTPInput, OTPInputGroup, OTPInputSlot } from "@ui-sdk/react/otp-input";
import {
  ArrowRight,
  ClockCounterClockwise,
  CloudSlash,
  DownloadSimple,
  LinkSimple,
  Notepad,
  PencilSimpleLine,
  X,
} from "@phosphor-icons/react";
import { api } from "../../convex/_generated/api";
import { getClientId } from "../lib/clientState";
import {
  cacheRoomSnapshot,
  createOfflineDraft,
  draftToRoomView,
  getCachedRoomSnapshot,
  getOfflineDraft,
  isOfflineDraftCode,
} from "../lib/offlineStore";
import { useNotefyUi } from "../lib/uiContext";
import { useDocumentMeta } from "../lib/useDocumentMeta";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { Spinner } from "../components/ui/LoadingStates";

export function LandingPage() {
  useDocumentMeta("Notefy — Instant Notes. Share with a Code.");
  const navigate = useNavigate();
  const createInstant = useMutation(api.rooms.createInstant);
  const resolveCodeMut = useMutation(api.rooms.resolveCode);
  const {
    isOnline,
    canInstallPwa,
    promptInstallPwa,
    recentRooms,
    touchRecentRoom,
    forgetRecentRoom,
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

  const [mode, setMode] = useState<"code" | "custom">("code");
  const [otpCode, setOtpCode] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openingCode, setOpeningCode] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const openNewOfflineDraft = () => {
    const draft = createOfflineDraft();
    touchRecentRoom(draftToRoomView(draft));
    pushToast("Created offline draft (will sync when online)");
    navigate(`/${draft.draftId}`);
  };

  const handleStartWriting = async () => {
    if (creating) return;
    if (!isOnline) {
      openNewOfflineDraft();
      return;
    }
    setCreating(true);
    try {
      const room = await createInstant({});
      cacheRoomSnapshot(room);
      touchRecentRoom(room);
      pushToast(`Created note (${room.displayCode})`);
      navigate(`/${room.displayCode}`);
    } catch {
      openNewOfflineDraft();
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
    if (!cleaned || openingCode) return;

    if (isOfflineDraftCode(cleaned)) {
      const draft = getOfflineDraft(cleaned);
      if (draft) {
        setError(null);
        navigate(`/${draft.draftId}`);
        return;
      }
    }

    if (!isOnline) {
      const cached = getCachedRoomSnapshot(cleaned);
      if (cached) {
        setError(null);
        navigate(`/${cached.displayCode}`);
        return;
      }
      setError("You're offline — only previously opened notes on this device can be opened.");
      setShakeKey((k) => k + 1);
      return;
    }

    setOpeningCode(true);
    try {
      const res = await resolveCodeMut({
        rawCode: cleaned,
        clientId: getClientId(),
      });
      if (res.kind === "edit") {
        setError(null);
        navigate(`/${res.displayCode}`);
        return;
      }
      if (res.kind === "view") {
        setError(null);
        navigate(`/view/${res.readOnlyCode}`);
        return;
      }
      if (res.kind === "rate_limited") {
        setError(res.error);
        setShakeKey((k) => k + 1);
        return;
      }
      setError(`No note found for "${cleaned.toUpperCase()}".`);
      setShakeKey((k) => k + 1);
    } catch {
      const cached = getCachedRoomSnapshot(cleaned);
      if (cached) {
        setError(null);
        navigate(`/${cached.displayCode}`);
        return;
      }
      setError("Connection error while checking code.");
      setShakeKey((k) => k + 1);
    } finally {
      setOpeningCode(false);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void resolveAndOpen(customInput);
  };

  return (
    <div className="notefy-dot-grid relative flex min-h-dvh flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,transparent_30%,var(--bg-canvas)_85%)]"
      />

      {/* Minimal Top Bar */}
      <header className="animate-fade-in relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-2.5 transition hover:opacity-85">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-white shadow-xs dark:text-[#0d1f1d]">
            <Notepad size={18} weight="duotone" />
          </span>
          <span className="text-[15px] font-bold tracking-tight">Notefy</span>
        </Link>

        <div className="flex items-center gap-2">
          {!isOnline && (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[var(--status-burn-soft)] px-2.5 font-mono text-[11px] font-semibold text-[var(--status-burn)]">
              <CloudSlash size={14} weight="duotone" />
              Offline
            </span>
          )}
          {canInstallPwa && (
            <button
              type="button"
              onClick={() => void promptInstallPwa()}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-primary)] shadow-2xs transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
            >
              <DownloadSimple size={15} weight="duotone" className="text-[var(--accent-primary)]" />
              <span>Install</span>
            </button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Centered Focused Entry */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pt-2 pb-16">
        <div className="w-full max-w-[26rem]">
          <div className="animate-fade-up mb-8 text-center">
            <h1 className="text-balance text-[2.15rem] font-bold leading-[1.12] tracking-tight sm:text-[2.5rem]">
              Instant notes.
              <br />
              <span className="text-[var(--accent-primary)]">Share with a code.</span>
            </h1>
            <p className="mt-3 text-sm text-[var(--text-secondary)]">
              No account needed. Write here and open anywhere.
            </p>
          </div>

          <div
            className="animate-fade-up rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_14px_34px_-14px_rgba(24,23,21,0.12)] sm:p-7 dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_18px_40px_-14px_rgba(0,0,0,0.65)]"
            style={{ animationDelay: "70ms" }}
          >
            {/* Action 1: Start Writing */}
            <button
              type="button"
              onClick={() => void handleStartWriting()}
              disabled={creating}
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent-primary)] px-5 text-sm font-semibold text-white shadow-xs transition hover:bg-[var(--accent-primary-hover)] active:scale-[0.99] disabled:opacity-80 dark:text-[#0d1f1d]"
            >
              {creating ? (
                <>
                  <Spinner size={17} />
                  Creating note…
                </>
              ) : (
                <>
                  <PencilSimpleLine size={18} weight="duotone" />
                  Start Writing
                  <ArrowRight
                    size={16}
                    weight="bold"
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </>
              )}
            </button>

            <div className="my-6 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
              <div className="h-px flex-1 bg-[var(--border-subtle)]" />
              <span>{mode === "code" ? "or enter 4-digit code" : "or enter custom link"}</span>
              <div className="h-px flex-1 bg-[var(--border-subtle)]" />
            </div>

            {/* Action 2: Tactile 4-Slot OTP Code Input or Custom Link */}
            {mode === "code" ? (
              <div className="animate-fade-in flex flex-col items-center">
                <div key={shakeKey} className={shakeKey > 0 ? "animate-shake" : ""}>
                  <OTPInput
                    maxLength={4}
                    pattern="alphanumeric"
                    inputMode="text"
                    textAlign="center"
                    disabled={openingCode}
                    aria-label="4-character access code"
                    value={otpCode}
                    onValueChange={(next) => {
                      const upper = next.toUpperCase();
                      setOtpCode(upper);
                      if (error) setError(null);
                    }}
                    onValueCommit={(val) => {
                      void resolveAndOpen(val);
                    }}
                    className="flex justify-center"
                  >
                    <OTPInputGroup className="flex items-center gap-2.5 sm:gap-3">
                      {[0, 1, 2, 3].map((index) => (
                        <OTPInputSlot
                          key={index}
                          index={index}
                          className="notefy-otp-slot relative ml-0 flex h-14 w-13 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] font-mono text-xl font-bold uppercase text-[var(--text-primary)] shadow-2xs transition-all duration-150 data-active:border-[var(--accent-primary)] data-active:bg-[var(--bg-surface)] data-active:outline-none data-active:ring-3 data-active:ring-[var(--accent-primary)]/20 data-filled:scale-[1.02] data-filled:border-[var(--border-strong)] data-filled:bg-[var(--bg-surface)] sm:h-15 sm:w-14 sm:text-2xl"
                        />
                      ))}
                    </OTPInputGroup>
                  </OTPInput>
                </div>

                {openingCode && (
                  <p className="animate-fade-in mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-primary)]">
                    <Spinner size={13} />
                    Opening note…
                  </p>
                )}

                {error && !openingCode && (
                  <p className="animate-fade-in mt-3 text-center text-xs font-medium text-[var(--status-danger)]">
                    {error}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-center gap-3 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("custom");
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1 font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                  >
                    <LinkSimple size={13} />
                    Use a custom link instead
                  </button>
                </div>
              </div>
            ) : (
              <form
                key={shakeKey}
                onSubmit={handleCustomSubmit}
                className={`space-y-3 ${shakeKey > 0 ? "animate-shake" : "animate-fade-in"}`}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-11 min-w-0 flex-1 items-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3.5 transition focus-within:border-[var(--accent-primary)] focus-within:bg-[var(--bg-surface)]">
                    <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">/</span>
                    <input
                      type="text"
                      value={customInput}
                      disabled={openingCode}
                      onChange={(e) => {
                        setCustomInput(e.target.value);
                        if (error) setError(null);
                      }}
                      placeholder="custom-link"
                      autoFocus
                      aria-label="Enter custom link"
                      className="w-full min-w-0 bg-transparent pl-0.5 font-mono text-base text-[var(--text-primary)] placeholder:font-sans placeholder:text-sm placeholder:text-[var(--text-muted)] focus:outline-none sm:text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!customInput.trim() || openingCode}
                    className="inline-flex h-11 min-w-[4.5rem] shrink-0 items-center justify-center gap-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-strong)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {openingCode ? <Spinner size={15} /> : "Open"}
                  </button>
                </div>

                {error && (
                  <p className="animate-fade-in px-1 text-xs font-medium text-[var(--status-danger)]">
                    {error}
                  </p>
                )}

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("code");
                      setError(null);
                    }}
                    className="text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                  >
                    ← Back to 4-character code
                  </button>
                </div>
              </form>
            )}

            {/* Recent Notes */}
            {recentRooms.length > 0 && (
              <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  <ClockCounterClockwise size={12} />
                  Recent
                </div>
                <div className="space-y-1">
                  {recentRooms.slice(0, 4).map((r) => {
                    const isDraft = isOfflineDraftCode(r.code);
                    const live = isDraft ? undefined : liveMeta?.[r.code];
                    const title = live?.title || r.title || "Untitled Note";
                    const displayCode = live?.displayCode || r.displayCode;
                    return (
                      <div
                        key={r.code}
                        className="group flex items-center justify-between rounded-xl px-2.5 py-1.5 transition hover:bg-[var(--bg-subtle)]/70"
                      >
                        <Link
                          to={`/${displayCode}`}
                          className="flex min-w-0 flex-1 items-center gap-2 text-xs"
                        >
                          {isDraft ? (
                            <CloudSlash size={14} weight="duotone" className="shrink-0 text-[var(--status-burn)]" />
                          ) : (
                            <Notepad size={14} weight="duotone" className="shrink-0 text-[var(--accent-primary)]" />
                          )}
                          <span className="truncate font-medium text-[var(--text-primary)]">
                            {title}
                          </span>
                          <span
                            className={`shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                              isDraft
                                ? "bg-[var(--status-burn-soft)] text-[var(--status-burn)]"
                                : "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                            }`}
                          >
                            {isDraft ? "Offline" : displayCode}
                          </span>
                        </Link>
                        <button
                          type="button"
                          aria-label={`Remove ${displayCode}`}
                          onClick={() => forgetRecentRoom(r.code)}
                          className="ml-2 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] opacity-0 transition hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <X size={12} weight="bold" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <footer
            className="animate-fade-up mt-6 flex items-center justify-center gap-3 text-xs text-[var(--text-muted)]"
            style={{ animationDelay: "130ms" }}
          >
            <Link to="/privacy" className="transition hover:text-[var(--text-primary)]">
              Privacy Policy
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/terms" className="transition hover:text-[var(--text-primary)]">
              Terms
            </Link>
          </footer>
        </div>
      </main>
    </div>
  );
}
