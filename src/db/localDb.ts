const DB_NAME = 'AydQuoteMakerDB';
const DB_VERSION = 1;

const DATA_CHANGE_EVENT = 'localdb:change';

export function notifyChange(table: string) {
  window.dispatchEvent(new CustomEvent(DATA_CHANGE_EVENT, { detail: { table } }));
}

export function onDataChange(table: string, cb: () => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (!detail || detail.table === table) cb();
  };
  window.addEventListener(DATA_CHANGE_EVENT, handler);
  return () => window.removeEventListener(DATA_CHANGE_EVENT, handler);
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('quotes')) {
        const s = db.createObjectStore('quotes', { keyPath: 'id' });
        s.createIndex('userId', 'userId', { unique: false });
        s.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('invoices')) {
        const s = db.createObjectStore('invoices', { keyPath: 'id' });
        s.createIndex('userId', 'userId', { unique: false });
        s.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains('tombstones')) {
        const s = db.createObjectStore('tombstones', { keyPath: 'id' });
        s.createIndex('table', 'table', { unique: false });
      }
    };
  });
  return dbPromise;
}

export async function getAllByUserId<T>(store: string, userId: string): Promise<T[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const idx = tx.objectStore(store).index('userId');
    const req = idx.getAll(userId);
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function getById<T>(store: string, id: string): Promise<T | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function upsert(store: string, record: Record<string, unknown>): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function remove(store: string, id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function addTombstone(table: string, id: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tombstones', 'readwrite');
    const req = tx.objectStore('tombstones').put({ id, table, deletedAt: new Date().toISOString() });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getTombstones(table: string): Promise<Array<{ id: string; table: string; deletedAt: string }>> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tombstones', 'readonly');
    const req = tx.objectStore('tombstones').index('table').getAll(table);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function clearTombstones(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tombstones', 'readwrite');
    const store = tx.objectStore('tombstones');
    let pending = ids.length;
    const done = () => { if (--pending === 0) resolve(); };
    for (const id of ids) {
      const req = store.delete(id);
      req.onsuccess = done;
      req.onerror = () => reject(req.error);
    }
  });
}

export async function markSynced(store: string, ids: string[], syncedAt: string): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const s = tx.objectStore(store);
    let pending = ids.length;
    const done = () => { if (--pending === 0) resolve(); };
    for (const id of ids) {
      const getReq = s.get(id);
      getReq.onsuccess = () => {
        if (getReq.result) {
          const putReq = s.put({ ...getReq.result, syncedAt });
          putReq.onsuccess = done;
          putReq.onerror = () => reject(putReq.error);
        } else {
          done();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    }
  });
}

export async function getPendingRecords(store: string): Promise<Record<string, unknown>[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => {
      const all = req.result as Record<string, unknown>[];
      const pending = all.filter(r =>
        !r.syncedAt || (r.updatedAt as string) > (r.syncedAt as string),
      );
      resolve(pending);
    };
    req.onerror = () => reject(req.error);
  });
}
