import jsPDF from 'jspdf';

export interface RecipePdfField {
  label: string;
  value: string | number | null | undefined;
}

export interface RecipePdfSection {
  title: string;
  fields: RecipePdfField[];
}

export interface RecipePdfInput {
  title: string;
  subtitle?: string | null;
  badges?: string[];
  sections: RecipePdfSection[];
  notes?: string | null;
  updatedAt?: string;
  processLabel?: string;
}

const MARGIN = 48;
const PAGE_W = 612; // letter, portrait, pt
const PAGE_H = 792;

export function buildRecipePdf(input: RecipePdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  let y = MARGIN;

  const newPageIfNeeded = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(input.title || 'Production Recipe', MARGIN, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const headerBits = [input.processLabel, input.subtitle, ...(input.badges || [])].filter(
    Boolean,
  ) as string[];
  if (headerBits.length) {
    doc.setTextColor(90);
    doc.text(headerBits.join('  •  '), MARGIN, y);
    doc.setTextColor(0);
    y += 16;
  }

  doc.setFontSize(9);
  doc.setTextColor(120);
  const stamp = input.updatedAt ? new Date(input.updatedAt) : new Date();
  doc.text(`Generated ${new Date().toLocaleString()}  |  Recipe updated ${stamp.toLocaleString()}`, MARGIN, y);
  doc.setTextColor(0);
  y += 12;

  doc.setDrawColor(200);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  y += 20;

  // Sections
  for (const section of input.sections) {
    const fields = section.fields.filter(
      (f) => f.value !== null && f.value !== undefined && String(f.value).trim() !== '',
    );
    if (!fields.length) continue;

    newPageIfNeeded(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(section.title, MARGIN, y);
    y += 6;
    doc.setDrawColor(220);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 14;

    doc.setFontSize(10);
    for (const field of fields) {
      const valueLines = doc.splitTextToSize(String(field.value), PAGE_W - MARGIN * 2 - 150);
      newPageIfNeeded(valueLines.length * 13 + 4);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(70);
      doc.text(`${field.label}`, MARGIN, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      doc.text(valueLines, MARGIN + 150, y);
      y += valueLines.length * 13 + 3;
    }
    y += 12;
  }

  // Notes
  if (input.notes && input.notes.trim()) {
    newPageIfNeeded(60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Notes', MARGIN, y);
    y += 6;
    doc.setDrawColor(220);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(input.notes, PAGE_W - MARGIN * 2);
    for (const line of lines) {
      newPageIfNeeded(13);
      doc.text(line, MARGIN, y);
      y += 13;
    }
  }

  return doc;
}

export function recipePdfFilename(input: RecipePdfInput): string {
  const safe = (input.title || 'recipe').replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-');
  const proc = (input.processLabel || 'recipe').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `${proc}-${safe || 'recipe'}.pdf`;
}

export function recipePdfBlob(input: RecipePdfInput): Blob {
  return buildRecipePdf(input).output('blob');
}

/**
 * Saves the recipe PDF. Inside the preview iframe (and some in-app browsers)
 * a plain anchor download is blocked, so fall back to opening the PDF in a
 * new tab where the user can save it manually.
 */
export function downloadRecipePdf(input: RecipePdfInput): 'downloaded' | 'opened' {
  const blob = recipePdfBlob(input);
  const filename = recipePdfFilename(input);
  const url = URL.createObjectURL(blob);

  const sandboxed = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  if (!sandboxed) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'downloaded';
  }

  const win = window.open(url, '_blank', 'noopener');
  if (!win) {
    // Popup blocked — try the anchor route anyway as a last resort.
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'opened';
}
