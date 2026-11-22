# Notefy — Design System & UX Specification

> **Aesthetic Direction:** *Paper & Ink meets fast, calm stationery.* Warm-stone surfaces, deep mint/teal accents, expansive full-width writing space, and zero visual noise—inspired by Hyper Notepad's clarity with tactile QR and 4-character code sharing.

---

## 1. Visual Identity & Color System (Tailwind CSS v4)

Defined in [src/index.css](src/index.css) with `@layer ui-sdk;` declared above `@import "tailwindcss";` and `@import "@ui-sdk/core/web.css" layer(components);`. `@ui-sdk` `--ui-*` variables are mapped directly to Notefy's semantic tokens in both Light and Dark modes.

| Token | Light Mode | Dark Mode | Usage |
| --- | --- | --- | --- |
| `--bg-canvas` | `#F7F6F2` | `#111110` | Home canvas, sidebar rail, toolbar tint |
| `--bg-surface` | `#FFFFFF` | `#1A1917` | Full-width notepad surface, cards, modals |
| `--bg-subtle` | `#EFECE6` | `#242320` | Hover states, inline code, segmented tracks |
| `--border-subtle` | `#E5E1D8` | `#2E2C28` | Hairline dividers, card & input borders |
| `--border-strong` | `#CFC9BC` | `#43403A` | Active borders, secondary buttons |
| `--text-primary` | `#181715` | `#F4F3EE` | Headings, editor prose |
| `--text-secondary` | `#5C584F` | `#A8A297` | Subtitles, metadata, toolbar icons |
| `--text-muted` | `#8A8478` | `#746F66` | Timestamps, word count, section labels |
| `--accent-primary` | `#0F766E` | `#2DD4BF` | Primary CTA, active rings, checkboxes |
| `--accent-primary-hover` | `#115E59` | `#14B8A6` | Primary button hover |
| `--accent-soft` | `#CCFBF1` | `#134E4A` | Active sidebar item, toolbar active state |
| `--accent-soft-text` | `#115E59` | `#99F6E4` | Text/icons on `--accent-soft` |
| `--status-burn` | `#C2410C` | `#FB923C` | Auto-expiry countdown pills |
| `--status-danger` | `#DC2626` | `#F87171` | Destructive actions, validation errors |

---

## 2. Typography

- **UI & Note Prose:** `Plus Jakarta Sans` (fallback: `system-ui, -apple-system, sans-serif`)
- **Access Codes, URLs, Inline Code & Metadata:** `JetBrains Mono` (fallback: `ui-monospace, monospace`)

### Rich-Text Prose Scale (`.notefy-prose`)
- `h1`: `1.875rem`, `font-weight: 700`, `tracking: -0.025em`
- `h2`: `1.375rem`, `font-weight: 700`
- `h3`: `1.125rem`, `font-weight: 600`
- Body: `1rem`, `line-height: 1.75` (`1.25rem` in Presenter Mode via `.notefy-prose-presenter`)
- Code blocks: `JetBrains Mono`, `0.875rem`, rounded `--bg-subtle` well with `--border-subtle`
- Blockquotes: `3px` `--accent-primary` left bar with subtle tinted background
- Task lists (`ul[data-type="taskList"]`): accent-colored checkboxes with strikethrough on checked items

---

## 3. Iconography (`@phosphor-icons/react`)

Notefy uses **Phosphor Icons exclusively** (never `lucide-react`):
- **Default controls:** `weight="regular"` (e.g., `SidebarSimple`, `Copy`, `Export`, `Printer`, `Trash`)
- **Emphasized / Active indicators:** `weight="duotone"` (e.g., `Notepad`, `QrCode`, `Key`, `LockKey`, `Timer`, `Presentation`, `CloudCheck`, `Sun`/`Moon`)
- **Solid toggles / Action glyphs:** `weight="bold"` or `weight="fill"` (e.g., `DotsThree`, `Check`, `Plus`, `CheckSquare` active)

---

## 4. Screen Layouts

### A. Minimal Home (`/`)
- Architectural stationery dot-grid background (`.notefy-dot-grid`) with a soft radial fade to `--bg-canvas`.
- Minimal top bar: Notefy logo mark on left, `ThemeToggle` on right.
- Balanced two-line headline (*"Instant notes. / Share with a code."*) + 1-line subtitle.
- Centered card (`max-w-[26rem]`):
  1. Primary **`Start Writing`** CTA button with loading spinner (`Creating note…`).
  2. Tactile **4-slot `@ui-sdk/react/otp-input`** (`[ K ] [ 7 ] [ M ] [ 4 ]`) with animated mint caret, auto-open on 4th character, wrong-code micro-shake, and a subtle **"Use a custom link instead"** toggle.
  3. Live-synced **Recent** notes rows (if present) with code pills and hover remove.
