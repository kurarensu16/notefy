/**
 * Client-side Zero-Knowledge End-to-End Encryption (PBKDF2 + AES-256-GCM)
 * for notes locked with "Lock entire note" (pinScope === "all").
 *
 * Uses roomId-bound PBKDF2 salt so the derived AES-256-GCM key never touches the server,
 * and every encrypted message uses a fresh random 96-bit IV:
 *   e2ee:v1:<ivBase64>:<cipherBase64>
 */

const E2EE_PREFIX = "e2ee:v1:";
const PBKDF2_ITERATIONS = 100_000;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function isE2eePayload(value: string): boolean {
  return Boolean(value && value.startsWith(E2EE_PREFIX));
}

export function supportsWebCrypto(): boolean {
  return typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";
}

export async function deriveRoomE2eeKeyB64(pin: string, roomId: string): Promise<string | null> {
  if (!supportsWebCrypto()) return null;
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin.trim()),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const salt = enc.encode(`notefy-e2ee-v1:${roomId}`);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function importAesKeyFromB64(keyB64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(keyB64);
  return crypto.subtle.importKey(
    "raw",
    raw as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptClientE2ee(plaintext: string, keyB64: string): Promise<string> {
  if (!plaintext) return "";
  if (isE2eePayload(plaintext)) return plaintext;
  if (!supportsWebCrypto()) return plaintext;

  const key = await importAesKeyFromB64(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return `${E2EE_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipherBuf))}`;
}

export async function decryptClientE2ee(
  stored: string,
  keyB64?: string | null
): Promise<{ ok: true; text: string } | { ok: false }> {
  if (!stored || !isE2eePayload(stored)) {
    return { ok: true, text: stored };
  }
  if (!keyB64 || !supportsWebCrypto()) {
    return { ok: false };
  }

  const rest = stored.slice(E2EE_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep <= 0) return { ok: false };

  try {
    const key = await importAesKeyFromB64(keyB64);
    const iv = base64ToBytes(rest.slice(0, sep));
    const cipherBytes = base64ToBytes(rest.slice(sep + 1));
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      cipherBytes as BufferSource
    );
    return { ok: true, text: new TextDecoder().decode(plainBuf) };
  } catch {
    return { ok: false };
  }
}
