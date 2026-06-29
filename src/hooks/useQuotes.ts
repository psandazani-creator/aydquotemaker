import { useState, useEffect, useCallback } from 'react';
import { Quote, DraftQuote } from '../types';
import * as localDb from '../db/localDb';
import { syncNow } from '../db/syncManager';
import { useQuoteNumber } from './useQuoteNumber';

function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string' && raw.length > 0) {
    try { return JSON.parse(raw) as T; } catch { /* fall through */ }
  }
  return fallback;
}

function mapRow(row: Record<string, unknown>): Quote | DraftQuote {
  const details = parseJsonField<Record<string, unknown> | undefined>(row.details, undefined);
  return {
    ...(row as any),
    total: Number(row.total ?? 0),
    subtotal: Number(row.subtotal ?? 0),
    tax: Number(row.tax ?? 0),
    createdAt: new Date(row.createdAt as string),
    updatedAt: new Date(row.updatedAt as string),
    customer: parseJsonField(row.customer, {}),
    lineItems: parseJsonField(row.lineItems, []),
    details: details
      ? {
          ...details,
          validUntil: details.validUntil ? new Date(details.validUntil as string) : undefined,
        }
      : undefined,
  } as Quote | DraftQuote;
}

function serializeForDb(data: Partial<Quote | DraftQuote> & { userId?: string; status?: string }) {
  const { customer, lineItems, details, createdAt, ...rest } = data as any;
  return {
    ...rest,
    customer: customer ? JSON.stringify(customer) : null,
    lineItems: lineItems ? JSON.stringify(lineItems) : null,
    details: details
      ? JSON.stringify({
          ...details,
          validUntil: details.validUntil instanceof Date
            ? details.validUntil.toISOString()
            : details.validUntil,
        })
      : null,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    updatedAt: new Date().toISOString(),
  };
}

export function useQuotes(userId?: string) {
  const [allQuotes, setAllQuotes] = useState<(Quote | DraftQuote)[]>([]);
  const [loading, setLoading] = useState(true);
  const { getNextQuoteNumber, loading: quoteNumberLoading, error: quoteNumberError } = useQuoteNumber();

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const rows = await localDb.getAllByUserId<Record<string, unknown>>('quotes', userId);
      rows.sort((a, b) =>
        ((b.createdAt as string) ?? '').localeCompare((a.createdAt as string) ?? ''),
      );
      setAllQuotes(rows.map(mapRow));
    } catch (err) {
      console.error('[useQuotes] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return localDb.onDataChange('quotes', loadData);
  }, [loadData]);

  const quotes = allQuotes.filter((q) => q.status === 'final') as Quote[];
  const drafts = allQuotes.filter((q) => q.status === 'draft') as DraftQuote[];

  const saveDraft = async (draft: DraftQuote): Promise<string | undefined> => {
    if (!userId) return;
    try {
      const isNew = !draft.id;
      const id = draft.id || crypto.randomUUID();
      // Assign a quote number the first time a draft is saved so it's
      // never null in the DB. Subsequent saves keep the existing number.
      let quoteNumber = draft.quoteNumber;
      if (isNew && !quoteNumber) {
        try {
          const nextNumber = await getNextQuoteNumber();
          quoteNumber = nextNumber.toString();
        } catch {
          // If number generation fails offline, leave null — it will be
          // assigned on finalisation.
        }
      }
      const serialized = serializeForDb({
        ...draft,
        quoteNumber,
        userId,
        status: 'draft',
        createdAt: draft.createdAt ?? new Date(),
      });
      await localDb.upsert('quotes', { ...serialized, id });
      localDb.notifyChange('quotes');
      void syncNow();
      return id;
    } catch (error) {
      console.error('[useQuotes] Error saving draft:', error);
      throw error;
    }
  };

  const saveQuote = async (
    quote: Quote | DraftQuote,
    originalDraftId?: string,
  ): Promise<string | undefined> => {
    if (!userId) return;
    try {
      let quoteNumber = quote.quoteNumber;
      // Only consume a fresh number when the quote has no number yet
      // (avoids wasting numbers when finalising a draft that was already numbered)
      if (!quoteNumber) {
        const nextNumber = await getNextQuoteNumber();
        quoteNumber = nextNumber.toString();
      }
      const id = quote.id || crypto.randomUUID();
      const serialized = serializeForDb({
        ...quote,
        userId,
        status: 'final',
        quoteNumber: quoteNumber || quote.quoteNumber,
        createdAt: quote.createdAt ?? new Date(),
      });
      await localDb.upsert('quotes', { ...serialized, id });
      if (originalDraftId && originalDraftId !== id) {
        await localDb.remove('quotes', originalDraftId);
        await localDb.addTombstone('quotes', originalDraftId);
      }
      localDb.notifyChange('quotes');
      void syncNow();
      return id;
    } catch (error) {
      console.error('[useQuotes] Error saving quote:', error);
      throw error;
    }
  };

  const deleteDraft = async (draftId: string) => {
    try {
      await localDb.remove('quotes', draftId);
      await localDb.addTombstone('quotes', draftId);
      localDb.notifyChange('quotes');
      void syncNow();
    } catch (error) {
      console.error('[useQuotes] Error deleting draft:', error);
      throw error;
    }
  };

  const deleteQuote = async (id: string) => {
    try {
      await localDb.remove('quotes', id);
      await localDb.addTombstone('quotes', id);
      localDb.notifyChange('quotes');
      void syncNow();
    } catch (error) {
      console.error('[useQuotes] Error deleting quote:', error);
      throw error;
    }
  };

  const clearAllDrafts = async () => {
    if (!userId) return;
    try {
      for (const d of drafts) {
        if (d.id) {
          await localDb.remove('quotes', d.id);
          await localDb.addTombstone('quotes', d.id);
        }
      }
      localDb.notifyChange('quotes');
      void syncNow();
    } catch (error) {
      console.error('[useQuotes] Error clearing drafts:', error);
      throw error;
    }
  };

  const fetchFullQuote = async (id: string): Promise<Quote | null> => {
    try {
      const row = await localDb.getById<Record<string, unknown>>('quotes', id);
      if (!row) return null;
      return mapRow(row) as Quote;
    } catch {
      return null;
    }
  };

  const refetch = async () => { await loadData(); };

  return {
    quotes,
    drafts,
    loading: loading || quoteNumberLoading,
    saveDraft,
    deleteDraft,
    deleteQuote,
    saveQuote,
    clearAllDrafts,
    getNextQuoteNumber,
    fetchFullQuote,
    refetch,
    quoteNumberError,
  };
}
