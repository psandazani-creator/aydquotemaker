import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useInvoices } from '../../hooks/useInvoices';
import { useAutoSave } from '../../hooks/useAutoSave';
import { AutoSaveIndicator } from '../Common/AutoSaveIndicator';
import { Invoice, DraftInvoice, InvoiceDetails } from '../../types/invoice';
import { Customer, LineItem } from '../../types';
import { showNotification } from '../Notification/Notification';
import { handleFormEnterKey } from '../../utils/formKeyNav';
import './InvoiceForm.css';

const PAYMENT_TERMS_OPTIONS = [
  'Due on Receipt',
  'Net 7',
  'Net 15',
  'Net 30',
  'Net 60',
];

const DRAFT_KEY = 'invoice-draft-';

function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: '', quantity: 1, price: 0, total: 0 };
}

function calcTotals(items: LineItem[], vatEnabled: boolean, vatRate: number) {
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.price), 0);
  const tax = vatEnabled ? subtotal * (vatRate / 100) : 0;
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

export function InvoiceForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const { user } = useApp();
  const { saveDraft, saveInvoice, fetchFullInvoice } = useInvoices(user?.id);

  const [autoSaveId, setAutoSaveId] = useState<string | undefined>(editId ?? undefined);
  const [invoiceNumber, setInvoiceNumber] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(!!editId);
  const [isSaving, setIsSaving] = useState(false);

  const [customer, setCustomer] = useState<Customer>({ name: '', phone: '', email: '', address: '' });
  const [details, setDetails] = useState<InvoiceDetails>({
    issuedDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    currency: user?.preferences?.currency ?? 'USD',
    vatEnabled: false,
    vatRate: user?.preferences?.vatRate ?? 15,
    paymentTerms: 'Net 30',
    reference: '',
    bankDetails: '',
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()]);
  const [notes, setNotes] = useState('');

  // Load existing invoice for editing
  useEffect(() => {
    if (!editId) {
      const saved = localStorage.getItem(DRAFT_KEY + 'new');
      if (saved) {
        try {
          const d = JSON.parse(saved);
          if (d.customer) setCustomer(d.customer);
          if (d.details) setDetails(d.details);
          if (d.lineItems?.length) setLineItems(d.lineItems);
          if (d.notes) setNotes(d.notes);
        } catch { /* ignore */ }
      }
      return;
    }
    (async () => {
      setIsLoading(true);
      const inv = await fetchFullInvoice(editId);
      if (inv) {
        if (inv.customer) setCustomer(inv.customer as Customer);
        if (inv.details) setDetails({
          issuedDate: inv.details.issuedDate ? new Date(inv.details.issuedDate).toISOString().split('T')[0] : '',
          dueDate: inv.details.dueDate ? new Date(inv.details.dueDate).toISOString().split('T')[0] : '',
          currency: inv.details.currency ?? 'USD',
          vatEnabled: inv.details.vatEnabled ?? false,
          vatRate: inv.details.vatRate ?? 15,
          paymentTerms: inv.details.paymentTerms ?? 'Net 30',
          reference: inv.details.reference ?? '',
          bankDetails: inv.details.bankDetails ?? '',
        });
        if (inv.lineItems?.length) setLineItems(inv.lineItems);
        if (inv.notes) setNotes(inv.notes);
        if (inv.invoiceNumber) setInvoiceNumber(inv.invoiceNumber);
      }
      setIsLoading(false);
    })();
  }, [editId]);

  const buildDraft = useCallback((): DraftInvoice => {
    const { subtotal, tax, total } = calcTotals(lineItems, details.vatEnabled, details.vatRate);
    return {
      id: autoSaveId,
      invoiceNumber,
      customer,
      details,
      lineItems,
      notes,
      status: 'draft',
      isOffline: !navigator.onLine,
      currency: details.currency,
      subtotal,
      tax,
      total,
      createdAt: new Date(),
      updatedAt: new Date(),
      companyLogo: user?.companyLogo ?? null,
    };
  }, [customer, details, lineItems, notes, autoSaveId, invoiceNumber, user]);

  const onAutoSave = useCallback(async (draft: DraftInvoice) => {
    const result = await saveDraft(draft);
    if (result?.id && !autoSaveId) setAutoSaveId(result.id);
    if (result?.invoiceNumber && !invoiceNumber) setInvoiceNumber(result.invoiceNumber);
    localStorage.setItem(DRAFT_KEY + (autoSaveId ?? 'new'), JSON.stringify({
      customer: draft.customer,
      details: draft.details,
      lineItems: draft.lineItems,
      notes: draft.notes,
    }));
  }, [saveDraft, autoSaveId, invoiceNumber]);

  const { status: autoSaveStatus, flush } = useAutoSave(buildDraft, onAutoSave);

  // Line item helpers
  const addLine = () => setLineItems(p => [...p, newLineItem()]);
  const removeLine = (id: string) => setLineItems(p => p.filter(l => l.id !== id));
  const updateLine = (id: string, field: keyof LineItem, val: string | number) => {
    setLineItems(p => p.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: val };
      updated.total = updated.quantity * updated.price;
      return updated;
    }));
  };

  const { subtotal, tax, total } = calcTotals(lineItems, details.vatEnabled, details.vatRate);

  const handleSaveDraft = async () => {
    if (!customer.name.trim()) {
      showNotification('Please add a customer name.', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      await flush();
      showNotification('Draft saved.', 'success');
      navigate('/invoices');
    } catch {
      showNotification('Failed to save draft.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleIssue = async () => {
    if (!customer.name.trim()) {
      showNotification('Customer name is required.', 'warning');
      return;
    }
    if (lineItems.every(l => !l.description.trim())) {
      showNotification('Add at least one line item.', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const draft = buildDraft();
      await saveInvoice(draft, 'sent', autoSaveId);
      localStorage.removeItem(DRAFT_KEY + (autoSaveId ?? 'new'));
      showNotification('Invoice issued!', 'success');
      navigate('/invoices');
    } catch (err) {
      console.error(err);
      showNotification('Failed to issue invoice.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFinal = async () => {
    if (!customer.name.trim()) {
      showNotification('Customer name is required.', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const draft = buildDraft();
      await saveInvoice(draft, editId ? (draft as any).status || 'sent' : 'sent', autoSaveId);
      localStorage.removeItem(DRAFT_KEY + (autoSaveId ?? 'new'));
      showNotification('Invoice saved.', 'success');
      navigate('/invoices');
    } catch {
      showNotification('Failed to save invoice.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const cur = details.currency === 'ZWG' ? 'ZWG ' : '$';

  if (isLoading) {
    return (
      <div className="inv-form__loading">
        <div className="inv-form__spinner" />
        <p>Loading invoice…</p>
      </div>
    );
  }

  return (
    <div className="inv-form" onKeyDown={handleFormEnterKey}>
      {/* Top bar */}
      <div className="inv-form__topbar">
        <button className="inv-form__back" onClick={() => navigate('/invoices')}>
          <i className="fas fa-arrow-left" /> Back
        </button>
        <h2 className="inv-form__title">
          {editId ? 'Edit Invoice' : 'New Invoice'}
        </h2>
        <AutoSaveIndicator status={autoSaveStatus} />
      </div>

      {/* Customer */}
      <section className="inv-form__section">
        <h3 className="inv-form__section-title">
          <i className="fas fa-user" /> Bill To
        </h3>
        <div className="inv-form__grid inv-form__grid--2">
          <div className="inv-form__field">
            <label>Customer Name *</label>
            <input
              type="text"
              placeholder="Company or person name"
              value={customer.name}
              onChange={e => setCustomer(p => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="inv-form__field">
            <label>Email</label>
            <input
              type="email"
              placeholder="customer@email.com"
              value={customer.email ?? ''}
              onChange={e => setCustomer(p => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div className="inv-form__field">
            <label>Phone</label>
            <input
              type="tel"
              placeholder="+263 77 000 0000"
              value={customer.phone ?? ''}
              onChange={e => setCustomer(p => ({ ...p, phone: e.target.value }))}
            />
          </div>
          <div className="inv-form__field">
            <label>Address</label>
            <input
              type="text"
              placeholder="City, Country"
              value={customer.address ?? ''}
              onChange={e => setCustomer(p => ({ ...p, address: e.target.value }))}
            />
          </div>
        </div>
      </section>

      {/* Invoice Details */}
      <section className="inv-form__section">
        <h3 className="inv-form__section-title">
          <i className="fas fa-file-invoice" /> Invoice Details
        </h3>
        <div className="inv-form__grid inv-form__grid--3">
          <div className="inv-form__field">
            <label>Issue Date *</label>
            <input
              type="date"
              value={typeof details.issuedDate === 'string' ? details.issuedDate : ''}
              onChange={e => setDetails(p => ({ ...p, issuedDate: e.target.value }))}
            />
          </div>
          <div className="inv-form__field">
            <label>Due Date</label>
            <input
              type="date"
              value={typeof details.dueDate === 'string' ? details.dueDate : ''}
              onChange={e => setDetails(p => ({ ...p, dueDate: e.target.value }))}
            />
          </div>
          <div className="inv-form__field">
            <label>Payment Terms</label>
            <select
              value={details.paymentTerms ?? ''}
              onChange={e => setDetails(p => ({ ...p, paymentTerms: e.target.value }))}
            >
              {PAYMENT_TERMS_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="inv-form__field">
            <label>Reference / PO Number</label>
            <input
              type="text"
              placeholder="PO-12345"
              value={details.reference ?? ''}
              onChange={e => setDetails(p => ({ ...p, reference: e.target.value }))}
            />
          </div>
          <div className="inv-form__field">
            <label>Currency</label>
            <select
              value={details.currency}
              onChange={e => setDetails(p => ({ ...p, currency: e.target.value as 'USD' | 'ZWG' }))}
            >
              <option value="USD">USD ($)</option>
              <option value="ZWG">ZWG</option>
            </select>
          </div>
        </div>
      </section>

      {/* Line Items */}
      <section className="inv-form__section">
        <div className="inv-form__section-header">
          <h3 className="inv-form__section-title">
            <i className="fas fa-list" /> Line Items
          </h3>
          <button className="inv-form__add-line" onClick={addLine}>
            <i className="fas fa-plus" /> Add Item
          </button>
        </div>

        <div className="inv-form__lines-header">
          <span className="inv-form__lines-desc">Description</span>
          <span>Qty</span>
          <span>Unit Price</span>
          <span>Total</span>
          <span />
        </div>

        {lineItems.map((item, idx) => (
          <div key={item.id} className="inv-form__line">
            <input
              className="inv-form__line-desc"
              type="text"
              placeholder={`Item ${idx + 1}`}
              value={item.description}
              onChange={e => updateLine(item.id, 'description', e.target.value)}
            />
            <input
              type="number"
              min={0}
              step={1}
              value={item.quantity}
              onChange={e => updateLine(item.id, 'quantity', Number(e.target.value))}
            />
            <input
              type="number"
              min={0}
              step={0.01}
              value={item.price}
              onChange={e => updateLine(item.id, 'price', Number(e.target.value))}
            />
            <span className="inv-form__line-total">
              {cur}{(item.quantity * item.price).toFixed(2)}
            </span>
            <button
              className="inv-form__line-remove"
              onClick={() => removeLine(item.id)}
              disabled={lineItems.length === 1}
            >
              <i className="fas fa-times" />
            </button>
          </div>
        ))}

        {/* Totals */}
        <div className="inv-form__totals">
          <div className="inv-form__total-row">
            <span>Subtotal</span>
            <span>{cur}{subtotal.toFixed(2)}</span>
          </div>
          {details.vatEnabled && (
            <div className="inv-form__total-row">
              <span>VAT ({details.vatRate}%)</span>
              <span>{cur}{tax.toFixed(2)}</span>
            </div>
          )}
          <div className="inv-form__total-row inv-form__total-row--grand">
            <span>Total</span>
            <span>{cur}{total.toFixed(2)}</span>
          </div>
        </div>
      </section>

      {/* Notes */}
      <section className="inv-form__section">
        <h3 className="inv-form__section-title">
          <i className="fas fa-sticky-note" /> Notes
        </h3>
        <textarea
          className="inv-form__notes"
          placeholder="Additional notes or instructions for the client…"
          value={notes}
          rows={3}
          onChange={e => setNotes(e.target.value)}
        />
      </section>

      {/* Bank / Payment Info */}
      <section className="inv-form__section">
        <h3 className="inv-form__section-title">
          <i className="fas fa-university" /> Payment Instructions
        </h3>
        <textarea
          className="inv-form__notes"
          placeholder="Bank details, EcoCash number, or payment instructions…"
          value={details.bankDetails ?? ''}
          rows={3}
          onChange={e => setDetails(p => ({ ...p, bankDetails: e.target.value }))}
        />
      </section>

      {/* Actions */}
      <div className="inv-form__actions">
        <button
          className="inv-form__btn inv-form__btn--draft"
          onClick={handleSaveDraft}
          disabled={isSaving}
        >
          <i className="fas fa-save" /> Save Draft
        </button>
        <button
          className="inv-form__btn inv-form__btn--issue"
          onClick={handleIssue}
          disabled={isSaving}
        >
          <i className="fas fa-paper-plane" /> Issue Invoice
        </button>
      </div>
    </div>
  );
}
