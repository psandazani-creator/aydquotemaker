// src/components/Quotations/QuoteManagementModal.tsx
import React, { useState, useMemo } from 'react';
import { Quote, DraftQuote } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useApp } from '../../context/AppContext';
import './QuoteManagementModal.css';

interface QuoteManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotes: Quote[];
  drafts: DraftQuote[];
  onEditQuote: (quote: Quote | DraftQuote) => void;
  onDeleteQuote: (quoteId: string) => void;
  onViewQuote: (quote: Quote | DraftQuote) => void;
}

export function QuoteManagementModal({
  isOpen,
  onClose,
  quotes,
  drafts,
  onEditQuote,
  onDeleteQuote,
  onViewQuote
}: QuoteManagementModalProps) {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<'all' | 'final' | 'draft'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'number' | 'customer' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Combine all quotes for display
  const allQuotes = useMemo(() => {
    try {
      let combined = [...quotes, ...drafts];

      // Filter by active tab
      if (activeTab === 'final') {
        combined = quotes;
      } else if (activeTab === 'draft') {
        combined = drafts;
      }

      // Filter by search term
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        combined = combined.filter(quote => {
          try {
            return (
              (quote.quoteNumber || '').toLowerCase().includes(searchLower) ||
              quote.customer.name.toLowerCase().includes(searchLower) ||
              (quote.customer.email || '').toLowerCase().includes(searchLower)
            );
          } catch (error) {
            console.error('Error filtering quote:', error);
            return false;
          }
        });
      }

      // Sort quotes
      combined.sort((a, b) => {
        try {
          let comparison = 0;

          switch (sortBy) {
            case 'date':
              comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
              break;
            case 'number':
              comparison = (a.quoteNumber || '').localeCompare(b.quoteNumber || '');
              break;
            case 'customer':
              comparison = a.customer.name.localeCompare(b.customer.name);
              break;
            case 'amount':
              comparison = a.total - b.total;
              break;
          }

          return sortOrder === 'asc' ? comparison : -comparison;
        } catch (error) {
          console.error('Error sorting quotes:', error);
          return 0;
        }
      });

      return combined;
    } catch (error) {
      console.error('Error in QuoteManagementModal:', error);
      return [];
    }
  }, [quotes, drafts, activeTab, searchTerm, sortBy, sortOrder]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal quote-management-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Manage All Quotations</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="management-controls">
          <div className="management-tabs">
            <button
              className={`tab ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              All ({quotes.length + drafts.length})
            </button>
            <button
              className={`tab ${activeTab === 'final' ? 'active' : ''}`}
              onClick={() => setActiveTab('final')}
            >
              Final ({quotes.length})
            </button>
            <button
              className={`tab ${activeTab === 'draft' ? 'active' : ''}`}
              onClick={() => setActiveTab('draft')}
            >
              Draft ({drafts.length})
            </button>
          </div>

          <div className="management-filters">
            <input
              type="text"
              placeholder="Search quotes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="sort-select"
            >
              <option value="date">Sort by Date</option>
              <option value="number">Sort by Number</option>
              <option value="customer">Sort by Customer</option>
              <option value="amount">Sort by Amount</option>
            </select>

            <button
              className="sort-order-btn"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? ' ascending' : ' descending'}
            </button>
          </div>
        </div>

        <div className="quotes-table-container">
          <table className="quotes-management-table">
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allQuotes.map((quote) => (
                <tr key={quote.id} className={quote.status === 'draft' ? 'draft-row' : 'final-row'}>
                  <td className="quote-number">{quote.quoteNumber || 'Draft'}</td>
                  <td className="customer-name">{quote.customer.name}</td>
                  <td className="quote-date">
                    {(() => {
                      try {
                        return formatDate(new Date(quote.createdAt));
                      } catch (error) {
                        console.error('Error formatting date:', error);
                        return 'Invalid Date';
                      }
                    })()}
                  </td>
                  <td className="quote-total">{formatCurrency(quote.total, quote.currency)}</td>
                  <td className="quote-status">
                    <span className={`status-badge ${quote.status}`}>
                      {quote.status === 'draft' ? 'Draft' : 'Final'}
                    </span>
                  </td>
                  <td className="quote-actions">
                    <button
                      className="action-btn view-btn"
                      onClick={() => onViewQuote(quote)}
                      title="View Quote"
                    >
                      View
                    </button>
                    <button
                      className="action-btn edit-btn"
                      onClick={() => onEditQuote(quote)}
                      title="Edit Quote"
                    >
                      Edit
                    </button>
                    <button
                      className="action-btn delete-btn"
                      onClick={() => onDeleteQuote(quote.id || '')}
                      title="Delete Quote"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {allQuotes.length === 0 && (
            <div className="empty-state">
              <p>No quotations found</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <div className="summary-info">
            Showing {allQuotes.length} of {quotes.length + drafts.length} quotations
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
