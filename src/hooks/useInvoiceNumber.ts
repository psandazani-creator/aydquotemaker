import { useState, useCallback } from 'react';

interface UseInvoiceNumberReturn {
  getNextInvoiceNumber: () => Promise<string>;
  getPreviewInvoiceNumber: () => Promise<string>;
  loading: boolean;
  error: string | null;
}

const INV_FALLBACK = 'INV-1001';

export function useInvoiceNumber(): UseInvoiceNumberReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getNextInvoiceNumber = useCallback(async (): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/next-invoice-number', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to get next invoice number');
      const { number } = await res.json();
      return `INV-${number}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate invoice number';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPreviewInvoiceNumber = useCallback(async (): Promise<string> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/preview-invoice-number');
      if (!res.ok) return INV_FALLBACK;
      const { number } = await res.json();
      return `INV-${number}`;
    } catch {
      return INV_FALLBACK;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getNextInvoiceNumber, getPreviewInvoiceNumber, loading, error };
}
