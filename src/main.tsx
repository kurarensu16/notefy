import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Notepad, TerminalWindow } from "@phosphor-icons/react";
import "./index.css";
import { App } from "./App";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;

function MissingConvexSetup() {
  return (
    <div className="notefy-dot-grid flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] px-4 text-[var(--text-primary)]">
      <div className="animate-fade-up w-full max-w-md rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-7 shadow-sm">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)]">
          <Notepad size={24} weight="duotone" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Connect Convex Backend</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
          Notefy is wired to Convex, but <code className="rounded bg-[var(--bg-subtle)] px-1.5 py-0.5 font-mono text-xs">VITE_CONVEX_URL</code> is not set yet.
        </p>
        <div className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3.5 font-mono text-xs">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-sans font-semibold text-[var(--text-muted)]">
            <TerminalWindow size={14} weight="duotone" className="text-[var(--accent-primary)]" />
            Run once in c:\Users\sadia\notefy
          </div>
          <code className="block text-[var(--accent-primary)]">npx convex dev</code>
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          That creates <span className="font-mono">.env.local</span>, starts your live Convex sync backend, and this page will reload automatically.
        </p>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);

if (convexUrl && convexUrl.trim()) {
  const convex = new ConvexReactClient(convexUrl.trim());
  root.render(
    <StrictMode>
      <ConvexProvider client={convex}>
        <App />
      </ConvexProvider>
    </StrictMode>
  );
} else {
  root.render(
    <StrictMode>
      <MissingConvexSetup />
    </StrictMode>
  );
}
