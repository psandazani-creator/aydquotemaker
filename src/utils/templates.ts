// src/utils/templates.ts
import { QuoteTemplate } from '../types';

export const quoteTemplates: QuoteTemplate[] = [
  // ── FREE TEMPLATES (2) ──────────────────────────────────────────────────────
  {
    id: 'template1',
    name: 'Classic White',
    tier: 'free',
    preview: '/templates/preview1.png',
    styles: {
      primaryColor: '#111111',
      secondaryColor: '#FFFFFF',
      accentColor: '#555555',
      fontFamily: 'Arial, sans-serif',
      headerStyle: 'classic-white',
      tableStyle: 'minimal',
      showLogo: true,
      watermark: false,
    },
  },
  {
    id: 'template2',
    name: 'Monochrome Elite',
    tier: 'free',
    preview: '/templates/preview2.png',
    styles: {
      primaryColor: '#000000',
      secondaryColor: '#FFFFFF',
      accentColor: '#333333',
      fontFamily: 'Georgia, serif',
      headerStyle: 'monochrome-elite',
      tableStyle: 'bordered',
      showLogo: true,
      watermark: false,
    },
  },

  // ── PRO TEMPLATES (3) ───────────────────────────────────────────────────────
  {
    id: 'template3',
    name: 'Navy Executive',
    tier: 'pro',
    preview: '/templates/preview3.png',
    styles: {
      primaryColor: '#1B3A6B',
      secondaryColor: '#FFFFFF',
      accentColor: '#2952A3',
      fontFamily: 'Arial, sans-serif',
      headerStyle: 'navy-executive',
      tableStyle: 'minimal',
      showLogo: true,
      watermark: false,
    },
  },
  {
    id: 'template4',
    name: 'Forest Premium',
    tier: 'pro',
    preview: '/templates/preview4.png',
    styles: {
      primaryColor: '#1a4731',
      secondaryColor: '#FFFFFF',
      accentColor: '#2d7a52',
      fontFamily: 'Helvetica, sans-serif',
      headerStyle: 'forest-premium',
      tableStyle: 'minimal',
      showLogo: true,
      watermark: false,
    },
  },
  {
    id: 'template5',
    name: 'Crimson Prestige',
    tier: 'pro',
    preview: '/templates/preview5.png',
    styles: {
      primaryColor: '#7B1D1D',
      secondaryColor: '#FFFFFF',
      accentColor: '#B91C1C',
      fontFamily: 'Georgia, serif',
      headerStyle: 'crimson-prestige',
      tableStyle: 'bordered',
      showLogo: true,
      watermark: false,
    },
  },
];

export function getAvailableTemplates(tier: 'free' | 'pro' | 'lifetime'): QuoteTemplate[] {
  if (tier === 'free') {
    return quoteTemplates.filter(t => t.tier === 'free');
  }
  return quoteTemplates;
}

export function getTemplateById(id: string): QuoteTemplate | undefined {
  return quoteTemplates.find(t => t.id === id);
}
