import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useInvoices } from '../../hooks/useInvoices';
import { Invoice, DraftInvoice, InvoiceStatus } from '../../types/invoice';
import { InvoicePreview } from './InvoicePreview';
import { showNotification } from '../Notification/Notification';
import './InvoicesPage.css';

type FilterTab = 'all' | InvoiceStatus;

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
};

function fmt(n: number, cur: string) {
  return `${cur === 'ZWG' ? 'ZWG ' : '$'}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: Date | string | undefined) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function InvoiceRowDropdown({
  inv,
  onView,
  onEdit,
  onMarkSent,
  onMarkPaid,
  onMarkOverdue,
  onDelete,
}: {
  inv: Invoice | DraftInvoice;
  onView: () => void;
  onEdit: () => void;
  onMarkSent?: () => void;
  onMarkPaid?: () => void;
  onMarkOverdue?: () => void;
  onDelete: () => void;
}) {
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
      setDropUp(window.innerHeight - rect.bottom < 220);
    }
    setOpen(o => !o);
  };

  const details = inv.details as any;
  const dueDate = details?.dueDate;
  const isOverduable = inv.status === 'sent' && dueDate && new Date(dueDate) < new Date();

  return (
    <div className="inv-row-dropdown" ref={ref}>
      <button
        ref={btnRef}
        className={`inv-row-dropdown__trigger${open ? ' open' : ''}`}
        onClick={handleToggle}
      >
        Actions <span className="inv-row-dropdown__chevron">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <ul className={`inv-row-dropdown__menu${dropUp ? ' drop-up' : ''}`}>
          <li>
            <button onClick={() => { onView(); setOpen(false); }}>
              <span>👁</span> View
            </button>
          </li>
          <li>
            <button onClick={() => { onEdit(); setOpen(false); }}>
              <span>✏️</span> Edit
            </button>
          </li>
          {inv.status === 'draft' && onMarkSent && (
            <li>
              <button onClick={() => { onMarkSent(); setOpen(false); }}>
                <span>✉️</span> Mark Sent
              </button>
            </li>
          )}
          {(inv.status === 'sent' || inv.status === 'overdue') && onMarkPaid && (
            <li>
              <button onClick={() => { onMarkPaid(); setOpen(false); }}>
                <span>✅</span> Mark Paid
              </button>
            </li>
          )}
          {isOverduable && onMarkOverdue && (
            <li>
              <button onClick={() => { onMarkOverdue(); setOpen(false); }}>
                <span>⚠️</span> Mark Overdue
              </button>
            </li>
          )}
          <li className="inv-row-dropdown__divider" />
          <li>
            <button className="inv-row-dropdown__danger" onClick={() => { onDelete(); setOpen(false); }}>
              <span>🗑</span> Delete
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const { user } = useApp();
  const { allInvoices, invoices, drafts, loading, deleteInvoice, updateStatus } = useInvoices(user?.id);

  const [filter, setFilter] = useState<FilterTab>('all');
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | DraftInvoice | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const stats = useMemo(() => {
    const paid = invoices.filter(i => i.status === 'paid');
    const sent = invoices.filter(i => i.status === 'sent');
    const overdue = invoices.filter(i => i.status === 'overdue');
    return {
      total: allInvoices.reduce((s, i) => s + (i.total ?? 0), 0),
      paid: paid.reduce((s, i) => s + (i.total ?? 0), 0),
      outstanding: sent.reduce((s, i) => s + (i.total ?? 0), 0),
      overdue: overdue.reduce((s, i) => s + (i.total ?? 0), 0),
      draftCount: drafts.length,
      paidCount: paid.length,
      sentCount: sent.length,
      overdueCount: overdue.length,
    };
  }, [allInvoices, invoices, drafts]);

  const filtered = useMemo(() => {
    if (filter === 'all') return allInvoices;
    return allInvoices.filter(i => i.status === filter);
  }, [allInvoices, filter]);

  const currency = user?.preferences?.currency ?? 'USD';

  const handleDelete = async (id: string) => {
    try {
      await deleteInvoice(id);
      showNotification('Invoice deleted.', 'success');
      setConfirmDelete(null);
    } catch {
      showNotification('Failed to delete invoice.', 'error');
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await updateStatus(id, 'paid');
      showNotification('Invoice marked as paid.', 'success');
    } catch {
      showNotification('Failed to update invoice.', 'error');
    }
  };

  const handleMarkSent = async (id: string) => {
    try {
      await updateStatus(id, 'sent');
      showNotification('Invoice marked as sent.', 'success');
    } catch {
      showNotification('Failed to update invoice.', 'error');
    }
  };

  const handleMarkOverdue = async (id: string) => {
    try {
      await updateStatus(id, 'overdue');
      showNotification('Invoice marked as overdue.', 'success');
    } catch {
      showNotification('Failed to update invoice.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="inv-page__loading">
        <div className="inv-page__spinner" />
        <p>Loading invoices…</p>
      </div>
    );
  }

  return (
    <div className="inv-page">
      {/* Header */}
      <div className="inv-page__header">
        <div>
          <h2 className="inv-page__title">Invoices</h2>
          <p className="inv-page__subtitle">
            {allInvoices.length} invoice{allInvoices.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <button className="inv-page__new-btn" onClick={() => navigate('/create-invoice')}>
          <i className="fas fa-plus" /> New Invoice
        </button>
      </div>

      {/* Stats */}
      <div className="inv-page__stats">
        <div className="inv-stat inv-stat--total">
          <span className="inv-stat__label">Total Invoiced</span>
          <span className="inv-stat__value">{fmt(stats.total, currency)}</span>
          <span className="inv-stat__sub">{allInvoices.length} invoices</span>
        </div>
        <div className="inv-stat inv-stat--paid">
          <span className="inv-stat__label">Paid</span>
          <span className="inv-stat__value">{fmt(stats.paid, currency)}</span>
          <span className="inv-stat__sub">{stats.paidCount} invoices</span>
        </div>
        <div className="inv-stat inv-stat--outstanding">
          <span className="inv-stat__label">Outstanding</span>
          <span className="inv-stat__value">{fmt(stats.outstanding, currency)}</span>
          <span className="inv-stat__sub">{stats.sentCount} invoices</span>
        </div>
        <div className="inv-stat inv-stat--overdue">
          <span className="inv-stat__label">Overdue</span>
          <span className="inv-stat__value">{fmt(stats.overdue, currency)}</span>
          <span className="inv-stat__sub">{stats.overdueCount} invoices</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="inv-page__tabs">
        {(['all', 'draft', 'sent', 'paid', 'overdue'] as FilterTab[]).map(t => (
          <button
            key={t}
            className={`inv-tab ${filter === t ? 'inv-tab--active' : ''}`}
            onClick={() => setFilter(t)}
          >
            {t === 'all' ? 'All' : STATUS_LABELS[t]}
            <span className="inv-tab__count">
              {t === 'all'
                ? allInvoices.length
                : allInvoices.filter(i => i.status === t).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="inv-page__empty">
          <i className="fas fa-file-invoice" />
          <p>{filter === 'all' ? 'No invoices yet.' : `No ${filter} invoices.`}</p>
          {filter === 'all' && (
            <button className="inv-page__new-btn" onClick={() => navigate('/create-invoice')}>
              Create your first invoice
            </button>
          )}
        </div>
      ) : (
        <div className="inv-table-wrap">
          {/* Table header */}
          <div className="inv-table-header">
            <div className="inv-th">Date</div>
            <div className="inv-th">Invoice #</div>
            <div className="inv-th">Customer</div>
            <div className="inv-th inv-th--right">Amount</div>
            <div className="inv-th">Status</div>
            <div className="inv-th">Actions</div>
          </div>

          {/* Table rows */}
          <div className="inv-table-body">
            {filtered.map(inv => (
              <div key={inv.id} className={`inv-row inv-row--${inv.status}`}>
                <div className="inv-td inv-td--date">{fmtDate(inv.createdAt)}</div>
                <div className="inv-td inv-td--number">{inv.invoiceNumber ?? <span className="inv-draft-tag">DRAFT</span>}</div>
                <div className="inv-td inv-td--customer">
                  <span className="inv-customer-name">{(inv.customer as any)?.name ?? '—'}</span>
                  {(inv.customer as any)?.address && (
                    <span className="inv-customer-addr">{(inv.customer as any).address}</span>
                  )}
                </div>
                <div className="inv-td inv-td--amount">{fmt(inv.total ?? 0, inv.currency ?? currency)}</div>
                <div className="inv-td inv-td--status">
                  <span className={`inv-badge inv-badge--${inv.status}`}>{STATUS_LABELS[inv.status]}</span>
                </div>
                <div className="inv-td inv-td--actions">
                  <InvoiceRowDropdown
                    inv={inv}
                    onView={() => setPreviewInvoice(inv)}
                    onEdit={() => navigate(`/create-invoice?id=${inv.id}`)}
                    onMarkSent={() => handleMarkSent(inv.id!)}
                    onMarkPaid={() => handleMarkPaid(inv.id!)}
                    onMarkOverdue={() => handleMarkOverdue(inv.id!)}
                    onDelete={() => setConfirmDelete(inv.id!)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="inv-confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="inv-confirm" onClick={e => e.stopPropagation()}>
            <h4>Delete invoice?</h4>
            <p>This action cannot be undone.</p>
            <div className="inv-confirm__actions">
              <button className="inv-confirm__cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="inv-confirm__delete" onClick={() => handleDelete(confirmDelete)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewInvoice && (
        <InvoicePreview
          invoice={previewInvoice}
          onClose={() => setPreviewInvoice(null)}
        />
      )}
    </div>
  );
}
