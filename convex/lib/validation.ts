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

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_DIGITS = "23456789";
const CODE_ALPHABET = `${CODE_LETTERS}${CODE_DIGITS}`;

export function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateSlug(raw: string): "empty" | "valid" | "invalid" | "reserved" {
  const slug = normalizeSlug(raw);
  if (!slug) return "empty";
  if (RESERVED_SLUGS.has(slug)) return "reserved";
  if (!SLUG_REGEX.test(slug) || slug.includes("--")) return "invalid";
  return "valid";
}

export function randomFourCharCode(): string {
  const chars = [
    CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)],
    CODE_DIGITS[Math.floor(Math.random() * CODE_DIGITS.length)],
    CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
  ];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export const MAX_PAD_LENGTH = 200_000;
export const MAX_TITLE_LENGTH = 80;
