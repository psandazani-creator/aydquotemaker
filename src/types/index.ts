// src/types/index.ts

export interface User {
  id: string;
  email: string;
  name: string;
  licenseKey: string;
  tier: 'free' | 'pro' | 'lifetime';
  createdAt: Date;
  updatedAt?: Date;
  deviceLimit: number;
  isAdmin?: boolean;
  companyLogo?: string | null;
  companyName?: string;
  companyPhone?: string;
  companyAddress?: string;
  preferences?: {
    currency: 'USD' | 'ZWG';
    vatRate: number;
    defaultTemplate?: string;
  };
  contractsLicense?: {
    active: boolean;
    expiresAt?: Date;
    purchasedAt?: Date;
  };
}

export interface Quote {
  id: string;
  quoteNumber: string;
  customer: Customer;
  details?: QuoteDetails;
  lineItems?: LineItem[];
  notes?: string;
  templateId?: string;
  status: 'draft' | 'final';
  createdAt: Date;
  updatedAt: Date;
  total: number;
  subtotal: number;
  tax: number;
  currency: 'USD' | 'ZWG';
  companyLogo?: string | null;
}

export interface Customer {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface QuoteDetails {
  validUntil: Date;
  currency: 'USD' | 'ZWG';
  vatEnabled: boolean;
  vatRate: number;
}

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
  total: number;
  vatEnabled?: boolean;
  vatRate?: number;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  tier: 'free' | 'pro';
  preview: string;
  styles: TemplateStyles;
}

export interface TemplateStyles {
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  fontFamily: string;
  headerStyle: 'centered' | 'split' | 'minimal' | 'professional' | 'minimal-modern' | 'sidebar' | 'dark-elegant' | 'gradient-card' | 'invoice-style';
  tableStyle: 'bordered' | 'striped' | 'minimal' | 'professional' | 'minimal-modern' | 'sidebar' | 'dark-elegant' | 'gradient-card' | 'invoice-style';
  showLogo: boolean;
  watermark: boolean;
}

export interface DraftQuote extends Omit<Quote, 'quoteNumber' | 'id'> {
  id?: string;
  quoteNumber?: string;
  status: 'draft';
  isOffline: boolean;
  syncedAt?: Date;
  companyLogo?: string | null;
}

export interface AppState {
  user: User | null;
  quotes: Quote[];
  drafts: DraftQuote[];
  currentQuote: Quote | DraftQuote | null;
  isOnline: boolean;
  drawerOpen: boolean;
}
