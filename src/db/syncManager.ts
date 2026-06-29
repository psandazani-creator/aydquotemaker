import { apiFetch } from '../config/supabase';
import * as localDb from './localDb';

export type SyncState = 'idle' | 'offline' | 'synced' | 'syncing' | 'error';

export interface SyncStatus {
  state: SyncState;
  lastSyncedAt: Date | null;
  pendingCount: number;
  error: string | null;
}

const JSON_FIELDS = ['customer', 'details', 'lineItems'];
const SYNCED_TABLES = ['quotes'] as const;

let status: SyncStatus = {
  state: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle',
  lastSyncedAt: null,
  pendingCount: 0,
  error: null,
};

const listeners = new Set<(s: SyncStatus) => void>();

function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  listeners.forEach((cb) => cb(status));
}

export function getSyncStatus(): SyncStatus { return status; }

export function subscribeSyncStatus(cb: (s: SyncStatus) => void): () => void {
  listeners.add(cb);
  cb(status);
  return () => listeners.delete(cb);
}

function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

async function countPending(): Promise<number> {
  let count = 0;
  for (const table of SYNCED_TABLES) {
    const pending = await localDb.getPendingRecords(table);
    const tombstones = await localDb.getTombstones(table);
    count += pending.length + tombstones.length;
  }
  return count;
}

async function pushChanges(): Promise<void> {
  for (const table of SYNCED_TABLES) {
    const pendingRecords = await localDb.getPendingRecords(table);
    if (pendingRecords.length > 0) {
      for (const r of pendingRecords) {
        const row: Record<string, unknown> = { ...r };
        delete row.syncedAt;
        for (const field of JSON_FIELDS) {
          const val = row[field];
          if (typeof val === 'string' && val.length > 0) {
            try { row[field] = JSON.parse(val); } catch { /* keep as-is */ }
          }
        }
        const res = await apiFetch(`/api/quotes/upsert`, { method: 'POST', body: JSON.stringify(row) });
        if (!res.ok) throw new Error(`[Sync] Push failed: ${res.statusText}`);
        await localDb.remove(table, r.id as string);
      }
      localDb.notifyChange(table);
    }

    const tombstones = await localDb.getTombstones(table);
    if (tombstones.length > 0) {
      for (const t of tombstones) {
        const res = await apiFetch(`/api/quotes/${t.id}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 404) throw new Error(`[Sync] Delete failed: ${res.statusText}`);
      }
      await localDb.clearTombstones(tombstones.map((t) => t.id));
    }
  }
}

async function pullChanges(userId: string): Promise<void> {
  const res = await apiFetch('/api/quotes');
  if (!res.ok) throw new Error(`[Sync] Pull failed: ${res.statusText}`);
  const remoteRecords = (await res.json()) as Record<string, unknown>[];
  const remoteIds = new Set(remoteRecords.map((r) => r.id as string));
  let changed = false;

  for (const remote of remoteRecords) {
    const id = remote.id as string;
    const remoteUpdatedAt = (remote.updatedAt as string) ?? '';
    const local = await localDb.getById<Record<string, unknown>>('quotes', id);
    if (local && ((local.updatedAt as string) ?? '') >= remoteUpdatedAt) continue;

    const toStore: Record<string, unknown> = { ...remote, syncedAt: new Date().toISOString() };
    for (const field of JSON_FIELDS) {
      const val = toStore[field];
      if (val !== null && val !== undefined && typeof val === 'object') {
        toStore[field] = JSON.stringify(val);
      }
    }
    await localDb.upsert('quotes', toStore);
    changed = true;
  }

  const localRecords = await localDb.getAllByUserId<Record<string, unknown>>('quotes', userId);
  for (const local of localRecords) {
    if (!remoteIds.has(local.id as string)) {
      await localDb.remove('quotes', local.id as string);
      changed = true;
    }
  }

  if (changed) localDb.notifyChange('quotes');
}

let currentUserId: string | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let running = false;
let rerunRequested = false;

export async function syncNow(): Promise<void> {
  if (!currentUserId) return;
  if (!isOnline()) {
    setStatus({ state: 'offline', pendingCount: await countPending() });
    return;
  }
  if (running) { rerunRequested = true; return; }

  running = true;
  setStatus({ state: 'syncing', error: null });

  try {
    await pushChanges();
    await pullChanges(currentUserId);
    setStatus({ state: 'synced', lastSyncedAt: new Date(), pendingCount: 0, error: null });
  } catch (ex) {
    const message = ex instanceof Error ? ex.message : String(ex);
    setStatus({ state: 'error', pendingCount: await countPending(), error: message });
  } finally {
    running = false;
    if (rerunRequested) { rerunRequested = false; void syncNow(); }
  }
}

function handleOnline() { void syncNow(); }

export function startSync(userId: string): void {
  if (currentUserId === userId && intervalId) return;
  stopSync();
  currentUserId = userId;
  if (typeof window !== 'undefined') window.addEventListener('online', handleOnline);
  intervalId = setInterval(() => void syncNow(), 30_000);
  void syncNow();
}

export function stopSync(): void {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
  if (typeof window !== 'undefined') window.removeEventListener('online', handleOnline);
  currentUserId = null;
}
