/**
 * Client-side encryption utilities for secrets.
 *
 * Format: [version (1 byte)][iv (IV_LENGTH bytes)][ciphertext]
 * Version 1: AES-GCM with 256-bit key, 16-byte IV
 */

const CURRENT_VERSION = 1;
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 16;

export async function encryptSecret(
  text: string,
): Promise<{ encrypted: string; key: string }> {
  const key = await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(text);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded,
  );

  const exportedKey = await crypto.subtle.exportKey("raw", key);

  // Combine version + iv + ciphertext
  const combined = new Uint8Array(1 + IV_LENGTH + ciphertext.byteLength);
  combined[0] = CURRENT_VERSION;
  combined.set(iv, 1);
  combined.set(new Uint8Array(ciphertext), 1 + IV_LENGTH);

  return {
    encrypted: btoa(String.fromCharCode(...combined)),
    key: btoa(String.fromCharCode(...new Uint8Array(exportedKey))),
  };
}

export async function decryptSecret(
  encryptedContent: string,
  keyBase64: string,
): Promise<string> {
  const combined = Uint8Array.from(atob(encryptedContent), (c) =>
    c.charCodeAt(0),
  );
  const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));

  const version = combined[0];

  if (version === 1) {
    return decryptV1(combined.slice(1), keyBytes);
  }

  throw new Error(`Unsupported encryption version: ${version}`);
}

async function decryptV1(
  data: Uint8Array,
  keyBytes: Uint8Array,
): Promise<string> {
  const iv = data.slice(0, IV_LENGTH);
  const ciphertext = data.slice(IV_LENGTH);

  const key = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(keyBytes),
    { name: ALGORITHM },
    false,
    ["decrypt"],
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}
