// src/utils/formatters.ts

export function formatCurrency(amount: number, currency: 'USD' | 'ZWG'): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'USD' ? 'USD' : 'ZWD',
    minimumFractionDigits: 2,
  });

  return formatter.format(amount);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function calculateLineTotal(quantity: number, price: number): number {
  return quantity * price;
}

export function calculateSubtotal(lineItems: Array<{ total: number }>): number {
  return lineItems.reduce((sum, item) => sum + item.total, 0);
}

export function calculateTax(subtotal: number, vatRate: number, vatEnabled: boolean): number {
  return vatEnabled ? subtotal * (vatRate / 100) : 0;
}

export function calculateTotal(subtotal: number, tax: number): number {
  return subtotal + tax;
}