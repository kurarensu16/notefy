const ENC_PREFIX = "enc:v1:";

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

let cachedKeySecret: string | null = null;
let cachedCryptoKey: CryptoKey | null = null;

async function getServerAesKey(): Promise<CryptoKey | null> {
  const secret = process.env.NOTE_ENCRYPTION_KEY?.trim();
  if (!secret) return null;

  if (cachedCryptoKey && cachedKeySecret === secret) {
    return cachedCryptoKey;
  }

  let rawBytes = base64ToBytes(secret);
  if (rawBytes.length !== 32) {
    // Normalize arbitrary-length secret via SHA-256 to 32 bytes (256-bit AES key)
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    rawBytes = new Uint8Array(digest);
  }

  const key = await crypto.subtle.importKey(
    "raw",
    rawBytes as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  cachedKeySecret = secret;
  cachedCryptoKey = key;
  return key;
}

/**
 * Encrypts a string using AES-256-GCM + random 96-bit IV before storing in Convex.
 * Empty strings stay empty to avoid unnecessary overhead.
 */
export async function encryptAtRest(plaintext: string): Promise<string> {
  if (!plaintext) return "";
  if (plaintext.startsWith(ENC_PREFIX)) return plaintext;
  const key = await getServerAesKey();
  if (!key) return plaintext;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  const cipherBytes = new Uint8Array(cipherBuf);
  return `${ENC_PREFIX}${bytesToBase64(iv)}:${bytesToBase64(cipherBytes)}`;
}

/**
 * Decrypts a stored AES-256-GCM string. Gracefully returns legacy plaintext values untouched.
 */
export async function decryptAtRest(stored: string): Promise<string> {
  if (!stored || !stored.startsWith(ENC_PREFIX)) return stored;
  const key = await getServerAesKey();
  if (!key) return stored;

  const rest = stored.slice(ENC_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep <= 0) return stored;

  try {
    const iv = base64ToBytes(rest.slice(0, sep));
    const cipherBytes = base64ToBytes(rest.slice(sep + 1));
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      cipherBytes as BufferSource
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    return "";
  }
}
