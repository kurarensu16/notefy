import { Link } from "react-router-dom";
import { ArrowLeft, LockKey, Notepad, ShieldCheck, Trash } from "@phosphor-icons/react";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { useDocumentMeta } from "../lib/useDocumentMeta";

export function PrivacyPage() {
  useDocumentMeta("Privacy Policy — Notefy");
  return (
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 py-5 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-2.5 transition hover:opacity-85">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent-primary)] text-white shadow-xs dark:text-[#0d1f1d]">
            <Notepad size={18} weight="duotone" />
          </span>
          <span className="text-[15px] font-bold tracking-tight">Notefy</span>
        </Link>

        <ThemeToggle />
      </header>

      <main className="animate-fade-up mx-auto max-w-3xl px-5 pt-4 pb-20 sm:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
        >
          <ArrowLeft size={14} weight="bold" />
          Back to Home
        </Link>

        <div className="mt-5 rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-7 shadow-xs sm:p-10">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent-soft-text)]">
            <ShieldCheck size={14} weight="duotone" />
            Privacy Policy
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            How Notefy handles your notes
          </h1>
          <p className="mt-2 text-xs font-mono text-[var(--text-muted)]">
            Last updated: November 2026
          </p>

          <div className="mt-7 space-y-6 text-sm leading-relaxed text-[var(--text-secondary)]">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                1. No Accounts, No Tracking, No Ads
              </h2>
              <p>
                Notefy does not ask for your name, email address, phone number, or password. We do not
                run third-party ad networks, behavioral analytics, or tracking cookies.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
                <LockKey size={17} weight="duotone" className="text-[var(--accent-primary)]" />
                2. How Notes Are Encrypted &amp; Stored
              </h2>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>
                  <strong className="text-[var(--text-primary)]">Encrypted in transit &amp; at rest:</strong>{" "}
                  All traffic is encrypted via HTTPS/TLS. Every note saved to our database (Convex) is
                  encrypted at rest using <span className="font-mono text-xs">AES-256-GCM</span> with a
                  unique random initialization vector per write—never stored as raw readable text in
                  database tables.
                </li>
                <li>
                  <strong className="text-[var(--text-primary)]">
                    Zero-Knowledge End-to-End Encryption (PIN Lock):
                  </strong>{" "}
                  When you enable <em>Lock entire note</em> with a PIN or passphrase, your browser
                  derives an <span className="font-mono text-xs">AES-256-GCM</span> key locally using{" "}
                  <span className="font-mono text-xs">PBKDF2</span> and encrypts your note before it
                  leaves your device. Neither the server nor the app operator can read PIN-locked notes.
                </li>
                <li>
                  <strong className="text-[var(--text-primary)]">Access-code rate limiting:</strong>{" "}
                  4-character code lookups and PIN unlock attempts are rate-limited to prevent automated
                  guessing. Still, anyone who knows an unlocked note&apos;s code or link can open it—for
                  sensitive information, always enable <em>Lock entire note</em> with a strong passphrase.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                3. What Stays on Your Device
              </h2>
              <p>
                Your browser&apos;s <span className="font-mono text-xs">localStorage</span> stores only
                your light/dark theme preference, a random anonymous device ID for live presence, your
                recent notes list, and unlock tokens/keys for PIN-protected notes you&apos;ve unlocked.
                Clicking <strong className="text-[var(--text-primary)]">Leave &amp; Clear Browser</strong>{" "}
                wipes all local note history, session tokens, and encryption keys from that browser.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)]">
                <Trash size={17} weight="duotone" className="text-[var(--status-danger)]" />
                4. Deletion &amp; Auto-Expiry
              </h2>
              <p>
                When you permanently delete a note or when a scheduled <span className="font-mono text-xs">24h</span>{" "}
                or <span className="font-mono text-xs">7d</span> expiry timer finishes, the note and its
                associated sessions and presence records are permanently erased from the database.
              </p>
            </section>
          </div>
        </div>

        <footer className="mt-8 flex items-center justify-center gap-4 text-xs text-[var(--text-muted)]">
          <Link to="/" className="hover:text-[var(--text-primary)]">
            Home
          </Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-[var(--text-primary)]">
            Terms of Use
          </Link>
        </footer>
      </main>
    </div>
  );
}
