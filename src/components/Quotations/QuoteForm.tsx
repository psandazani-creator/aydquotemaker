// src/components/Quotations/QuoteForm.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Quote, DraftQuote, Customer, QuoteDetails, LineItem } from '../../types';
import { useApp } from '../../context/AppContext';
import { useQuotes } from '../../hooks/useQuotes';
import { useQuoteNumber } from '../../hooks/useQuoteNumber';
import { calculateLineTotal, calculateSubtotal, calculateTax, calculateTotal } from '../../utils/formatters';
import { AutoSaveIndicator } from '../Common/AutoSaveIndicator';
import { showNotification } from '../Notification/Notification';
import { loadDraftFromStorage, clearDraftFromStorage } from '../../utils/draftStorage';
import { useAutoSave } from '../../hooks/useAutoSave';
import { handleFormEnterKey } from '../../utils/formKeyNav';
import '../Invoices/InvoiceForm.css';
import './QuoteForm.css';

const DRAFT_KEY_PREFIX = 'quoteform_';

function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: '', quantity: 1, price: 0, total: 0, vatEnabled: false, vatRate: 15 };
}

function calcTotals(items: LineItem[], vatEnabled: boolean, vatRate: number) {
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.price), 0);
  const tax = vatEnabled ? subtotal * (vatRate / 100) : 0;
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

