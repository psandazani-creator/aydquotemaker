// src/components/Quotations/QuoteCard.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Quote, DraftQuote } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import './QuoteCard.css';

interface QuoteCardProps {
  quote: Quote | DraftQuote;
  isDraft: boolean;
  onView: (quote: Quote | DraftQuote) => void;
  onEdit: (quote: Quote | DraftQuote) => void;
  onDelete: (quote: Quote | DraftQuote) => void;
  searchMatches?: any;
}

export function QuoteCard({ quote, isDraft, onView, onEdit, onDelete }: QuoteCardProps) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 220);
    }
    setOpen(o => !o);
  };

  const handle = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div className={`quote-card ${isDraft ? 'draft' : ''}`}>
      <div className="date-wrapper">
        <span className="mobile-label">Date</span>
        <span className="quote-date">{formatDate(quote.createdAt)}</span>
      </div>

      <div className="quote-number-wrapper">
        <span className="mobile-label">Quote #</span>
        <h4 className="quote-number">{quote.quoteNumber || 'Draft'}</h4>
      </div>

      <div className="customer-wrapper">
        <span className="mobile-label">Customer</span>
        <div className="customer-info">
          <p className="quote-customer-name">{quote.customer.name}</p>
          {quote.customer.address && (
            <p className="quote-customer-address">{quote.customer.address}</p>
          )}
        </div>
      </div>

      <div className="amount-wrapper">
        <span className="mobile-label">Amount</span>
        <span className="quote-total">{formatCurrency(quote.total, quote.currency)}</span>
      </div>

      <div className="status-wrapper">
        <span className="mobile-label">Status</span>
        <div className="status-container">
          {isDraft ? (
            <span className="status-badge draft">Draft</span>
          ) : (
            <span className={`status-badge ${quote.status || 'pending'}`}>
              {quote.status || 'Pending'}
            </span>
          )}
        </div>
      </div>

      <div className="actions-wrapper">
        <span className="mobile-label">Actions</span>
        <div className="quote-actions" ref={ref}>
          <button
            ref={btnRef}
            type="button"
            className={`actions-dropdown-btn${open ? ' open' : ''}`}
            onClick={handleToggle}
          >
            Actions <span className="dropdown-chevron">{open ? '▴' : '▾'}</span>
          </button>

          {open && (
            <ul className={`actions-dropdown-menu${dropUp ? ' drop-up' : ''}`}>
              <li>
                <button type="button" onClick={() => handle(() => onView(quote))} className="dropdown-btn">
                  <span className="dropdown-icon">👁</span> View
                </button>
              </li>
              <li>
                <button type="button" onClick={() => handle(() => onEdit(quote))} className="dropdown-btn">
                  <span className="dropdown-icon">✏️</span> Edit
                </button>
              </li>
              <li className="dropdown-divider" />
              <li>
                <button type="button" onClick={() => handle(() => onDelete(quote))} className="dropdown-btn dropdown-btn--danger">
                  <span className="dropdown-icon">🗑</span> Delete
                </button>
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
