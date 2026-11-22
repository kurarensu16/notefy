export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export const RESERVED_SLUGS = new Set([
  "view",
  "api",
  "assets",
  "app",
  "new",
  "join",
  "share",
  "room",
  "rooms",
  "admin",
  "login",
  "logout",
  "signup",
  "auth",
  "settings",
  "account",
  "about",
  "help",
  "docs",
  "privacy",
  "terms",
  "health",
  "status",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
]);

export type SlugStatus = "empty" | "valid" | "invalid" | "reserved";

export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateSlug(raw: string): SlugStatus {
  const slug = normalizeSlug(raw);
  if (!slug) return "empty";
  if (RESERVED_SLUGS.has(slug)) return "reserved";
  if (!SLUG_REGEX.test(slug) || slug.includes("--")) return "invalid";
  return "valid";
}

export function formatRelativeTime(ts: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 15) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export function formatCountdown(expiresAt: number, now = Date.now()): string {
  const remainingMs = Math.max(0, expiresAt - now);
  const totalMinutes = Math.ceil(remainingMs / 60_000);
  if (totalMinutes <= 1) return "<1m left";
  if (totalMinutes < 60) return `${totalMinutes}m left`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours < 24) {
    return mins > 0 ? `${hours}h ${mins}m left` : `${hours}h left`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h left` : `${days}d left`;
}
