import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const CACHE_DIR = join(process.cwd(), ".cache");
const SETTINGS_FILE = join(CACHE_DIR, "settings.json");

// AES-256-GCM requires a 32-byte key.
// Provide INSIGHTS_ENCRYPTION_KEY as 64 hex characters (= 32 bytes).
const ENCRYPTION_KEY_HEX = process.env.INSIGHTS_ENCRYPTION_KEY ?? "";
const ALGORITHM = "aes-256-gcm";
const ENC_PREFIX = "enc:v1:";

function getEncryptionKey(): Buffer | null {
  if (!ENCRYPTION_KEY_HEX || ENCRYPTION_KEY_HEX.length !== 64) return null;
  try {
    const key = Buffer.from(ENCRYPTION_KEY_HEX, "hex");
    if (key.length !== 32) return null;
    return key;
  } catch {
    return null;
  }
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns "enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>" or the original value if no key is configured.
 */
function encryptToken(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getEncryptionKey();
  if (!key) return plaintext; // no key configured — store plaintext

  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENC_PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt a value produced by encryptToken().
 * Returns the plaintext, or "" if decryption fails.
 * If the value does not start with ENC_PREFIX, it is returned as-is (plaintext / no key was set).
 */
function decryptToken(stored: string): string {
  if (!stored) return stored;
  if (!stored.startsWith(ENC_PREFIX)) return stored; // plaintext — stored without a key

  const key = getEncryptionKey();
  if (!key) {
    // Encrypted value but no key — cannot decrypt. Return empty to avoid leaking ciphertext.
    console.warn("[settings] INSIGHTS_ENCRYPTION_KEY is not set but an encrypted token was found. Configure the key to restore access.");
    return "";
  }

  try {
    const parts = stored.slice(ENC_PREFIX.length).split(":");
    if (parts.length !== 3) throw new Error("Unexpected format");
    const [ivHex, authTagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    console.warn("[settings] Token decryption failed — key may have changed or the file is corrupt. Token cleared.");
    return "";
  }
}

export interface AppSettings {
  databricksHost: string;
  databricksToken: string;
  databricksWarehouseId: string;
  databricksCatalog: string;
  databricksSchema: string;
  databricksEnvironment: string;
  cacheTtlSeconds: number;
  cacheOnly: boolean;
}

const DEFAULTS: AppSettings = {
  databricksHost: "",
  databricksToken: "",
  databricksWarehouseId: "",
  databricksCatalog: "workspace",
  databricksSchema: "meta",
  databricksEnvironment: "",
  cacheTtlSeconds: 86400,
  cacheOnly: false,
};

function ensureDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Load settings. Priority: settings.json > env vars > defaults.
 * Token is decrypted automatically if an encryption key is configured.
 */
export function loadSettings(): AppSettings {
  ensureDir();

  let saved: Partial<AppSettings & { databricksToken: string }> = {};
  if (existsSync(SETTINGS_FILE)) {
    try {
      saved = JSON.parse(readFileSync(SETTINGS_FILE, "utf-8"));
    } catch {
      // corrupt file — use defaults
    }
  }

  const storedToken = saved.databricksToken ?? process.env.DATABRICKS_TOKEN ?? DEFAULTS.databricksToken;

  return {
    databricksHost: saved.databricksHost ?? process.env.DATABRICKS_HOST ?? DEFAULTS.databricksHost,
    databricksToken: decryptToken(storedToken),
    databricksWarehouseId: saved.databricksWarehouseId ?? process.env.DATABRICKS_WAREHOUSE_ID ?? DEFAULTS.databricksWarehouseId,
    databricksCatalog: saved.databricksCatalog ?? process.env.DATABRICKS_CATALOG ?? DEFAULTS.databricksCatalog,
    databricksSchema: saved.databricksSchema ?? process.env.DATABRICKS_SCHEMA ?? DEFAULTS.databricksSchema,
    databricksEnvironment: saved.databricksEnvironment ?? process.env.DATABRICKS_ENVIRONMENT ?? DEFAULTS.databricksEnvironment,
    cacheTtlSeconds: saved.cacheTtlSeconds ?? (process.env.INSIGHTS_CACHE_TTL ? parseInt(process.env.INSIGHTS_CACHE_TTL, 10) : DEFAULTS.cacheTtlSeconds),
    cacheOnly: saved.cacheOnly ?? (process.env.INSIGHTS_CACHE_ONLY === "true" || DEFAULTS.cacheOnly),
  };
}

/**
 * Save settings to disk. Token is encrypted before writing if an encryption key is configured.
 */
export function saveSettings(settings: AppSettings): void {
  ensureDir();
  const toWrite: AppSettings = {
    ...settings,
    databricksToken: encryptToken(settings.databricksToken),
  };
  writeFileSync(SETTINGS_FILE, JSON.stringify(toWrite, null, 2), "utf-8");
}

/**
 * Return settings with token masked for API responses.
 * Operates on the already-decrypted token value.
 */
export function maskSettings(settings: AppSettings): AppSettings & { tokenSet: boolean } {
  return {
    ...settings,
    databricksToken: settings.databricksToken ? "••••••••" + settings.databricksToken.slice(-4) : "",
    tokenSet: !!settings.databricksToken,
  };
}
