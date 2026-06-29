// src/hooks/useQuoteNumber.ts
import { useState, useCallback } from 'react';

interface UseQuoteNumberReturn {
  getNextQuoteNumber: () => Promise<number>;
  getPreviewQuoteNumber: () => Promise<number>;
  loading: boolean;
  error: string | null;
}

export function useQuoteNumber(): UseQuoteNumberReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getNextQuoteNumber = useCallback(async (): Promise<number> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/next-quote-number', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to get next quote number');
      const { number } = await res.json();
      return number;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate quote number';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPreviewQuoteNumber = useCallback(async (): Promise<number> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/preview-quote-number');
      if (!res.ok) return 1001;
      const { number } = await res.json();
      return number;
    } catch {
      return 1001;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getNextQuoteNumber, getPreviewQuoteNumber, loading, error };
}
