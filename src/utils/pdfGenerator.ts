// src/utils/pdfGenerator.ts
import { jsPDF } from 'jspdf';
import { DraftQuote } from '../types';
import { formatCurrency, formatDate } from './formatters';
import { getTemplateById } from './templates';

// ── colour palettes per template ────────────────────────────────────────────
interface Palette {
  // header band
  headerBg:   [number, number, number];
  headerText: [number, number, number];
  // accent / section stripe
  accentBg:   [number, number, number];
  accentText: [number, number, number];
  // table
  thBg:       [number, number, number];
  thText:     [number, number, number];
  tdEven:     [number, number, number];
  tdOdd:      [number, number, number];
  // grand total highlight
  totalBg:    [number, number, number];
  totalText:  [number, number, number];
  // body text
  bodyText:   [number, number, number];
  mutedText:  [number, number, number];
  // borders
  borderColor:[number, number, number];
}

const PALETTES: Record<string, Palette> = {
  'template1': {   // Classic White
    headerBg:    [17,   17,  17],  headerText: [255, 255, 255],
    accentBg:    [247, 247, 247],  accentText: [17,  17,  17],
    thBg:        [17,   17,  17],  thText:     [255, 255, 255],
    tdEven:      [255, 255, 255],  tdOdd:      [247, 247, 247],
    totalBg:     [17,   17,  17],  totalText:  [255, 255, 255],
    bodyText:    [33,   33,  33],  mutedText:  [100, 100, 100],
    borderColor: [200, 200, 200],
  },
  'template2': {   // Monochrome Elite
    headerBg:    [0,     0,   0],  headerText: [255, 255, 255],
    accentBg:    [245, 245, 245],  accentText: [0,   0,   0],
    thBg:        [51,   51,  51],  thText:     [255, 255, 255],
    tdEven:      [255, 255, 255],  tdOdd:      [245, 245, 245],
    totalBg:     [0,     0,   0],  totalText:  [255, 255, 255],
    bodyText:    [20,   20,  20],  mutedText:  [90,  90,  90],
    borderColor: [180, 180, 180],
  },
  'template3': {   // Navy Executive
    headerBg:    [27,  58, 107],   headerText: [255, 255, 255],
    accentBg:    [244, 246, 251],  accentText: [27,  58, 107],
    thBg:        [27,  58, 107],   thText:     [255, 255, 255],
    tdEven:      [255, 255, 255],  tdOdd:      [244, 246, 251],
    totalBg:     [27,  58, 107],   totalText:  [255, 255, 255],
    bodyText:    [33,  33,  33],   mutedText:  [90,  90, 120],
    borderColor: [200, 210, 230],
  },
  'template4': {   // Forest Premium
    headerBg:    [26,  71,  49],   headerText: [255, 255, 255],
    accentBg:    [245, 251, 247],  accentText: [26,  71,  49],
    thBg:        [26,  71,  49],   thText:     [255, 255, 255],
    tdEven:      [255, 255, 255],  tdOdd:      [245, 251, 247],
    totalBg:     [26,  71,  49],   totalText:  [255, 255, 255],
    bodyText:    [33,  33,  33],   mutedText:  [80, 110,  90],
    borderColor: [190, 225, 205],
  },
  'template5': {   // Crimson Prestige
    headerBg:    [123,  29,  29],  headerText: [255, 255, 255],
    accentBg:    [253, 245, 245],  accentText: [123,  29,  29],
    thBg:        [123,  29,  29],  thText:     [255, 255, 255],
    tdEven:      [255, 255, 255],  tdOdd:      [253, 245, 245],
    totalBg:     [123,  29,  29],  totalText:  [255, 255, 255],
    bodyText:    [33,   33,  33],  mutedText:  [110,  60,  60],
    borderColor: [230, 190, 190],
  },
};

const DEFAULT_PALETTE = PALETTES['template1'];

