# Notefy

**Instant, zero-login online notepad synced in real time across devices—shareable anywhere with a 4-character access code, custom link, or QR code.**

Built with **React 19**, **Tailwind CSS v4**, **`@ui-sdk/react`**, **Phosphor Icons**, **Tiptap**, and **Convex**.

---

## Features

- **Zero-Login Start:** Click **Start Writing** on `/` to open a live cloud-synced notepad immediately with a unique **4-character alphanumeric code** (e.g., `K7M4`).
- **Tactile 4-Slot Code Entry:** Enter any 4-character code on `/` (or switch to a custom link) to jump straight into a synced note or read-only showcase.
- **Full-Width Rich-Text Notepad:** Edge-to-edge Tiptap writing surface with headings (`H1`–`H3`), bold, italic, underline, strikethrough, bullet/numbered/interactive checklists, inline code, code blocks, blockquotes, dividers, Markdown typing shortcuts (`# `, `**bold**`, `- `, `[] `, ```` ``` ````), 1-click Copy, Export (`.md` / `.txt`), and clean Print support.
- **Share via Code, Custom Link & QR:**
  - **Edit & Sync (`/:code`):** Share a 4-character code, custom URL, or downloadable QR PNG for two-way live sync across phones and laptops.
  - **Read-Only View (`/view/:shareCode`):** Clutter-free live page (zero sidebars or toolbars) with its own 4-character code, custom slug, instant link regeneration, and downloadable QR PNG.
  - **Big-Screen Presenter Mode (`P`):** Full-screen display layout with a giant high-contrast QR code, bold access code, URL banner, and enlarged readable prose.
- **Security, Encryption & Lifecycle Controls:**
  - **Encryption at Rest (All Notes):** All note titles and bodies are encrypted with **AES-256-GCM** via Convex environment secret `NOTE_ENCRYPTION_KEY` before being written to the database.
  - **Zero-Knowledge End-to-End Encryption (PIN Full Lock):** Choosing *Lock entire note* derives a 256-bit AES-GCM key locally in your browser via `PBKDF2` from your PIN and encrypts your note before it leaves your device.
  - **Brute-Force Protection:** Server-hashed `scrypt` PIN verification (5 attempts → 5m cooldown) and rate-limited 4-character access code lookup (15 attempts → 5m cooldown).
  - **Scheduled Auto-Expiry:** Set notes to self-destruct automatically after `24 hours` or `7 days` via Convex Scheduler.
  - **Leave & Clear Browser & Legal Pages:** Confirmation modal to wipe local history/keys on shared computers or permanently delete notes, plus dedicated `/privacy` and `/terms` pages.
- **Collapsible Sidebar & Live Presence:** Switch between recent notes, rename inline, duplicate, share, remove from list, or permanently delete (with 5-second Undo). Live presence stays hidden when writing solo and appears automatically (`2 online`) when another device or viewer connects.
- **Light & Dark Themes + PWA:** Warm-stone light and charcoal dark themes with Web App Manifest support.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript (strict), Vite, React Router |
| Styling & UI Primitives | Tailwind CSS v4, `@ui-sdk/react`, `@ui-sdk/core` |
| Editor & Icons | Tiptap, `@phosphor-icons/react`, `qrcode` |
| Backend & Real-Time Sync | Convex (reactive queries, mutations, `"use node"` actions, scheduler & crons) |

---

## Local Development

### Prerequisites
- Node.js 20+
- A free [Convex](https://convex.dev) account

### 1. Install dependencies
```bash
npm install
```

### 2. Start the Convex backend & set the encryption key
```bash
npx convex dev
```
This links/provisions your Convex dev deployment, pushes `convex/` functions, generates `convex/_generated/*`, and writes `VITE_CONVEX_URL` to `.env.local`.

Set a random 256-bit at-rest encryption key on your Convex dev deployment:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
npx convex env set NOTE_ENCRYPTION_KEY <paste-generated-key>
```

### 3. Start the frontend dev server
In a second terminal:
```bash
npm run dev
```
Open `http://localhost:5173` on your laptop (or your LAN IP / Cloudflare Tunnel URL on your phone).

> **Testing via Cloudflare Tunnel:** `vite.config.ts` already whitelists `*.trycloudflare.com` and `*.cfargotunnel.com`, so you can run `cloudflared tunnel --url http://localhost:5173` and test live QR scanning & phone-to-laptop sync immediately.

---

## Production Deployment

1. **Set the production encryption key & deploy the Convex backend:**
   ```bash
   npx convex env set --prod NOTE_ENCRYPTION_KEY <generated-32-byte-base64-key>
   npx convex deploy
   ```
   Copy the production deployment URL (e.g., `https://your-app.convex.cloud`).

2. **Deploy the static frontend (`dist/`):**
   Push the repo to GitHub and deploy to **Vercel**, **Cloudflare Pages**, or **Netlify**:
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Environment variable:** `VITE_CONVEX_URL=https://your-app.convex.cloud`
   - SPA fallback rewrites are preconfigured in [vercel.json](vercel.json).

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
| --- | --- | --- |
| `Ctrl/Cmd + B / I / U` | Notepad | Bold, Italic, Underline |
| `Ctrl/Cmd + Z` / `Shift + Z` | Notepad | Undo / Redo |
| `# `, `## `, `- `, `[] `, ```` ``` ```` | Notepad | Headings, lists, checklists, code blocks |
| `P` | `/view/:shareCode` | Toggle Big-Screen Presenter Mode |
| `Esc` | Modals / Presenter / Inline Rename | Close or cancel |

---

## Project Documentation

- [notefy.md](notefy.md) — Product & feature specification
- [DESIGN.md](DESIGN.md) — Design tokens, typography, Phosphor & motion system
- [ARCHITECTURE.md](ARCHITECTURE.md) — Convex schema, API contracts & security invariants
- [AGENTS.md](AGENTS.md) — Engineering conventions & `@ui-sdk/react` guidelines
