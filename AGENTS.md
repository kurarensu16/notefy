# AGENTS.md — Notefy Engineering Guidelines

Follow these project conventions for all code, UI components, and backend functions in `c:\Users\sadia\notefy`.

---

## 1. Source-of-Truth Docs
Before making architectural or UI decisions, check:
- [notefy.md](notefy.md) — Product scope & MVP feature list
- [DESIGN.md](DESIGN.md) — Color tokens, typography, Phosphor icon conventions, motion & screen layouts
- [ARCHITECTURE.md](ARCHITECTURE.md) — Convex schema, API contracts, 4-char code & slug rules, and security invariants

---

## 2. Tech Stack & Strict Rules

- **Frontend:** React 19, TypeScript (strict), Vite, `react-router-dom`, **Tailwind CSS v4**, **`@ui-sdk/react`** + **`@ui-sdk/core`**, **`@phosphor-icons/react`**, **Tiptap**, `qrcode`.
- **Backend:** **Convex** (`convex`, `convex/react`).
- **Icons:** Use **`@phosphor-icons/react` ONLY**. Never install or import `lucide-react`.
  - Default controls: `weight="regular"`
  - Active/emphasized badges: `weight="duotone"`
  - Solid toggles/checked/action icons: `weight="bold"` or `weight="fill"`
- **Styling:** Use Tailwind CSS v4 utilities backed by semantic CSS custom properties in `src/index.css` (from `DESIGN.md`). Every component must look polished in **both Light and Dark modes** and respect `prefers-reduced-motion`.

---

## 3. `@ui-sdk/react` Conventions

- Always consult `node_modules/@ui-sdk/react/docs/llms.txt` and the corresponding `node_modules/@ui-sdk/react/docs/components/<name>.md` before adding or modifying interactive primitives.
- Keep `@layer ui-sdk;` at the top of `src/index.css`, followed by `@import "tailwindcss";` and `@import "@ui-sdk/core/web.css" layer(components);`.
- Use `@ui-sdk/react` primitives for:
  - `OTPInput` (4-character access code entry on `/`)
  - `Dialog` (`SharePairModal`, `LeaveClearDialog`)
  - `Tabs` (`SharePairModal` tabs)
  - `Menu` (sidebar `⋯` row actions, `ExportMenu`)
  - `Popover` (live presence device list)
  - `Switch` & `Toggle` (read-only sharing switch, `ThemeToggle`)
- Do **not** hand-roll focus traps, roving tabindex, or outside-click dismissal when `@ui-sdk/react` provides it.

---

## 4. Convex Backend & Security Invariants

- Keep pure validation & 4-char code helpers in `convex/lib/validation.ts` and auth/projection helpers in `convex/lib/auth.ts`.
- Keep Node-only crypto (`crypto.scryptSync`, `crypto.timingSafeEqual`, `crypto.randomBytes`) strictly inside `"use node"` files (`convex/security.ts`).
- **Never** return `pinHash`, `pinSalt`, or internal `expiryJobId` fields from public queries (always project via `toPublicRoom` / `toLockedRoomMeta`).
- **Always** check uniqueness across **both** `rooms.by_code` and `rooms.by_readOnlyCode` when allocating or customizing codes/slugs.
- **Always** validate `sessionToken` via `requireEditAccess` / `requireReadAccess` before reading/mutating PIN-protected notes.
- **Always** cancel existing `expiryJobId` via `safeCancelJob` before replacing an expiry schedule or deleting a note.

---

## 5. UX & Quality Standards

- Keep the notepad full-width, distraction-free, and responsive (collapsible desktop rail, mobile slide-over drawer, zero sidebar/toolbar clutter on `/view/:shareCode`).
- Hide live presence in the header when solo; only surface it when 2+ devices or viewers are connected.
- All clipboard copies must handle fallback gracefully and display a clear toast confirmation.
- Keep `vite.config.ts` Cloudflare tunnel hosts (`".trycloudflare.com"`, `".cfargotunnel.com"`) intact for remote device testing.

---

## 6. Common Commands

```bash
# Start Convex dev backend (pushes functions & generates convex/_generated/*)
npx convex dev

# Start Vite frontend dev server (LAN & Cloudflare tunnel ready)
npm run dev

# Type-check & production build
npm run build

# Deploy Convex production backend
npx convex deploy
```
