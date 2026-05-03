/**
 * TOTP utility functions for local account 2FA (LADR-036).
 *
 * All operations are server-side only. Never import this module from client components.
 */

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "crypto";

// ── Base32 ────────────────────────────────────────────────────────────────────

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_CHARS[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(s: string): Buffer {
  const str = s.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];
  for (const char of str) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

// ── HOTP/TOTP ─────────────────────────────────────────────────────────────────

function hotp(keyBuffer: Buffer, counter: bigint, digits: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(counter);
  const hash = createHmac("sha1", keyBuffer).update(msg).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const code = ((hash[offset] & 0x7f) << 24) |
               ((hash[offset + 1] & 0xff) << 16) |
               ((hash[offset + 2] & 0xff) << 8) |
               (hash[offset + 3] & 0xff);
  return String(code % Math.pow(10, digits)).padStart(digits, "0");
}

// ── Encryption ──────────────────────────────────────────────────────────────
// AES-256-GCM; key is TOTP_ENCRYPTION_KEY as 64 hex chars (= 32 bytes).
// Falls back to INSIGHTS_ENCRYPTION_KEY if TOTP_ENCRYPTION_KEY is not set.

const ALGORITHM = "aes-256-gcm";
const ENC_PREFIX = "totp:v1:";

function getTotpEncryptionKey(): Buffer | null {
  const hex = process.env.TOTP_ENCRYPTION_KEY ?? process.env.INSIGHTS_ENCRYPTION_KEY ?? "";
  if (!hex || hex.length !== 64) return null;
  try {
    const key = Buffer.from(hex, "hex");
    return key.length === 32 ? key : null;
  } catch {
    return null;
  }
}

export function encryptTotpSecret(plaintext: string): string {
  const key = getTotpEncryptionKey();
  if (!key) {
    // Encryption key not configured — store plaintext with a warning marker.
    // Operators MUST set TOTP_ENCRYPTION_KEY or INSIGHTS_ENCRYPTION_KEY for production.
    return `plain:${plaintext}`;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptTotpSecret(stored: string): string | null {
  if (stored.startsWith("plain:")) {
    return stored.slice(6);
  }
  if (!stored.startsWith(ENC_PREFIX)) return null;
  const key = getTotpEncryptionKey();
  if (!key) return null;
  try {
    const parts = stored.slice(ENC_PREFIX.length).split(":");
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, ctHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(tagHex, "hex");
    const ciphertext = Buffer.from(ctHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ── TOTP ─────────────────────────────────────────────────────────────────────

const TOTP_ISSUER = process.env.TOTP_ISSUER ?? "Latero Control";
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;

/** Generate a new Base32-encoded TOTP secret (20 random bytes = 160 bits). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Build the otpauth:// URI for a user. */
export function buildTotpUri(base32Secret: string, email: string): string {
  const issuer = encodeURIComponent(TOTP_ISSUER);
  const label = encodeURIComponent(`${TOTP_ISSUER}:${email}`);
  const secret = encodeURIComponent(base32Secret);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/**
 * Verify a 6-digit TOTP token.
 * Accepts a ±1 window (±30 s) to account for clock drift.
 */
export function verifyTotpToken(base32Secret: string, token: string): boolean {
  try {
    const keyBuffer = base32Decode(base32Secret);
    const counter = BigInt(Math.floor(Date.now() / 1000 / TOTP_PERIOD));
    const code = token.replace(/\s/g, "");
    for (let delta = -1; delta <= 1; delta++) {
      if (hotp(keyBuffer, counter + BigInt(delta), TOTP_DIGITS) === code) return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ── Backup codes ─────────────────────────────────────────────────────────────

const BACKUP_CODE_BYTES = 9; // 9 bytes → 18 hex chars → ~72 bits entropy
const BACKUP_CODE_COUNT = 5;

/** Generate BACKUP_CODE_COUNT backup codes (plaintext, shown once to user). */
export function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () =>
    randomBytes(BACKUP_CODE_BYTES).toString("hex").toUpperCase(),
  );
}

/** Hash a backup code for database storage. */
export function hashBackupCode(code: string): string {
  return createHash("sha256").update(code.toUpperCase().replace(/\s/g, "")).digest("hex");
}

// ── Pending 2FA cookie ────────────────────────────────────────────────────────

const PENDING_2FA_TTL_SECONDS = 5 * 60; // 5 minutes
const PENDING_COOKIE_NAME = "insights_pending_2fa";

export { PENDING_COOKIE_NAME };

function getPendingSecret(): string {
  const secret =
    process.env.TOTP_PENDING_SECRET ??
    process.env.OIDC_STATE_SECRET ??
    process.env.INSIGHTS_ENCRYPTION_KEY ??
    "";
  if (!secret || secret.length < 32) {
    throw new Error(
      "No suitable secret found for pending 2FA cookie. Set TOTP_PENDING_SECRET (min 32 chars).",
    );
  }
  return secret;
}

export interface Pending2FAPayload {
  user_id: string;
  installation_id: string | null;
  exp: number;
}

/** Serialise and HMAC-sign the pending 2FA payload for cookie storage. */
export function serializePending2FA(payload: Pending2FAPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", getPendingSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/** Deserialise and verify the pending 2FA cookie. Returns null if invalid or expired. */
export function deserializePending2FA(value: string): Pending2FAPayload | null {
  try {
    const dot = value.lastIndexOf(".");
    if (dot < 0) return null;
    const data = value.slice(0, dot);
    const sig = value.slice(dot + 1);
    const expected = createHmac("sha256", getPendingSecret()).update(data).digest("base64url");
    // Constant-time comparison
    const sigBuf = Buffer.from(sig, "base64url");
    const expBuf = Buffer.from(expected, "base64url");
    if (sigBuf.length !== expBuf.length) return null;
    let diff = 0;
    for (let i = 0; i < sigBuf.length; i++) diff |= sigBuf[i] ^ expBuf[i];
    if (diff !== 0) return null;

    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Pending2FAPayload;
    if (typeof parsed.user_id !== "string" || typeof parsed.installation_id !== "string") return null;
    if (Date.now() / 1000 > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function makePending2FAPayload(userId: string, installationId: string | null): Pending2FAPayload {
  return {
    user_id: userId,
    installation_id: installationId,
    exp: Math.floor(Date.now() / 1000) + PENDING_2FA_TTL_SECONDS,
  };
}

export { PENDING_2FA_TTL_SECONDS };
