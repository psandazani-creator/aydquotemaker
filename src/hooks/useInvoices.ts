import { useState, useEffect, useCallback } from 'react';
import { Invoice, DraftInvoice, InvoiceStatus } from '../types/invoice';
import * as localDb from '../db/localDb';
import { useInvoiceNumber } from './useInvoiceNumber';

function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string' && raw.length > 0) {
    try { return JSON.parse(raw) as T; } catch { /* fall through */ }
  }
  return fallback;
}

function mapRow(row: Record<string, unknown>): Invoice | DraftInvoice {
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
          issuedDate: details.issuedDate ? new Date(details.issuedDate as string) : new Date(),
          dueDate: details.dueDate ? new Date(details.dueDate as string) : undefined,
        }
      : undefined,
  } as Invoice | DraftInvoice;
}

function serializeForDb(data: Partial<Invoice | DraftInvoice> & { userId?: string; status?: string }) {
  const { customer, lineItems, details, createdAt, ...rest } = data as any;
  return {
    ...rest,
    customer: customer ? JSON.stringify(customer) : null,
    lineItems: lineItems ? JSON.stringify(lineItems) : null,
    details: details
      ? JSON.stringify({
          ...details,
          issuedDate: details.issuedDate instanceof Date
            ? details.issuedDate.toISOString()
            : details.issuedDate,
          dueDate: details.dueDate instanceof Date
            ? details.dueDate.toISOString()
            : details.dueDate,
        })
      : null,
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    updatedAt: new Date().toISOString(),
  };
}

export function useInvoices(userId?: string) {
  const [allInvoices, setAllInvoices] = useState<(Invoice | DraftInvoice)[]>([]);
  const [loading, setLoading] = useState(true);
  const { getNextInvoiceNumber, loading: numLoading, error: numError } = useInvoiceNumber();

  const loadData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const rows = await localDb.getAllByUserId<Record<string, unknown>>('invoices', userId);
      rows.sort((a, b) =>
        ((b.createdAt as string) ?? '').localeCompare((a.createdAt as string) ?? ''),
      );
      setAllInvoices(rows.map(mapRow));
    } catch (err) {
      console.error('[useInvoices] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    return localDb.onDataChange('invoices', loadData);
  }, [loadData]);

  const invoices = allInvoices.filter((i) => i.status !== 'draft') as Invoice[];
  const drafts = allInvoices.filter((i) => i.status === 'draft') as DraftInvoice[];

  const saveDraft = async (
    draft: DraftInvoice,
  ): Promise<{ id: string; invoiceNumber?: string } | undefined> => {
    if (!userId) return;
    try {
      const id = draft.id || crypto.randomUUID();
      // Assign a real invoice number on the very first save so drafts always
      // show a number (mirrors the quote-draft-numbering fix).
      let invoiceNumber = draft.invoiceNumber;
      if (!draft.id && !invoiceNumber) {
        try { invoiceNumber = await getNextInvoiceNumber(); } catch { /* stay undefined */ }
      }
      const serialized = serializeForDb({
        ...draft,
        userId,
        status: 'draft',
        invoiceNumber,
        createdAt: draft.createdAt ?? new Date(),
      });
      await localDb.upsert('invoices', { ...serialized, id });
      localDb.notifyChange('invoices');
      return { id, invoiceNumber };
    } catch (err) {
      console.error('[useInvoices] saveDraft error:', err);
      throw err;
    }
  };

  const saveInvoice = async (
    invoice: Invoice | DraftInvoice,
    status: InvoiceStatus = 'sent',
    originalDraftId?: string,
  ): Promise<string | undefined> => {
    if (!userId) return;
    try {
      let invoiceNumber = invoice.invoiceNumber;
      if (!invoiceNumber) {
        invoiceNumber = await getNextInvoiceNumber();
      }
      const id = invoice.id || crypto.randomUUID();
      const serialized = serializeForDb({
        ...invoice,
        userId,
        status,
        invoiceNumber,
        createdAt: invoice.createdAt ?? new Date(),
      });
      await localDb.upsert('invoices', { ...serialized, id });
      if (originalDraftId && originalDraftId !== id) {
        await localDb.remove('invoices', originalDraftId);
      }
      localDb.notifyChange('invoices');
      return id;
    } catch (err) {
      console.error('[useInvoices] saveInvoice error:', err);
      throw err;
    }
  };

  const updateStatus = async (id: string, status: InvoiceStatus): Promise<void> => {
    if (!userId) return;
    const row = await localDb.getById<Record<string, unknown>>('invoices', id);
    if (!row) return;
    await localDb.upsert('invoices', { ...row, status, updatedAt: new Date().toISOString() });
    localDb.notifyChange('invoices');
  };

  const deleteInvoice = async (id: string): Promise<void> => {
    try {
      await localDb.remove('invoices', id);
      localDb.notifyChange('invoices');
    } catch (err) {
      console.error('[useInvoices] deleteInvoice error:', err);
      throw err;
    }
  };

  const fetchFullInvoice = async (id: string): Promise<Invoice | null> => {
    try {
      const row = await localDb.getById<Record<string, unknown>>('invoices', id);
      if (!row) return null;
      return mapRow(row) as Invoice;
    } catch {
      return null;
    }
  };

  return {
    invoices,
    drafts,
    allInvoices,
    loading: loading || numLoading,
    saveDraft,
    saveInvoice,
    updateStatus,
    deleteInvoice,
    fetchFullInvoice,
    getNextInvoiceNumber,
    numError,
  };
}