- Quiet single-line footer (`Zero login · Live sync · QR & Presenter Mode`).

### B. Full-Width Notepad Workspace (`/:code`)
- **Collapsible Left Sidebar (`w-64` on desktop, slide-over drawer on mobile):**
  - Brand link back to `/` + single collapse button (`SidebarSimple` / `X`).
  - **`+ New Note`** CTA button + **Access via Code** input (`Enter code (e.g. K7M4)`).
  - **Your Notes** list with live titles, 4-char codes, Lock/Expiry badges, and a horizontal **`⋯` (`DotsThree`)** `@ui-sdk/react/menu` (*Rename inline, Copy code, Duplicate, Share / QR, Remove from list, Delete permanently with 5s Undo*).
  - Footer **`Leave & Clear Browser`** button opening the confirmation dialog.
- **Sticky Header (`h-14`):**
  - Single sidebar expand button (only visible when collapsed on desktop or on mobile—never doubled).
  - Inline-editable **Note Title**, 1-click copy **Access Code pill** (`K7M4`), Lock & Auto-Expiry badges.
  - Right controls: **Live Presence pill** (hidden when solo; smoothly fades in as `2 online` / `2 online · 3 viewing` when others connect), **Export menu** (Copy all, `.md`, `.txt`, Print), **Share** CTA button, and **Theme toggle**.
- **Edge-to-Edge Rich-Text Notepad (`PadEditor`):**
  - Sticky flush formatting toolbar (`H1`–`H3`, `B`, `I`, `U`, `S`, lists, checklists, inline code, code block, blockquote, divider, undo/redo, Print, Copy).
  - Expansive full-width, full-height writing surface (`px-5 sm:px-10 lg:px-14 xl:px-16`).
  - Flush bottom status strip: live `Syncing…` spinner / `Saved` indicator on left, word & character count on right.

### C. Modals & Overlays (`@ui-sdk/react/dialog`)
- **Share & Sync Modal (`SharePairModal`):** 3 tabs (`Code & Edit`, `Read-Only`, `Security`) featuring shimmer-loaded QR PNGs with download, prominent 1-click copy 4-character codes, custom link/code editors, read-only toggle & regenerate, Launch Presenter Mode, PIN Lock (`edit` vs `all`), Auto-Expiry (`Never` / `24h` / `7d`), and Leave & Clear Browser.
- **Leave & Clear Confirmation Dialog (`LeaveClearDialog`):** Clear choice between *Just leave & clear this browser* (keeps note online via code), *Delete note & clear browser* (permanent), or *Cancel*.
- **PIN Gate (`PinGate`):** Centered unlock card with show/hide PIN toggle, loading spinner, and wrong-PIN micro-shake.

### D. Clutter-Free Read-Only View (`/view/:shareCode`) & Presenter Mode
- **Read-Only View:** Zero sidebar, zero formatting toolbar—just a slim header (Title, `Read-Only · Live` badge, viewer count when > 1, Export menu, **Present** button, Theme toggle) above the full-width formatted note.
- **Big-Screen Presenter Mode (`P` / `Esc`):** Full-screen split layout with a left rail displaying a giant high-contrast QR code, bold uppercase access code, and share URL alongside enlarged note typography on the right.

---

## 5. Motion, Loading & Print Standards

- **Route transitions:** Slim 2px top progress bar (`RouteProgressBar`).
- **Async hydration:** Realistic full-width shimmer skeleton (`NoteSkeleton`) and QR shimmer loader (`QrCodeBox`).
- **Micro-interactions:** Staggered `fade-up` on Home, `pop-in` on copy checkmarks and save confirmation, `shake` on invalid codes/PINs, smooth desktop sidebar width transition, slide-in mobile drawer, and `@ui-sdk/react` `data-starting-style` / `data-ending-style` popup transitions.
- **Accessibility:** All animations honor `@media (prefers-reduced-motion: reduce)`.
- **Printing:** `@media print` hides `.print-hidden` chrome (sidebar, header, toolbar, status bar, toasts) so only clean formatted note content prints.
