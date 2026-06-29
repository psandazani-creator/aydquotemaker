// src/utils/quoteNumberGenerator.ts

export async function generateQuoteNumber(_userId: string): Promise<string> {
  try {
    const res = await fetch('/api/settings/next-quote-number', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to generate quote number');
    const { number } = await res.json();
    return `QT-${number.toString().padStart(4, '0')}`;
  } catch (error) {
    console.error('Error generating quote number:', error);
    return `QT-${Date.now().toString().slice(-4)}`;
  }
}
