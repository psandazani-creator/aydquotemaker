// src/components/Templates/TemplateSelector.tsx
import React from 'react';
import { QuoteTemplate } from '../../types';
import './TemplateSelector.css';

interface TemplateSelectorProps {
  templates: QuoteTemplate[];
  selectedTemplate: string;
  onSelect: (templateId: string) => void;
  userTier: 'free' | 'pro' | 'lifetime';
}

const TEMPLATE_THEMES: Record<string, { header: string; accent: string; row1: string; row2: string; label: string }> = {
  'template1': { header: '#111111', accent: '#555555', row1: '#ffffff', row2: '#f7f7f7', label: 'Classic White' },
  'template2': { header: '#000000', accent: '#333333', row1: '#ffffff', row2: '#f5f5f5', label: 'Monochrome Elite' },
  'template3': { header: '#1B3A6B', accent: '#2952A3', row1: '#ffffff', row2: '#f4f6fb', label: 'Navy Executive' },
  'template4': { header: '#1a4731', accent: '#2d7a52', row1: '#ffffff', row2: '#f5fbf7', label: 'Forest Premium' },
  'template5': { header: '#7B1D1D', accent: '#B91C1C', row1: '#ffffff', row2: '#fdf5f5', label: 'Crimson Prestige' },
};

function MiniPreview({ templateId, tier }: { templateId: string; tier: 'free' | 'pro' }) {
  const t = TEMPLATE_THEMES[templateId];
  if (!t) return <div className="ts-mini-blank" />;

  return (
    <div className="ts-mini" style={{ borderTop: `4px solid ${t.header}` }}>
      <div className="ts-mini-header" style={{ background: t.header }}>
        <div className="ts-mini-logo-box" />
        <div className="ts-mini-title-lines">
          <div className="ts-mini-h-line ts-mini-h-line--wide" />
          <div className="ts-mini-h-line ts-mini-h-line--narrow" />
        </div>
      </div>
      <div className="ts-mini-body">
        <div className="ts-mini-bill-row">
          <div className="ts-mini-b-line ts-mini-b-line--name" style={{ background: t.header }} />
          <div className="ts-mini-b-line ts-mini-b-line--sub" />
        </div>
        <div className="ts-mini-table">
          <div className="ts-mini-thead" style={{ background: t.header }}>
            <div className="ts-mini-th" /><div className="ts-mini-th" /><div className="ts-mini-th" />
          </div>
          <div className="ts-mini-tr" style={{ background: t.row1 }}>
            <div className="ts-mini-td" /><div className="ts-mini-td" /><div className="ts-mini-td" />
          </div>
          <div className="ts-mini-tr" style={{ background: t.row2 }}>
            <div className="ts-mini-td" /><div className="ts-mini-td" /><div className="ts-mini-td" />
          </div>
          <div className="ts-mini-tr" style={{ background: t.row1 }}>
            <div className="ts-mini-td" /><div className="ts-mini-td" /><div className="ts-mini-td" />
          </div>
        </div>
        <div className="ts-mini-total-row">
          <div className="ts-mini-total-bar" style={{ background: t.header }} />
        </div>
      </div>
      <div className="ts-mini-footer" style={{ background: t.header }} />
    </div>
  );
}

export function TemplateSelector({ templates, selectedTemplate, onSelect, userTier }: TemplateSelectorProps) {
  const proTemplates = [
    { id: 'template3', name: 'Navy Executive' },
    { id: 'template4', name: 'Forest Premium' },
    { id: 'template5', name: 'Crimson Prestige' },
  ];

  return (
    <div className="ts-root">
      <div className="ts-grid">
        {templates.map((template) => (
          <button
            key={template.id}
            className={`ts-card ${selectedTemplate === template.id ? 'ts-card--selected' : ''}`}
            onClick={() => onSelect(template.id)}
            title={template.name}
          >
            <MiniPreview templateId={template.id} tier={template.tier} />
            <div className="ts-card-info">
              <span className="ts-card-name">{template.name}</span>
              <span className={`ts-badge ts-badge--${template.tier}`}>
                {template.tier === 'free' ? 'FREE' : 'PRO'}
              </span>
            </div>
          </button>
        ))}

        {userTier === 'free' && (
          <div className="ts-upgrade-card">
            <div className="ts-upgrade-previews">
              {proTemplates.map(pt => (
                <div key={pt.id} className="ts-upgrade-mini">
                  <MiniPreview templateId={pt.id} tier="pro" />
                </div>
              ))}
            </div>
            <div className="ts-upgrade-body">
              <p className="ts-upgrade-title">3 Pro Templates</p>
              <p className="ts-upgrade-sub">Navy · Forest · Crimson</p>
              <button className="ts-upgrade-btn">Upgrade to Pro</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
