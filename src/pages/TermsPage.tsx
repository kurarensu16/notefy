import { Link } from "react-router-dom";
import { ArrowLeft, FileText, Notepad } from "@phosphor-icons/react";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { useDocumentMeta } from "../lib/useDocumentMeta";

export function TermsPage() {
  useDocumentMeta("Terms of Use — Notefy");
  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
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
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-subtle)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
            <FileText size={14} weight="duotone" />
            Terms of Use
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Simple, fair terms</h1>
          <p className="mt-2 font-mono text-xs text-[var(--text-muted)]">
            Last updated: November 2026
          </p>

          <div className="mt-7 space-y-6 text-sm leading-relaxed text-[var(--text-secondary)]">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-[var(--text-primary)]">1. Using Notefy</h2>
              <p>
                Notefy is a fast, zero-login scratchpad for syncing and sharing notes. Because there
                are no user accounts, anyone who has a note&apos;s edit code or link can view and edit
                it unless you protect it with a PIN lock.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                2. Your Responsibility for Sensitive Data &amp; Backups
              </h2>
              <p>
                For confidential notes, enable <strong className="text-[var(--text-primary)]">PIN Lock (Lock entire note)</strong>{" "}
                for client-side end-to-end encryption, and keep offline backups of critical text using
                the built-in <strong className="text-[var(--text-primary)]">Export (.md / .txt)</strong>{" "}
                feature. Remember your PIN/passphrase—because full-locked notes are end-to-end encrypted
                in your browser, a forgotten PIN cannot be recovered.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-[var(--text-primary)]">3. Acceptable Use</h2>
              <p>
                Do not use Notefy to distribute illegal content, malware, phishing links, or automated
                spam, or to attempt to brute-force or disrupt access to other users&apos; notes.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                4. Service Provided &ldquo;As Is&rdquo;
              </h2>
              <p>
                Notefy is provided &ldquo;as is&rdquo; without warranties of uninterrupted availability.
                Notes with auto-expiry enabled are permanently deleted when their timer expires.
              </p>
            </section>
          </div>
        </div>

        <footer className="mt-8 flex items-center justify-center gap-4 text-xs text-[var(--text-muted)]">
          <Link to="/" className="hover:text-[var(--text-primary)]">
            Home
          </Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-[var(--text-primary)]">
            Privacy Policy
          </Link>
        </footer>
      </main>
    </div>
  );
}
