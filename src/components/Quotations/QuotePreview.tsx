// src/components/Quotations/QuotePreview.tsx
import React, { useState } from 'react';
import { DraftQuote } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { generatePDF } from '../../utils/pdfGenerator';
import { getTemplateById, getAvailableTemplates } from '../../utils/templates';
import { useApp } from '../../context/AppContext';
import { TemplateSelector } from '../Templates/TemplateSelector';
import { showNotification } from '../Notification/Notification';
import './QuotePreview.css';

interface QuotePreviewProps {
  quote: DraftQuote;
  onClose: () => void;
  isFinal?: boolean;
}

export function QuotePreview({ quote, onClose, isFinal = false }: QuotePreviewProps) {
  const { user } = useApp();
  const [selectedTemplate, setSelectedTemplate] = useState(quote.templateId || 'template1');
  const template = getTemplateById(selectedTemplate) || getTemplateById('template1')!;
  const createdDate = quote.createdAt ? new Date(quote.createdAt) : new Date();
  const availableTemplates = getAvailableTemplates(user?.tier || 'free');

  const handleTemplateChange = (templateId: string) => {
    const tpl = getTemplateById(templateId);
    if (tpl?.tier === 'pro' && user?.tier === 'free') {
      showNotification('Upgrade to Pro to use this premium template!\n\nFeatures:\n• Navy, Green & Crimson colour schemes\n• Professional branded layouts\n• No watermark\n• Enhanced customer details', 'info');
      return;
    }
    setSelectedTemplate(templateId);
  };

  const handleShare = async (q: DraftQuote) => {
    try {
      const shareText = `Quotation ${q.quoteNumber || 'QT-XXXX'}
Customer: ${q.customer.name}
Date: ${formatDate(createdDate)}
Total: ${formatCurrency(q.total, q.currency)}

Items:
${q.lineItems.map(item => `${item.description} - ${item.quantity} x ${formatCurrency(item.price, q.currency)} = ${formatCurrency(item.total, q.currency)}`).join('\n')}

Generated with AydQuoteMaker`;

      if (navigator.share) {
        await navigator.share({ title: `Quotation ${q.quoteNumber || 'QT-XXXX'}`, text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
        showNotification('Quotation details copied to clipboard!', 'success');
      }
    } catch {
      showNotification('Failed to share quotation. Please try again.', 'error');
    }
  };

  const hs = template.styles.headerStyle;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal quote-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Quote Preview</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="qp-body-row">
          <aside className="qp-sidebar">
            <p className="qp-sidebar-label">Template</p>
            <TemplateSelector
              templates={availableTemplates}
              selectedTemplate={selectedTemplate}
              onSelect={handleTemplateChange}
              userTier={user?.tier || 'free'}
            />
          </aside>

          <div className="quote-preview-body">

          {/* ───────────────────────────────────────────────────────────────────
              TEMPLATE 1 — CLASSIC WHITE (free)
          ─────────────────────────────────────────────────────────────────── */}
          {hs === 'classic-white' && (
            <div className="tpl tpl-classic-white">
              <div className="cw-header">
                <div className="cw-company">
                  {quote.companyLogo && <img src={quote.companyLogo} alt="Logo" className="cw-logo" />}
                  <div>
                    <p className="cw-company-name">{user?.companyName || 'Your Company Name'}</p>
                    {user?.companyAddress && <p className="cw-company-sub">{user.companyAddress}</p>}
                    {user?.companyPhone && <p className="cw-company-sub">Tel: {user.companyPhone}</p>}
                    {user?.email && <p className="cw-company-sub">{user.email}</p>}
                  </div>
                </div>
                <div className="cw-title-block">
                  <h1 className="cw-title">QUOTATION</h1>
                  <div className="cw-meta-row"><span>Quote #</span><span>{quote.quoteNumber || 'QT-XXXX'}</span></div>
                  <div className="cw-meta-row"><span>Date</span><span>{formatDate(createdDate)}</span></div>
                  <div className="cw-meta-row"><span>Valid Until</span><span>{formatDate(quote.details.validUntil)}</span></div>
                </div>
              </div>

              <div className="cw-divider" />

              <div className="cw-bill-to">
                <p className="cw-section-label">BILL TO</p>
                <p className="cw-customer-name">{quote.customer.name}</p>
                {quote.customer.address && <p className="cw-customer-sub">{quote.customer.address}</p>}
                {quote.customer.phone && <p className="cw-customer-sub">Tel: {quote.customer.phone}</p>}
                {quote.customer.email && <p className="cw-customer-sub">{quote.customer.email}</p>}
              </div>

              <table className="cw-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="ta-center">Qty</th>
                    <th className="ta-right">Unit Price</th>
                    <th className="ta-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lineItems.map((item, i) => (
                    <tr key={i}>
                      <td>{item.description}</td>
                      <td className="ta-center">{item.quantity}</td>
                      <td className="ta-right">{formatCurrency(item.price, quote.currency)}</td>
                      <td className="ta-right">{formatCurrency(item.total, quote.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="cw-totals">
                <div className="cw-total-row"><span>Subtotal</span><span>{formatCurrency(quote.subtotal, quote.currency)}</span></div>
                {quote.details.vatEnabled && (
                  <div className="cw-total-row"><span>Tax ({quote.details.vatRate}%)</span><span>{formatCurrency(quote.tax, quote.currency)}</span></div>
                )}
                <div className="cw-total-row cw-grand-total"><span>TOTAL</span><span>{formatCurrency(quote.total, quote.currency)}</span></div>
              </div>

              {quote.notes && (
                <div className="cw-notes"><p className="cw-section-label">NOTES</p><p>{quote.notes}</p></div>
              )}

              <div className="cw-footer">
                <p>Thank you for your business.</p>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────────
              TEMPLATE 2 — MONOCHROME ELITE (free)
          ─────────────────────────────────────────────────────────────────── */}
          {hs === 'monochrome-elite' && (
            <div className="tpl tpl-mono">
              <div className="mono-header">
                <div className="mono-header-left">
                  {quote.companyLogo && <img src={quote.companyLogo} alt="Logo" className="mono-logo" />}
                  <div>
                    <p className="mono-company-name">{user?.companyName || 'Your Company Name'}</p>
                    {user?.companyAddress && <p className="mono-company-sub">{user.companyAddress}</p>}
                    {user?.companyPhone && <p className="mono-company-sub">Tel: {user.companyPhone}</p>}
                    {user?.email && <p className="mono-company-sub">{user.email}</p>}
                  </div>
                </div>
                <div className="mono-header-right">
                  <h1 className="mono-title">QUOTATION</h1>
                  <div className="mono-ref-box">
                    <div className="mono-ref-row"><span>Ref</span><span>{quote.quoteNumber || 'QT-XXXX'}</span></div>
                    <div className="mono-ref-row"><span>Date</span><span>{formatDate(createdDate)}</span></div>
                    <div className="mono-ref-row"><span>Valid</span><span>{formatDate(quote.details.validUntil)}</span></div>
                  </div>
                </div>
              </div>

              <div className="mono-bill-section">
                <p className="mono-label">BILL TO:</p>
                <p className="mono-customer-name">{quote.customer.name}</p>
                {quote.customer.address && <p className="mono-customer-sub">{quote.customer.address}</p>}
                {quote.customer.phone && <p className="mono-customer-sub">Tel: {quote.customer.phone}</p>}
                {quote.customer.email && <p className="mono-customer-sub">{quote.customer.email}</p>}
              </div>

              <table className="mono-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="ta-center">Qty</th>
                    <th className="ta-right">Unit Price</th>
                    <th className="ta-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lineItems.map((item, i) => (
                    <tr key={i}>
                      <td>{item.description}</td>
                      <td className="ta-center">{item.quantity}</td>
                      <td className="ta-right">{formatCurrency(item.price, quote.currency)}</td>
                      <td className="ta-right">{formatCurrency(item.total, quote.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mono-totals">
                <div className="mono-total-row"><span>Subtotal</span><span>{formatCurrency(quote.subtotal, quote.currency)}</span></div>
                {quote.details.vatEnabled && (
                  <div className="mono-total-row"><span>Tax ({quote.details.vatRate}%)</span><span>{formatCurrency(quote.tax, quote.currency)}</span></div>
                )}
                <div className="mono-total-row mono-grand"><span>TOTAL DUE</span><span>{formatCurrency(quote.total, quote.currency)}</span></div>
              </div>

              {quote.notes && (
                <div className="mono-notes"><p className="mono-label">NOTES</p><p>{quote.notes}</p></div>
              )}

              <div className="mono-footer">THANK YOU FOR YOUR BUSINESS</div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────────
              TEMPLATE 3 — NAVY EXECUTIVE (pro)
          ─────────────────────────────────────────────────────────────────── */}
          {hs === 'navy-executive' && (
            <div className="tpl tpl-navy">
              <div className="navy-header">
                <div className="navy-header-left">
                  {quote.companyLogo && <img src={quote.companyLogo} alt="Logo" className="navy-logo" />}
                  <p className="navy-company-name">{user?.companyName || 'Your Company Name'}</p>
                  {user?.companyAddress && <p className="navy-company-sub">{user.companyAddress}</p>}
                  {user?.companyPhone && <p className="navy-company-sub">Tel: {user.companyPhone}</p>}
                  {user?.email && <p className="navy-company-sub">{user.email}</p>}
                </div>
                <div className="navy-header-right">
                  <h1 className="navy-quote-title">QUOTATION</h1>
                  <div className="navy-meta">
                    <div className="navy-meta-item">
                      <span className="navy-meta-label">QUOTE NO.</span>
                      <span className="navy-meta-value">{quote.quoteNumber || 'QT-XXXX'}</span>
                    </div>
                    <div className="navy-meta-item">
                      <span className="navy-meta-label">DATE</span>
                      <span className="navy-meta-value">{formatDate(createdDate)}</span>
                    </div>
                    <div className="navy-meta-item">
                      <span className="navy-meta-label">VALID UNTIL</span>
                      <span className="navy-meta-value">{formatDate(quote.details.validUntil)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="navy-accent-bar" />

              <div className="navy-parties">
                <div className="navy-bill-to">
                  <p className="navy-section-label">BILL TO</p>
                  <p className="navy-customer-name">{quote.customer.name}</p>
                  {quote.customer.address && <p className="navy-customer-sub">{quote.customer.address}</p>}
                  {quote.customer.phone && <p className="navy-customer-sub">Tel: {quote.customer.phone}</p>}
                  {quote.customer.email && <p className="navy-customer-sub">{quote.customer.email}</p>}
                </div>
              </div>

              <table className="navy-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th className="ta-center">Qty</th>
                    <th className="ta-right">Unit Price</th>
                    <th className="ta-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lineItems.map((item, i) => (
                    <tr key={i}>
                      <td>{item.description}</td>
                      <td className="ta-center">{item.quantity}</td>
                      <td className="ta-right">{formatCurrency(item.price, quote.currency)}</td>
                      <td className="ta-right">{formatCurrency(item.total, quote.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="navy-totals-wrap">
                <div className="navy-totals">
                  <div className="navy-total-row"><span>Subtotal</span><span>{formatCurrency(quote.subtotal, quote.currency)}</span></div>
                  {quote.details.vatEnabled && (
                    <div className="navy-total-row"><span>Tax ({quote.details.vatRate}%)</span><span>{formatCurrency(quote.tax, quote.currency)}</span></div>
                  )}
                  <div className="navy-total-row navy-grand"><span>TOTAL</span><span>{formatCurrency(quote.total, quote.currency)}</span></div>
                </div>
              </div>

              {quote.notes && (
                <div className="navy-notes"><p className="navy-section-label">NOTES</p><p>{quote.notes}</p></div>
              )}

              <div className="navy-footer">
                <span>Thank you for choosing {user?.companyName || 'us'}.</span>
                <span className="navy-footer-tag">PROFESSIONAL QUOTE</span>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────────
              TEMPLATE 4 — FOREST PREMIUM (pro)
          ─────────────────────────────────────────────────────────────────── */}
          {hs === 'forest-premium' && (
            <div className="tpl tpl-forest">
              <div className="forest-header">
                <div className="forest-header-inner">
                  <div className="forest-header-left">
                    {quote.companyLogo && <img src={quote.companyLogo} alt="Logo" className="forest-logo" />}
                    <div>
                      <p className="forest-company-name">{user?.companyName || 'Your Company Name'}</p>
                      {user?.companyAddress && <p className="forest-company-sub">{user.companyAddress}</p>}
                      {user?.companyPhone && <p className="forest-company-sub">Tel: {user.companyPhone}</p>}
                      {user?.email && <p className="forest-company-sub">{user.email}</p>}
                    </div>
                  </div>
                  <div className="forest-header-right">
                    <h1 className="forest-title">QUOTATION</h1>
                    <div className="forest-ref">#{quote.quoteNumber || 'QT-XXXX'}</div>
                  </div>
                </div>
              </div>

              <div className="forest-body">
                <div className="forest-info-row">
                  <div className="forest-bill-to">
                    <p className="forest-label">PREPARED FOR</p>
                    <p className="forest-customer-name">{quote.customer.name}</p>
                    {quote.customer.address && <p className="forest-customer-sub">{quote.customer.address}</p>}
                    {quote.customer.phone && <p className="forest-customer-sub">Tel: {quote.customer.phone}</p>}
                    {quote.customer.email && <p className="forest-customer-sub">{quote.customer.email}</p>}
                  </div>
                  <div className="forest-date-box">
                    <div className="forest-date-item"><span>Date Issued</span><strong>{formatDate(createdDate)}</strong></div>
                    <div className="forest-date-item"><span>Valid Until</span><strong>{formatDate(quote.details.validUntil)}</strong></div>
                  </div>
                </div>

                <table className="forest-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="ta-center">Qty</th>
                      <th className="ta-right">Unit Price</th>
                      <th className="ta-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lineItems.map((item, i) => (
                      <tr key={i}>
                        <td>{item.description}</td>
                        <td className="ta-center">{item.quantity}</td>
                        <td className="ta-right">{formatCurrency(item.price, quote.currency)}</td>
                        <td className="ta-right">{formatCurrency(item.total, quote.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="forest-totals-wrap">
                  <div className="forest-totals">
                    <div className="forest-total-row"><span>Subtotal</span><span>{formatCurrency(quote.subtotal, quote.currency)}</span></div>
                    {quote.details.vatEnabled && (
                      <div className="forest-total-row"><span>Tax ({quote.details.vatRate}%)</span><span>{formatCurrency(quote.tax, quote.currency)}</span></div>
                    )}
                    <div className="forest-total-row forest-grand"><span>TOTAL</span><span>{formatCurrency(quote.total, quote.currency)}</span></div>
                  </div>
                </div>

                {quote.notes && (
                  <div className="forest-notes"><p className="forest-label">NOTES</p><p>{quote.notes}</p></div>
                )}
              </div>

              <div className="forest-footer">
                <span>{user?.companyName || 'Your Company'}</span>
                <span>We appreciate your business</span>
              </div>
            </div>
          )}

          {/* ───────────────────────────────────────────────────────────────────
              TEMPLATE 5 — CRIMSON PRESTIGE (pro)
          ─────────────────────────────────────────────────────────────────── */}
          {hs === 'crimson-prestige' && (
            <div className="tpl tpl-crimson">
              <div className="cr-header">
                <div className="cr-header-top">
                  <div className="cr-company-block">
                    {quote.companyLogo && <img src={quote.companyLogo} alt="Logo" className="cr-logo" />}
                    <div>
                      <p className="cr-company-name">{user?.companyName || 'Your Company Name'}</p>
                      {user?.companyAddress && <p className="cr-company-sub">{user.companyAddress}</p>}
                      {user?.companyPhone && <p className="cr-company-sub">Tel: {user.companyPhone}</p>}
                      {user?.email && <p className="cr-company-sub">{user.email}</p>}
                    </div>
                  </div>
                  <div className="cr-title-block">
                    <h1 className="cr-title">QUOTATION</h1>
                    <div className="cr-ornament">◆</div>
                  </div>
                </div>
                <div className="cr-header-meta">
                  <div className="cr-meta-item"><span>Quote No.</span><strong>{quote.quoteNumber || 'QT-XXXX'}</strong></div>
                  <div className="cr-meta-item"><span>Date</span><strong>{formatDate(createdDate)}</strong></div>
                  <div className="cr-meta-item"><span>Valid Until</span><strong>{formatDate(quote.details.validUntil)}</strong></div>
                </div>
              </div>

              <div className="cr-body">
                <div className="cr-bill-to">
                  <p className="cr-section-label">PREPARED FOR</p>
                  <p className="cr-customer-name">{quote.customer.name}</p>
                  {quote.customer.address && <p className="cr-customer-sub">{quote.customer.address}</p>}
                  {quote.customer.phone && <p className="cr-customer-sub">Tel: {quote.customer.phone}</p>}
                  {quote.customer.email && <p className="cr-customer-sub">{quote.customer.email}</p>}
                </div>

                <table className="cr-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="ta-center">Qty</th>
                      <th className="ta-right">Unit Price</th>
                      <th className="ta-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quote.lineItems.map((item, i) => (
                      <tr key={i}>
                        <td>{item.description}</td>
                        <td className="ta-center">{item.quantity}</td>
                        <td className="ta-right">{formatCurrency(item.price, quote.currency)}</td>
                        <td className="ta-right">{formatCurrency(item.total, quote.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="cr-totals-wrap">
                  <div className="cr-totals">
                    <div className="cr-total-row"><span>Subtotal</span><span>{formatCurrency(quote.subtotal, quote.currency)}</span></div>
                    {quote.details.vatEnabled && (
                      <div className="cr-total-row"><span>Tax ({quote.details.vatRate}%)</span><span>{formatCurrency(quote.tax, quote.currency)}</span></div>
                    )}
                    <div className="cr-total-row cr-grand"><span>TOTAL DUE</span><span>{formatCurrency(quote.total, quote.currency)}</span></div>
                  </div>
                </div>

                {quote.notes && (
                  <div className="cr-notes"><p className="cr-section-label">NOTES</p><p>{quote.notes}</p></div>
                )}
              </div>

              <div className="cr-footer">
                <div className="cr-footer-ornament">◆ ◆ ◆</div>
                <p>Thank you for your esteemed business.</p>
              </div>
            </div>
          )}

          {/* Fallback for any unrecognised template */}
          {!['classic-white','monochrome-elite','navy-executive','forest-premium','crimson-prestige'].includes(hs) && (
            <div className="tpl tpl-classic-white">
              <p style={{ padding: 24, color: '#666' }}>Preview not available for this template.</p>
            </div>
          )}
        </div>
        </div>{/* end qp-body-row */}

        <div className="preview-actions">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={() => generatePDF(quote, user?.companyName, user?.companyPhone, user?.companyAddress, quote.companyLogo || user?.companyLogo, selectedTemplate)}>
            Download PDF
          </button>
          <button className="btn btn-secondary" onClick={() => handleShare(quote)}>Share</button>
        </div>
      </div>
    </div>
  );
}
