import { Customer, LineItem } from './index';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

export interface InvoiceDetails {
  issuedDate: string | Date;
  dueDate?: string | Date;
  currency: 'USD' | 'ZWG';
  vatEnabled: boolean;
  vatRate: number;
  paymentTerms?: string;
  reference?: string;
  bankDetails?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: Customer;
  details?: InvoiceDetails;
  lineItems?: LineItem[];
  notes?: string;
  templateId?: string;
  status: InvoiceStatus;
  createdAt: Date;
  updatedAt: Date;
  total: number;
  subtotal: number;
  tax: number;
  currency: 'USD' | 'ZWG';
  companyLogo?: string | null;
}

export interface DraftInvoice extends Omit<Invoice, 'invoiceNumber' | 'id'> {
  id?: string;
  invoiceNumber?: string;
  status: 'draft';
  isOffline: boolean;
  syncedAt?: Date;
  companyLogo?: string | null;
}