export function QuoteForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const { user, isOnline } = useApp();
  const { saveDraft, saveQuote, quotes } = useQuotes(user?.id);
  const { getPreviewQuoteNumber } = useQuoteNumber();

  const DRAFT_KEY = user?.id ? `${DRAFT_KEY_PREFIX}${user.id}` : null;

  const [customer, setCustomer] = useState<Customer>({ name: '', phone: '', email: '', address: '' });
  const [details, setDetails] = useState<QuoteDetails>({
    validUntil: new Date(),
    currency: 'USD',
    vatEnabled: false,
    vatRate: 15,
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()]);
  const [notes, setNotes] = useState('');
  const [selectedTemplate] = useState(user?.preferences?.defaultTemplate || 'template1');
  const [isSaving, setIsSaving] = useState(false);
  const [nextQuoteNumber, setNextQuoteNumber] = useState<string>('Loading...');
  const [existingQuote, setExistingQuote] = useState<Quote | DraftQuote | null>(null);

  // Restore unsaved draft from localStorage on mount (new quotes only)
  useEffect(() => {
    if (editId || !DRAFT_KEY) return;
    const saved = loadDraftFromStorage<{
      customer: Customer;
      details: { validUntil: string; currency: 'USD' | 'ZWG'; vatEnabled: boolean; vatRate: number };
      lineItems: LineItem[];
      notes: string;
    }>(DRAFT_KEY);
    if (!saved) return;
    if (saved.customer) setCustomer(saved.customer);
    if (saved.details) setDetails({ ...saved.details, validUntil: new Date(saved.details.validUntil) });
    if (saved.lineItems?.length) setLineItems(saved.lineItems);
    if (saved.notes !== undefined) setNotes(saved.notes);
    showNotification('Draft restored from your last session', 'info');
  }, []);

  // Load next quote number
  useEffect(() => {
    if (editId || !user?.id) return;
    (async () => {
      try {
        const n = await getPreviewQuoteNumber();
        setNextQuoteNumber(n.toString());
      } catch {
        setNextQuoteNumber('—');
      }
    })();
  }, [editId, user?.id, getPreviewQuoteNumber]);

  const buildDraft = useCallback(
    (id: string | undefined): DraftQuote => {
      const { subtotal, tax, total } = calcTotals(lineItems, details.vatEnabled, details.vatRate);
      return {
        id,
        // Preserve the quote number if editing an existing draft — a new
        // draft will have its number assigned by saveDraft on first save.
        quoteNumber: existingQuote?.quoteNumber ?? undefined,
        customer,
        details,
        lineItems,
        notes,
        templateId: selectedTemplate,
        status: 'draft',
        createdAt: existingQuote?.createdAt ?? new Date(),
        updatedAt: new Date(),
        total,
        subtotal,
        tax,
        currency: details.currency,
        isOffline: !isOnline,
        companyLogo: user?.companyLogo ?? null,
      };
    },
    [customer, details, lineItems, notes, selectedTemplate, existingQuote, isOnline, user]
  );

  const onAutoSave = useCallback(
    async (id: string | undefined) => {
      const draft = buildDraft(id);
      return saveDraft(draft);
    },
    [buildDraft, saveDraft]
  );

  const { status: autoSaveStatus, savedAt: autoSavedAt, autoSaveId } = useAutoSave(
    { customer, details, lineItems, notes, selectedTemplate },
    {
      userId: user?.id,
      existingId: existingQuote?.id,
      localStorageKey: DRAFT_KEY,
      onSave: onAutoSave,
    }
  );

  // Line item helpers
  const addLine = () => setLineItems(p => [...p, newLineItem()]);
  const removeLine = (id: string) => {
    if (lineItems.length > 1) setLineItems(p => p.filter(l => l.id !== id));
  };
  const updateLine = (id: string, field: keyof LineItem, val: any) => {
    setLineItems(p => p.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: val };
      if (field === 'quantity' || field === 'price') updated.total = calculateLineTotal(updated.quantity, updated.price);
      return updated;
    }));
  };

  const { subtotal, tax, total } = calcTotals(lineItems, details.vatEnabled, details.vatRate);
  const cur = details.currency === 'ZWG' ? 'ZWG ' : '$';

  const handleSaveDraft = async () => {
    if (isSaving) return;
    const hasValid = lineItems.some(i => i.description.trim() && i.quantity > 0 && i.price > 0);
    if (!hasValid) {
      showNotification('Add at least one line item with a name, quantity, and price to save as draft', 'warning');
      return;
    }
    setIsSaving(true);
    try {
      const resolvedId = existingQuote?.id ?? autoSaveId ?? undefined;
      const draft = buildDraft(resolvedId);
      const draftId = await saveDraft(draft);
      if (draftId && !draft.id) draft.id = draftId;
      if (DRAFT_KEY) clearDraftFromStorage(DRAFT_KEY);
      showNotification('Draft saved.', 'success');
      navigate('/quotations');
    } catch {
      showNotification('Failed to save draft. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFinal = async () => {
    if (isSaving) return;
    if (!customer.name.trim()) {
      showNotification('Customer name is required', 'warning');
      return;
    }
    if (lineItems.every(i => !i.description.trim())) {
      showNotification('Add at least one line item with a description', 'warning');
      return;
    }
    if (!user?.id) {
      showNotification('Please login to save quotes', 'error');
      return;
    }
    if (isOnline && user?.tier === 'free' && quotes.length >= 50 && !user?.licenseKey) {
      showNotification('Free tier is limited to 50 final quotations. Upgrade to continue.', 'error');
      return;
    }
    setIsSaving(true);
    try {
      // Use the draft's existing number if available, otherwise fall back
      // to the preview number. saveQuote will mint a fresh number if both are absent.
      const resolvedQuoteNumber = existingQuote?.quoteNumber || nextQuoteNumber;

      // Both online and offline paths write through saveQuote → localDb so the
      // sync manager can push status:'final' to Supabase once connectivity returns.
      const finalQuote: Quote = {
        id: '',
        quoteNumber: resolvedQuoteNumber,
        customer, details, lineItems, notes,
        templateId: selectedTemplate,
        status: 'final',
        createdAt: existingQuote?.createdAt || new Date(),
        updatedAt: new Date(),
        total, subtotal, tax,
        currency: details.currency,
        companyLogo: user?.companyLogo ?? null,
      };
      const originalDraftId = existingQuote?.id ?? autoSaveId ?? undefined;
      await saveQuote(finalQuote, originalDraftId);
      if (DRAFT_KEY) clearDraftFromStorage(DRAFT_KEY);
      if (!isOnline) {
        showNotification(`Quote ${resolvedQuoteNumber} saved — will sync to final when back online.`, 'info');
      } else {
        showNotification(`Quote ${resolvedQuoteNumber} generated successfully!`, 'success');
      }
      navigate('/quotations');
    } catch {
      showNotification('Failed to generate quote. Please try again.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const validUntilStr = details.validUntil instanceof Date
    ? details.validUntil.toISOString().split('T')[0]
    : new Date(details.validUntil).toISOString().split('T')[0];

  return (
    <div className="inv-form" onKeyDown={handleFormEnterKey}>
      {/* Top bar */}
      <div className="inv-form__topbar">
        <button className="inv-form__back" onClick={() => navigate('/quotations')}>
          <i className="fas fa-arrow-left" /> Back
        </button>
        <h2 className="inv-form__title">
          {editId ? 'Edit Quotation' : 'New Quotation'}
        </h2>
        <AutoSaveIndicator status={autoSaveStatus} savedAt={autoSavedAt} />
      </div>

      {/* Quote To */}
      <section className="inv-form__section">
        <h3 className="inv-form__section-title">
          <i className="fas fa-user" /> Quote To
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

      {/* Quote Details */}
      <section className="inv-form__section">
        <h3 className="inv-form__section-title">
          <i className="fas fa-file-alt" /> Quote Details
        </h3>
        <div className="inv-form__grid inv-form__grid--3">
          <div className="inv-form__field">
            <label>Quote #</label>
            <input
              type="text"
              value={existingQuote?.quoteNumber || nextQuoteNumber}
              disabled
            />
          </div>
          <div className="inv-form__field">
            <label>Date</label>
            <input
              type="text"
              value={new Date().toLocaleDateString()}
              disabled
            />
          </div>
          <div className="inv-form__field">
            <label>Valid Until</label>
            <input
              type="date"
              value={validUntilStr}
              onChange={e => setDetails(p => ({ ...p, validUntil: new Date(e.target.value) }))}
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

        <div className="inv-form__lines-header qf-lines-header--with-vat">
          <span>Description</span>
          <span>Qty</span>
          <span>Unit Price</span>
          <span>VAT</span>
          <span>Total</span>
          <span />
        </div>

        {lineItems.map((item, idx) => (
          <div key={item.id} className="inv-form__line qf-line--with-vat">
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
            <div className="qf-vat-check">
              <input
                type="checkbox"
                checked={item.vatEnabled || false}
                onChange={e => updateLine(item.id, 'vatEnabled', e.target.checked)}
                title="Apply VAT to this item"
              />
            </div>
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
          placeholder="Optional notes or terms for the client…"
          value={notes}
          rows={3}
          onChange={e => setNotes(e.target.value)}
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
          onClick={handleSaveFinal}
          disabled={isSaving}
        >
          <i className="fas fa-paper-plane" /> Save & Generate
        </button>
      </div>
    </div>
  );
}
