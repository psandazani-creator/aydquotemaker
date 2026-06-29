// src/hooks/useAutoSave.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { Customer, QuoteDetails, LineItem } from '../types';
import { saveDraftToStorage } from '../utils/draftStorage';

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export interface AutoSaveState {
  status: AutoSaveStatus;
  savedAt: Date | null;
  autoSaveId: string | null;
}

interface AutoSaveOptions {
  userId: string | undefined;
  existingId: string | undefined;
  localStorageKey: string | null;
  debounceMs?: number;
  onSave: (id: string | undefined) => Promise<string | undefined>;
}

export function useAutoSave(
  formState: {
    customer: Customer;
    details: QuoteDetails;
    lineItems: LineItem[];
    notes: string;
    selectedTemplate: string;
  },
  opts: AutoSaveOptions
): AutoSaveState & { flush: () => Promise<void> } {
  const { userId, existingId, localStorageKey, debounceMs = 2500, onSave } = opts;

  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const autoSaveIdRef = useRef<string | null>(existingId ?? null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const isMounted = useRef(true);
  const isSavingRef = useRef(false);

  // Keep autoSaveId in state too so callers can read it
  const [autoSaveId, setAutoSaveId] = useState<string | null>(existingId ?? null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      clearTimeout(timerRef.current);
    };
  }, []);

  // Update the ID reference when existingId changes (e.g. editing an existing draft)
  useEffect(() => {
    if (existingId) {
      autoSaveIdRef.current = existingId;
      setAutoSaveId(existingId);
    }
  }, [existingId]);

  const doSave = useCallback(async () => {
    if (!userId || isSavingRef.current) return;
    isSavingRef.current = true;
    if (isMounted.current) setStatus('saving');

    try {
      // Persist to localStorage immediately (fast path)
      if (localStorageKey) {
        saveDraftToStorage(localStorageKey, {
          customer: formState.customer,
          details: formState.details,
          lineItems: formState.lineItems,
          notes: formState.notes,
          selectedTemplate: formState.selectedTemplate,
        });
      }

      // Persist to PowerSync / DB
      const savedId = await onSave(autoSaveIdRef.current ?? undefined);

      if (savedId) {
        autoSaveIdRef.current = savedId;
        if (isMounted.current) setAutoSaveId(savedId);
      }

      if (isMounted.current) {
        setStatus('saved');
        setSavedAt(new Date());
      }
    } catch (err) {
      console.error('[useAutoSave] Save failed:', err);
      if (isMounted.current) setStatus('error');
    } finally {
      isSavingRef.current = false;
    }
  }, [userId, localStorageKey, onSave, formState]);

  // Watch form state and schedule a debounced save
  useEffect(() => {
    if (!userId) return;

    // Only auto-save if there is something worth saving
    const hasContent =
      formState.customer.name.trim().length > 0 ||
      formState.lineItems.some((i) => i.description.trim().length > 0 && i.price > 0);

    if (!hasContent) return;

    clearTimeout(timerRef.current);
    if (isMounted.current) setStatus('pending');

    timerRef.current = setTimeout(() => {
      doSave();
    }, debounceMs);

    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formState.customer,
    formState.details,
    formState.lineItems,
    formState.notes,
    formState.selectedTemplate,
    userId,
  ]);

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    await doSave();
  }, [doSave]);

  return { status, savedAt, autoSaveId, flush };
}
