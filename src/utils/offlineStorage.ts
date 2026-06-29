// src/utils/offlineStorage.ts
import { DraftQuote } from '../types';

const DB_NAME = 'QuoteMakerDB';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';

class IndexedDBStorage {
  private static dbPromise: Promise<IDBDatabase> | null = null;

  private static async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB database'));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          // Create indexes if needed
          store.createIndex('updatedAt', 'updatedAt');
        }
      };
    });

    return this.dbPromise;
  }

  static async saveDraft(draft: DraftQuote): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Ensure draft has an id and timestamps
      const draftToSave = {
        ...draft,
        id: draft.id || `draft_${Date.now()}`,
        createdAt: draft.createdAt || new Date(),
        updatedAt: new Date()
      };

      return new Promise((resolve, reject) => {
        const request = store.put(draftToSave);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to save draft'));
      });
    } catch (error) {
      console.error('Error saving draft:', error);
      throw error;
    }
  }

  static async getDrafts(): Promise<DraftQuote[]> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          const drafts = request.result.map((d: any) => ({
            ...d,
            createdAt: new Date(d.createdAt),
            updatedAt: new Date(d.updatedAt),
            details: {
              ...d.details,
              validUntil: new Date(d.details.validUntil),
            },
          }));
          resolve(drafts);
        };
        request.onerror = () => reject(new Error('Failed to get drafts'));
      });
    } catch (error) {
      console.error('Error getting drafts:', error);
      throw error;
    }
  }

  static async getDraftById(draftId: string): Promise<DraftQuote | undefined> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.get(draftId);

        request.onsuccess = () => {
          if (request.result) {
            const draft = {
              ...request.result,
              createdAt: new Date(request.result.createdAt),
              updatedAt: new Date(request.result.updatedAt),
              details: {
                ...request.result.details,
                validUntil: new Date(request.result.details.validUntil),
              },
            };
            resolve(draft);
          } else {
            resolve(undefined);
          }
        };
        request.onerror = () => reject(new Error('Failed to get draft by ID'));
      });
    } catch (error) {
      console.error('Error getting draft by ID:', error);
      throw error;
    }
  }

  static async deleteDraft(draftId: string): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.delete(draftId);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to delete draft'));
      });
    } catch (error) {
      console.error('Error deleting draft:', error);
      throw error;
    }
  }

  static async clearAllDrafts(): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      return new Promise((resolve, reject) => {
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error('Failed to clear all drafts'));
      });
    } catch (error) {
      console.error('Error clearing all drafts:', error);
      throw error;
    }
  }
}

export class OfflineStorage {
  static async saveDraft(draft: DraftQuote): Promise<void> {
    return IndexedDBStorage.saveDraft(draft);
  }

  static async getDrafts(): Promise<DraftQuote[]> {
    return IndexedDBStorage.getDrafts();
  }

  static async deleteDraft(draftId: string): Promise<void> {
    return IndexedDBStorage.deleteDraft(draftId);
  }

  static async getDraftById(draftId: string): Promise<DraftQuote | undefined> {
    return IndexedDBStorage.getDraftById(draftId);
  }

  static async clearAllDrafts(): Promise<void> {
    return IndexedDBStorage.clearAllDrafts();
  }

  // Legacy method for compatibility
  static clearSyncedDrafts(): void {
    // This method is deprecated, but kept for compatibility
    // In IndexedDB, we can't filter easily, so we'll clear all
    this.clearAllDrafts().catch(console.error);
  }
}