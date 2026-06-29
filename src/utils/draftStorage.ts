// src/utils/draftStorage.ts
// Persist unsaved form state in localStorage so page refreshes don't lose work.

const PREFIX = 'aqm_draft_';

export function saveDraftToStorage<T>(key: string, state: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(state));
  } catch (e) {
    // Ignore quota errors
  }
}

export function loadDraftFromStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearDraftFromStorage(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}