// ── helpers ─────────────────────────────────────────────────────────────────
function setFill(doc: jsPDF, rgb: [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setDraw(doc: jsPDF, rgb: [number, number, number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}
function setTxt(doc: jsPDF, rgb: [number, number, number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

// Try to add a logo image; silently skip if it fails
function tryAddLogo(doc: jsPDF, src: string | undefined, x: number, y: number, maxW: number, maxH: number): number {
  if (!src || !src.startsWith('data:')) return 0;
  try {
    const format = src.includes('image/png') ? 'PNG' : 'JPEG';
    doc.addImage(src, format, x, y, maxW, maxH);
    return maxH + 6;
  } catch {
    return 0;
  }
}

// ── main export ──────────────────────────────────────────────────────────────
export async function generatePDF(
  quote: DraftQuote,
  companyName?: string,
  companyPhone?: string,
  companyAddress?: string,
  companyLogo?: string,
  templateId?: string,
): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pw  = doc.internal.pageSize.getWidth();   // 595
  const ph  = doc.internal.pageSize.getHeight();  // 842
  const ml  = 40;   // left margin
  const mr  = 40;   // right margin
  const uw  = pw - ml - mr;  // usable width = 515
  const quoteNumber = quote.quoteNumber || 'QT-0000';
  const createdDate = quote.createdAt ? new Date(quote.createdAt) : new Date();

  const pal = (templateId && PALETTES[templateId]) ? PALETTES[templateId] : DEFAULT_PALETTE;
  const isSerif = templateId === 'template2' || templateId === 'template5';
  const fontFace = 'helvetica'; // jsPDF built-in; "times" for serif look
  const bodyFont = isSerif ? 'times' : 'helvetica';

  let y = 0;

  // ────────────────────────────────────────────────────────────────────────
  // 1. HEADER BAND
  // ────────────────────────────────────────────────────────────────────────
  const headerH = 100;
  setFill(doc, pal.headerBg);
  doc.rect(0, 0, pw, headerH, 'F');

  // Company block (left)
  let logoH = tryAddLogo(doc, companyLogo, ml, 14, 52, 38);
  const companyStartY = logoH ? 14 + logoH + 4 : 22;

  setTxt(doc, pal.headerText);
  doc.setFont(fontFace, 'bold');
  doc.setFontSize(13);
  doc.text(companyName || 'Your Company', ml, companyStartY);

  doc.setFont(fontFace, 'normal');
  doc.setFontSize(8.5);
  let cx = companyStartY + 13;
  if (companyAddress) { doc.text(companyAddress, ml, cx, { maxWidth: 200 }); cx += 11; }
  if (companyPhone)   { doc.text(`Tel: ${companyPhone}`, ml, cx); cx += 11; }

  // QUOTATION title (right)
  setTxt(doc, pal.headerText);
  doc.setFont(fontFace, 'bold');
  doc.setFontSize(22);
  doc.text('QUOTATION', pw - mr, 30, { align: 'right' });

  // Meta block (right)
  doc.setFont(fontFace, 'normal');
  doc.setFontSize(8);
  const metaX = pw - mr;
  doc.text(`Quote #:   ${quoteNumber}`,                  metaX, 48, { align: 'right' });
  doc.text(`Date:        ${formatDate(createdDate)}`,   metaX, 60, { align: 'right' });
  doc.text(`Valid Until: ${formatDate(quote.details.validUntil)}`, metaX, 72, { align: 'right' });

  // Accent bar under header (3 pt)
  setFill(doc, pal.accentBg.map(v => Math.min(255, v - 20)) as [number,number,number]);
  doc.rect(0, headerH, pw, 3, 'F');

  y = headerH + 3;

  // ────────────────────────────────────────────────────────────────────────
  // 2. BILL TO SECTION
  // ────────────────────────────────────────────────────────────────────────
  const billH = 62;
  setFill(doc, pal.accentBg);
  doc.rect(0, y, pw, billH, 'F');

  // Left accent strip
  setFill(doc, pal.headerBg);
  doc.rect(0, y, 4, billH, 'F');

  setTxt(doc, pal.accentText.map(v => Math.min(255, v + 30)) as [number,number,number]);
  doc.setFont(fontFace, 'bold');
  doc.setFontSize(7.5);
  doc.text('BILL TO', ml + 8, y + 14);

  setTxt(doc, pal.bodyText);
  doc.setFont(bodyFont, 'bold');
  doc.setFontSize(11);
  doc.text(quote.customer.name, ml + 8, y + 28);

  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(8.5);
  let by = y + 40;
  if (quote.customer.address) { doc.text(quote.customer.address, ml + 8, by, { maxWidth: 260 }); by += 11; }
  if (quote.customer.phone)   { doc.text(`Tel: ${quote.customer.phone}`,   ml + 8, by); by += 11; }
  if (quote.customer.email)   { doc.text(quote.customer.email,             ml + 8, by); }

  y += billH + 12;

  // ────────────────────────────────────────────────────────────────────────
  // 3. ITEMS TABLE
  // ────────────────────────────────────────────────────────────────────────
  // Col widths: desc, qty, unit price, amount
  const cols = [265, 55, 100, 95];  // sum = 515
  const colX = [ml, ml + cols[0], ml + cols[0] + cols[1], ml + cols[0] + cols[1] + cols[2]];
  const rowH = 20;
  const thH  = 22;

  // Table header
  setFill(doc, pal.thBg);
  doc.rect(ml, y, uw, thH, 'F');

  setTxt(doc, pal.thText);
  doc.setFont(fontFace, 'bold');
  doc.setFontSize(8);
  const headers = ['DESCRIPTION', 'QTY', 'UNIT PRICE', 'AMOUNT'];
  const hAligns: ('left'|'right')[] = ['left','left','right','right'];
  headers.forEach((h, i) => {
    const tx = i === 0 ? colX[i] + 5
             : i === 1 ? colX[i] + 5
             : colX[i] + cols[i] - 5;
    doc.text(h, tx, y + 15, { align: hAligns[i] });
  });
  y += thH;

  // Body rows
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9);
  setDraw(doc, pal.borderColor);
  doc.setLineWidth(0.3);

  quote.lineItems.forEach((item, idx) => {
    if (y + rowH > ph - 120) {
      doc.addPage();
      y = 40;
    }

    // Alternating background
    setFill(doc, idx % 2 === 0 ? pal.tdEven : pal.tdOdd);
    doc.rect(ml, y, uw, rowH, 'F');

    // Bottom border
    setDraw(doc, pal.borderColor);
    doc.line(ml, y + rowH, ml + uw, y + rowH);

    setTxt(doc, pal.bodyText);
    const desc = doc.splitTextToSize(item.description, cols[0] - 10);
    doc.text(desc[0], colX[0] + 5, y + 13);
    doc.text(String(item.quantity),                          colX[1] + 5,          y + 13);
    doc.text(formatCurrency(item.price, quote.currency),     colX[2] + cols[2] - 5, y + 13, { align: 'right' });
    doc.text(formatCurrency(item.total, quote.currency),     colX[3] + cols[3] - 5, y + 13, { align: 'right' });

    y += rowH;
  });

  // Outer border around whole table
  setDraw(doc, pal.headerBg);
  doc.setLineWidth(0.8);
  doc.rect(ml, y - (quote.lineItems.length * rowH) - thH, uw,
           quote.lineItems.length * rowH + thH, 'S');
  doc.setLineWidth(0.3);

  y += 14;

  // ────────────────────────────────────────────────────────────────────────
  // 4. TOTALS
  // ────────────────────────────────────────────────────────────────────────
  const totW  = 210;
  const totX  = pw - mr - totW;
  const totLX = totX + 8;
  const totRX = pw - mr - 8;

  // Subtotal
  setTxt(doc, pal.mutedText);
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9);
  doc.text('Subtotal',                                   totLX, y);
  doc.text(formatCurrency(quote.subtotal, quote.currency), totRX, y, { align: 'right' });
  y += 16;

  // Tax
  if (quote.details.vatEnabled && quote.tax > 0) {
    doc.text(`Tax (${quote.details.vatRate}%)`,              totLX, y);
    doc.text(formatCurrency(quote.tax, quote.currency),       totRX, y, { align: 'right' });
    y += 16;
  }

  // Grand total highlight box
  setFill(doc, pal.totalBg);
  doc.rect(totX, y - 2, totW, 22, 'F');

  setTxt(doc, pal.totalText);
  doc.setFont(fontFace, 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL',                                       totLX, y + 13);
  doc.text(formatCurrency(quote.total, quote.currency),   totRX, y + 13, { align: 'right' });
  y += 30;

  // ────────────────────────────────────────────────────────────────────────
  // 5. NOTES
  // ────────────────────────────────────────────────────────────────────────
  if (quote.notes) {
    y += 10;
    setTxt(doc, pal.headerBg);
    doc.setFont(fontFace, 'bold');
    doc.setFontSize(8.5);
    doc.text('NOTES', ml, y);
    y += 12;
    setTxt(doc, pal.mutedText);
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(8.5);
    const noteLines = doc.splitTextToSize(quote.notes, uw);
    doc.text(noteLines, ml, y);
    y += noteLines.length * 11 + 6;
  }

  // ────────────────────────────────────────────────────────────────────────
  // 6. FOOTER BAND (pinned near bottom)
  // ────────────────────────────────────────────────────────────────────────
  const footerY = ph - 36;
  setFill(doc, pal.headerBg);
  doc.rect(0, footerY, pw, 36, 'F');

  setTxt(doc, pal.headerText);
  doc.setFont(fontFace, 'normal');
  doc.setFontSize(9);
  doc.text('Thank you for your business.', ml, footerY + 15);
  doc.setFontSize(7.5);
  setTxt(doc, pal.headerText.map(v => Math.round(v * 0.7)) as [number,number,number]);
  doc.text(`Generated by AydQuoteMaker`, pw - mr, footerY + 15, { align: 'right' });

  doc.save(`Quote-${quoteNumber}.pdf`);
}
