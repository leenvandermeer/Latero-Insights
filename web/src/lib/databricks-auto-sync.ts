import { loadSettings } from "@/lib/settings";
import { syncFromDatabricks } from "@/lib/databricks-sync";

type AutoSyncState = {
  running: boolean;
  lastStartedAt: number | null;
  lastFinishedAt: number | null;
  lastError: string | null;
};

const state: AutoSyncState = {
  running: false,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastError: null,
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isAutoSyncEnabled(): boolean {
  return process.env.INSIGHTS_AUTO_SYNC_ENABLED !== "false";
}

function getSyncIntervalMs(): number {
  const minutes = parsePositiveInt(process.env.INSIGHTS_AUTO_SYNC_INTERVAL_MINUTES, 15);
  return minutes * 60 * 1000;
}

function getSyncWindowDays(): number {
  return parsePositiveInt(process.env.INSIGHTS_AUTO_SYNC_WINDOW_DAYS, 7);
}

function defaultRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - days);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

function canAttemptSync(): boolean {
  if (!isAutoSyncEnabled()) return false;
  if (!process.env.POSTGRES_URL) return false;

  const settings = loadSettings();
  if (settings.connectionMode !== "databricks") return false;
  if (settings.cacheOnly) return false;

  return Boolean(
    settings.databricksHost && settings.databricksToken && settings.databricksWarehouseId,
  );
}

async function runSync(reason: string): Promise<void> {
  state.running = true;
  state.lastStartedAt = Date.now();
  state.lastError = null;

  try {
    const range = defaultRange(getSyncWindowDays());
    await syncFromDatabricks(range);
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : "Auto-sync failed";
    console.warn(`[auto-sync] ${reason}: ${state.lastError}`);
  } finally {
    state.running = false;
    state.lastFinishedAt = Date.now();
  }
}

export function triggerAutoSyncIfDue(reason: string): void {
  if (!canAttemptSync()) return;
  if (state.running) return;

  const now = Date.now();
  const intervalMs = getSyncIntervalMs();

  if (state.lastFinishedAt && now - state.lastFinishedAt < intervalMs) {
    return;
  }

  void runSync(reason);
}

export function getAutoSyncState(): AutoSyncState {
  return { ...state };
}
