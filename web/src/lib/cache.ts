import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync, statSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { loadSettings } from "@/lib/settings";

const CACHE_DIR = join(process.cwd(), ".cache");

function getTtl(): number {
  return loadSettings().cacheTtlSeconds;
}

function isCacheOnly(installationId?: string | null): boolean {
  return loadSettings(installationId ?? undefined).cacheOnly;
}

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheKey(endpoint: string, params: Record<string, string>): string {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join("&");
  const hash = createHash("sha256").update(`${endpoint}?${sorted}`).digest("hex").slice(0, 16);
  return `${endpoint}_${hash}`;
}

interface CacheEntry<T> {
  data: T;
  cachedAt: string;
  endpoint: string;
  params: Record<string, string>;
}

type CacheSummary = {
  fileCount: number;
  sourceCount: number;
  sources: string[];
  coverageFrom: string | null;
  coverageTo: string | null;
};

function dataCacheFiles(): string[] {
  ensureCacheDir();
  return readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json") && f !== "settings.json");
}

function summarizeCacheFiles(files: string[]): CacheSummary {
  const sources = new Set<string>();
  let coverageFrom: string | null = null;
  let coverageTo: string | null = null;

  for (const file of files) {
    try {
      const entry = JSON.parse(readFileSync(join(CACHE_DIR, file), "utf-8")) as CacheEntry<unknown>;
      if (entry.endpoint) {
        sources.add(entry.endpoint);
      }
      const from = entry.params?.from;
      const to = entry.params?.to;
      if (from) {
        if (coverageFrom === null || from < coverageFrom) {
          coverageFrom = from;
        }
      }
      if (to) {
        if (coverageTo === null || to > coverageTo) {
          coverageTo = to;
        }
      }
    } catch {
      // ignore invalid files for summary
    }
  }

  return {
    fileCount: files.length,
    sourceCount: sources.size,
    sources: [...sources].sort(),
    coverageFrom,
    coverageTo,
  };
}

export function getFromCache<T>(endpoint: string, params: Record<string, string>): { data: T; cachedAt: string } | null {
  ensureCacheDir();
  const key = cacheKey(endpoint, params);
  const filePath = join(CACHE_DIR, `${key}.json`);
  const ttl = getTtl();

  // Fast path: exact key match
  if (existsSync(filePath)) {
    try {
      const stat = statSync(filePath);
      const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
      if (ageSeconds <= ttl) {
        const entry: CacheEntry<T> = JSON.parse(readFileSync(filePath, "utf-8"));
        return { data: entry.data, cachedAt: entry.cachedAt };
      }
    } catch {
      // fall through to range-overlap scan
    }
  }

  // Range-overlap fallback: find a cached entry that overlaps [params.from..params.to]
  // and filter records to the intersection. A partial cache hit (e.g. cache 3 days behind)
  // still serves the available history rather than failing entirely.
  const requestedFrom = params.from;
  const requestedTo = params.to;
  if (!requestedFrom || !requestedTo) return null;

  try {
    const files = readdirSync(CACHE_DIR).filter(
      (f) => f.startsWith(`${endpoint}_`) && f.endsWith(".json")
    );

    // Prefer entries with the most overlap (latest storedTo first)
    const candidates: Array<{ file: string; storedTo: string }> = [];
    const requestedScope = Object.fromEntries(
      Object.entries(params).filter(([key]) => key !== "from" && key !== "to"),
    );
    for (const file of files) {
      const fp = join(CACHE_DIR, file);
      try {
        const stat = statSync(fp);
        if ((Date.now() - stat.mtimeMs) / 1000 > ttl) continue;
        const entry: CacheEntry<T> = JSON.parse(readFileSync(fp, "utf-8"));
        const storedFrom = entry.params?.from;
        const storedTo = entry.params?.to;
        const storedScope = Object.fromEntries(
          Object.entries(entry.params ?? {}).filter(([key]) => key !== "from" && key !== "to"),
        );
        if (JSON.stringify(storedScope) !== JSON.stringify(requestedScope)) {
          continue;
        }
        // Any overlap: stored range ends on or after requestedFrom AND starts on or before requestedTo
        if (storedFrom && storedTo && storedFrom <= requestedTo && storedTo >= requestedFrom) {
          candidates.push({ file, storedTo });
        }
      } catch {
        continue;
      }
    }
    candidates.sort((a, b) => (a.storedTo > b.storedTo ? -1 : 1));

    for (const { file } of candidates) {
      const fp = join(CACHE_DIR, file);
      try {
        const entry: CacheEntry<T> = JSON.parse(readFileSync(fp, "utf-8"));
        const storedFrom = entry.params?.from;
        const storedTo = entry.params?.to;

        if (storedFrom && storedTo) {
          // Filter the data array to records within the requested range
          const filtered = Array.isArray(entry.data)
            ? (entry.data as Array<{ event_date?: string }>).filter(
                (r) =>
                  !r.event_date ||
                  (r.event_date >= requestedFrom && r.event_date <= requestedTo)
              )
            : entry.data;
          return { data: filtered as T, cachedAt: entry.cachedAt };
        }
      } catch {
        continue;
      }
    }
  } catch {
    // ignore scan errors
  }

  return null;
}

export function writeToCache<T>(endpoint: string, params: Record<string, string>, data: T): void {
  ensureCacheDir();
  const key = cacheKey(endpoint, params);
  const filePath = join(CACHE_DIR, `${key}.json`);

  const entry: CacheEntry<T> = {
    data,
    cachedAt: new Date().toISOString(),
    endpoint,
    params,
  };

  writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf-8");
}

export function clearCache(endpoint?: string): { cleared: number } {
  ensureCacheDir();
  let cleared = 0;

  const files = dataCacheFiles();

  for (const file of files) {
    if (endpoint && !file.startsWith(`${endpoint}_`)) continue;
    try {
      unlinkSync(join(CACHE_DIR, file));
      cleared++;
    } catch {
      // ignore
    }
  }

  return { cleared };
}

export function getCacheStatus(): {
  entries: number;
  oldestAge: number | null;
  newestAge: number | null;
  cacheOnly: boolean;
  ttlSeconds: number;
  fileCount: number;
  sourceCount: number;
  sources: string[];
  coverageFrom: string | null;
  coverageTo: string | null;
} {
  ensureCacheDir();
  const files = dataCacheFiles();
  let oldest: number | null = null;
  let newest: number | null = null;

  for (const file of files) {
    try {
      const stat = statSync(join(CACHE_DIR, file));
      const age = (Date.now() - stat.mtimeMs) / 1000;
      if (oldest === null || age > oldest) oldest = age;
      if (newest === null || age < newest) newest = age;
    } catch {
      // ignore
    }
  }

  const summary = summarizeCacheFiles(files);

  return {
    entries: summary.fileCount,
    oldestAge: oldest ? Math.round(oldest) : null,
    newestAge: newest ? Math.round(newest) : null,
    cacheOnly: isCacheOnly(),
    ttlSeconds: getTtl(),
    fileCount: summary.fileCount,
    sourceCount: summary.sourceCount,
    sources: summary.sources,
    coverageFrom: summary.coverageFrom,
    coverageTo: summary.coverageTo,
  };
}

export { isCacheOnly };
