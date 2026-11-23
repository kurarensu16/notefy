import React, { useState } from "react";
import { ArrowRight, Eye, EyeSlash, LockKey } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { Spinner } from "./ui/LoadingStates";

interface PinGateProps {
  roomLabel: string;
  subtitle?: string;
  onUnlock: (pin: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}

export function PinGate({ roomLabel, subtitle, onUnlock }: PinGateProps) {
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checking || pin.trim().length < 4) return;
    setChecking(true);
    try {
      const res = await onUnlock(pin);
      if (!res.ok) {
        setError(res.error);
        setShakeKey((k) => k + 1);
      } else {
        setError(null);
        setPin("");
      }
    } catch {
      setError("Could not verify PIN. Please try again.");
      setShakeKey((k) => k + 1);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="notefy-dot-grid flex min-h-dvh flex-col items-center justify-center bg-[var(--bg-canvas)] px-4 py-12">
      <div
        key={shakeKey}
        className={`w-full max-w-sm rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_14px_34px_-14px_rgba(24,23,21,0.12)] ${
          shakeKey > 0 ? "animate-shake" : "animate-fade-up"
        }`}
      >
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
          <LockKey size={26} weight="duotone" />
        </div>

        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
          PIN required
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
          {subtitle ?? (
            <>
              Note <span className="font-mono font-semibold text-[var(--text-primary)]">{roomLabel}</span> is
              protected with a PIN.
            </>
          )}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div className="relative">
            <input
              type={showPin ? "text" : "password"}
              value={pin}
              disabled={checking}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter PIN or passphrase"
              autoFocus
              className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] pr-10 pl-3.5 font-mono text-base text-[var(--text-primary)] placeholder:font-sans placeholder:text-sm placeholder:text-[var(--text-muted)] transition focus:border-[var(--accent-primary)] focus:bg-[var(--bg-surface)] focus:outline-none sm:text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPin((s) => !s)}
              aria-label={showPin ? "Hide PIN" : "Show PIN"}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            >
              {showPin ? <EyeSlash size={17} /> : <Eye size={17} />}
            </button>
          </div>

          {error && (
            <p className="animate-fade-in text-xs font-medium text-[var(--status-danger)]">{error}</p>
          )}

          <button
            type="submit"
            disabled={pin.trim().length < 4 || checking}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--accent-primary-hover)] active:scale-[0.99] disabled:opacity-45 dark:text-[#0d1f1d]"
          >
            {checking ? (
              <>
                <Spinner size={16} />
                Unlocking…
              </>
            ) : (
              <>
                Unlock Note
                <ArrowRight size={16} weight="bold" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 border-t border-[var(--border-subtle)] pt-4 text-center">
          <Link
            to="/"
            className="text-xs font-medium text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
          >
            ← Back to Notefy home
          </Link>
        </div>
      </div>
    </div>
  );
}
