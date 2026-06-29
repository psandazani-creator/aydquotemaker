import React, { useRef } from 'react';
import { jsPDF } from 'jspdf';
import { Invoice, DraftInvoice } from '../../types/invoice';
import { useApp } from '../../context/AppContext';
import './InvoicePreview.css';

interface Props {
  invoice: Invoice | DraftInvoice;
  onClose: () => void;
}

function fmt(n: number, cur: string) {
  const prefix = cur === 'ZWG' ? 'ZWG ' : '$';
  return `${prefix}${Number(n).toFixed(2)}`;
}

function fmtDate(d: Date | string | undefined) {
  if (!d) return '—';
  const date = d instanceof Date ? d : new Date(d);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#9ca3af',
  sent: '#60a5fa',
  paid: '#22c55e',
  overdue: '#ef4444',
};

export function InvoicePreview({ invoice, onClose }: Props) {
  const { user } = useApp();
  const printRef = useRef<HTMLDivElement>(null);

  const customer = invoice.customer as any ?? {};
  const details = invoice.details as any ?? {};
  const lineItems = invoice.lineItems ?? [];
  const currency = details.currency ?? invoice.currency ?? 'USD';
  const cur = currency === 'ZWG' ? 'ZWG ' : '$';

  const subtotal = invoice.subtotal ?? 0;
  const tax = invoice.tax ?? 0;
  const total = invoice.total ?? 0;

  const companyName = user?.companyName ?? 'Your Company';
  const companyPhone = user?.companyPhone ?? '';
  const companyAddress = user?.companyAddress ?? '';

  const handleDownloadPDF = () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 18;
    const colRight = pageW - margin;
    let y = 20;

    // Gold header bar
    doc.setFillColor(212, 175, 55);
    doc.rect(0, 0, pageW, 12, 'F');

    // Company name
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    y = 24;
    doc.text(companyName, margin, y);

    // INVOICE label (right)
    doc.setFontSize(26);
    doc.setTextColor(212, 175, 55);
    doc.text('INVOICE', colRight, y, { align: 'right' });

    y += 7;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    if (companyPhone) doc.text(companyPhone, margin, y);
    if (companyAddress) doc.text(companyAddress, margin, y + 5);

    // Invoice details (right side)
    const invNum = invoice.invoiceNumber ?? 'DRAFT';
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.setFontSize(10);
    doc.text(`Invoice #: ${invNum}`, colRight, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Issued: ${fmtDate(details.issuedDate)}`, colRight, y + 5, { align: 'right' });
    if (details.dueDate) doc.text(`Due: ${fmtDate(details.dueDate)}`, colRight, y + 10, { align: 'right' });
    if (details.reference) doc.text(`Ref: ${details.reference}`, colRight, y + 15, { align: 'right' });

    y += 32;

    // Divider
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.5);
    doc.line(margin, y, colRight, y);
    y += 8;

    // Bill To
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text('BILL TO', margin, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20, 20, 20);
    doc.text(customer.name ?? 'Customer', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    if (customer.email) { doc.text(customer.email, margin, y); y += 5; }
    if (customer.phone) { doc.text(customer.phone, margin, y); y += 5; }
    if (customer.address) { doc.text(customer.address, margin, y); y += 5; }

    // Payment terms
    if (details.paymentTerms) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      const ptX = colRight - 50;
      doc.text('PAYMENT TERMS', ptX, y - (customer.email ? 20 : 10));
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(20, 20, 20);
      doc.text(details.paymentTerms, ptX, y - (customer.email ? 14 : 4));
    }

    y += 10;

    // Line items table header
    doc.setFillColor(30, 30, 30);
    doc.rect(margin, y, colRight - margin, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(212, 175, 55);
    const col = {
      desc: margin + 2,
      qty: margin + 100,
      price: margin + 120,
      total: colRight - 2,
    };
    doc.text('DESCRIPTION', col.desc, y + 5.5);
    doc.text('QTY', col.qty, y + 5.5);
    doc.text('PRICE', col.price, y + 5.5);
    doc.text('TOTAL', col.total, y + 5.5, { align: 'right' });
    y += 12;

    // Line item rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    lineItems.forEach((item: any, i: number) => {
      if (i % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(margin, y - 4, colRight - margin, 9, 'F');
      }
      doc.setTextColor(20, 20, 20);
      doc.text(item.description || '—', col.desc, y + 1);
      doc.text(String(item.quantity), col.qty, y + 1);
      doc.text(`${cur}${Number(item.price).toFixed(2)}`, col.price, y + 1);
      doc.text(`${cur}${(item.quantity * item.price).toFixed(2)}`, col.total, y + 1, { align: 'right' });
      y += 10;
    });

    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, colRight, y);
    y += 8;

    // Totals block
    const totW = 80;
    const totX = colRight - totW;

    const addTotal = (label: string, val: string, bold = false) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(bold ? 12 : 10);
      doc.setTextColor(bold ? 20 : 80, bold ? 20 : 80, bold ? 20 : 80);
      doc.text(label, totX, y);
      doc.text(val, colRight, y, { align: 'right' });
      y += bold ? 8 : 6;
    };

    addTotal('Subtotal', `${cur}${subtotal.toFixed(2)}`);
    if (tax > 0) addTotal(`VAT (${details.vatRate ?? 15}%)`, `${cur}${tax.toFixed(2)}`);
    doc.setDrawColor(212, 175, 55);
    doc.setLineWidth(0.5);
    doc.line(totX, y, colRight, y);
    y += 6;
    addTotal('TOTAL', `${cur}${total.toFixed(2)}`, true);

    // Paid watermark
    if (invoice.status === 'paid') {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(60);
      doc.setTextColor(34, 197, 94);
      doc.setGState({ opacity: 0.15 } as any);
      doc.text('PAID', pageW / 2, 180, { align: 'center', angle: 30 });
      doc.setGState({ opacity: 1 } as any);
    }

    // Notes
    if (invoice.notes) {
      y += 12;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text('NOTES', margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      const noteLines = doc.splitTextToSize(invoice.notes, colRight - margin);
      doc.text(noteLines, margin, y);
      y += noteLines.length * 5 + 6;
    }

    // Bank / payment details
    if (details.bankDetails) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(150, 150, 150);
      doc.text('PAYMENT INSTRUCTIONS', margin, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      const bankLines = doc.splitTextToSize(details.bankDetails, colRight - margin);
      doc.text(bankLines, margin, y);
    }

    // Footer bar
    doc.setFillColor(30, 30, 30);
    doc.rect(0, 285, pageW, 12, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text('Generated by AydQuoteMaker', pageW / 2, 292, { align: 'center' });

    const filename = `${invNum}_${customer.name ?? 'invoice'}.pdf`.replace(/\s+/g, '_');
    doc.save(filename);
  };

  const handleShare = async () => {
    const text = [
      `INVOICE ${invoice.invoiceNumber ?? '(Draft)'}`,
      `From: ${companyName}`,
      `To: ${customer.name ?? ''}`,
      `Amount: ${fmt(total, currency)}`,
      details.dueDate ? `Due: ${fmtDate(details.dueDate)}` : '',
      invoice.notes ? `\nNotes: ${invoice.notes}` : '',
    ].filter(Boolean).join('\n');

    if (navigator.share) {
      await navigator.share({ title: `Invoice ${invoice.invoiceNumber}`, text });
    } else {
      await navigator.clipboard.writeText(text);
      alert('Invoice details copied to clipboard!');
    }
  };

  return (
    <div className="inv-preview__overlay" onClick={onClose}>
      <div className="inv-preview__modal" onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="inv-preview__modal-header">
          <h3>Invoice Preview</h3>
          <div className="inv-preview__modal-actions">
            <button className="inv-preview__action-btn" onClick={handleShare}>
              <i className="fas fa-share-alt" /> Share
            </button>
            <button className="inv-preview__action-btn inv-preview__action-btn--pdf" onClick={handleDownloadPDF}>
              <i className="fas fa-download" /> Download PDF
            </button>
            <button className="inv-preview__close" onClick={onClose}>
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {/* Invoice paper */}
        <div className="inv-preview__scroll">
          <div className="inv-preview__paper" ref={printRef}>
            {/* Gold top stripe */}
            <div className="inv-preview__stripe" />

            {/* Header */}
            <div className="inv-preview__header">
              <div className="inv-preview__company">
                {user?.companyLogo && (
                  <img src={user.companyLogo} alt={companyName} className="inv-preview__logo" />
                )}
                <div>
                  <div className="inv-preview__company-name">{companyName}</div>
                  {companyPhone && <div className="inv-preview__company-meta">{companyPhone}</div>}
                  {companyAddress && <div className="inv-preview__company-meta">{companyAddress}</div>}
                </div>
              </div>
              <div className="inv-preview__header-right">
                <div className="inv-preview__label">INVOICE</div>
                <div className="inv-preview__number">
                  {invoice.invoiceNumber ?? <span className="inv-preview__draft-tag">DRAFT</span>}
                </div>
                <div
                  className="inv-preview__status-pill"
                  style={{ background: STATUS_COLORS[invoice.status] + '22', color: STATUS_COLORS[invoice.status] }}
                >
                  {invoice.status.toUpperCase()}
                </div>
              </div>
            </div>

            {/* Meta row */}
            <div className="inv-preview__meta-row">
              <div className="inv-preview__meta-item">
                <span className="inv-preview__meta-label">Issued</span>
                <span className="inv-preview__meta-value">{fmtDate(details.issuedDate)}</span>
              </div>
              {details.dueDate && (
                <div className="inv-preview__meta-item">
                  <span className="inv-preview__meta-label">Due</span>
                  <span className="inv-preview__meta-value">{fmtDate(details.dueDate)}</span>
                </div>
              )}
              {details.paymentTerms && (
                <div className="inv-preview__meta-item">
                  <span className="inv-preview__meta-label">Terms</span>
                  <span className="inv-preview__meta-value">{details.paymentTerms}</span>
                </div>
              )}
              {details.reference && (
                <div className="inv-preview__meta-item">
                  <span className="inv-preview__meta-label">Reference</span>
                  <span className="inv-preview__meta-value">{details.reference}</span>
                </div>
              )}
            </div>

            {/* Bill To */}
            <div className="inv-preview__bill-section">
              <div className="inv-preview__bill-label">BILL TO</div>
              <div className="inv-preview__bill-name">{customer.name || 'Customer'}</div>
              {customer.email && <div className="inv-preview__bill-meta">{customer.email}</div>}
              {customer.phone && <div className="inv-preview__bill-meta">{customer.phone}</div>}
              {customer.address && <div className="inv-preview__bill-meta">{customer.address}</div>}
            </div>

            {/* Line items table */}
            <table className="inv-preview__table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="inv-preview__th-num">Qty</th>
                  <th className="inv-preview__th-num">Unit Price</th>
                  <th className="inv-preview__th-num">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item: any, i: number) => (
                  <tr key={item.id ?? i}>
                    <td>{item.description || '—'}</td>
                    <td className="inv-preview__td-num">{item.quantity}</td>
                    <td className="inv-preview__td-num">{fmt(item.price, currency)}</td>
                    <td className="inv-preview__td-num">{fmt(item.quantity * item.price, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="inv-preview__totals">
              <div className="inv-preview__total-row">
                <span>Subtotal</span><span>{fmt(subtotal, currency)}</span>
              </div>
              {tax > 0 && (
                <div className="inv-preview__total-row">
                  <span>VAT ({details.vatRate}%)</span><span>{fmt(tax, currency)}</span>
                </div>
              )}
              <div className="inv-preview__total-row inv-preview__total-row--grand">
                <span>Total</span><span>{fmt(total, currency)}</span>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="inv-preview__notes-block">
                <div className="inv-preview__notes-label">Notes</div>
                <p className="inv-preview__notes-text">{invoice.notes}</p>
              </div>
            )}

            {/* Bank / payment instructions */}
            {details.bankDetails && (
              <div className="inv-preview__notes-block">
                <div className="inv-preview__notes-label">Payment Instructions</div>
                <p className="inv-preview__notes-text">{details.bankDetails}</p>
              </div>
            )}

            {/* PAID watermark */}
            {invoice.status === 'paid' && (
              <div className="inv-preview__watermark">PAID</div>
            )}

            {/* Footer */}
            <div className="inv-preview__footer">
              Generated by AydQuoteMaker
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
