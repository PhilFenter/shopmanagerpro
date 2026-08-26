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
const CONTENT_W = PAGE_W - MARGIN * 2;
const LABEL_W = 150;
const VALUE_W = CONTENT_W - LABEL_W - 20;
const LINE_H = 13;

export function buildRecipePdf(input: RecipePdfInput): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  let y = MARGIN;

  const newPageIfNeeded = (needed: number) => {
    if (y + needed > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // ---- Header band -------------------------------------------------------
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, PAGE_W, 84, 'F');

  doc.setTextColor(255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  const titleLines = doc.splitTextToSize(input.title || 'Production Recipe', CONTENT_W);
  doc.text(titleLines[0], MARGIN, 38);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(200);
  const headerBits = [input.processLabel, input.subtitle, ...(input.badges || [])].filter(
    Boolean,
  ) as string[];
  if (headerBits.length) {
    doc.text(doc.splitTextToSize(headerBits.join('   •   '), CONTENT_W)[0], MARGIN, 56);
  }

  doc.setFontSize(8);
  doc.setTextColor(160);
  const stamp = input.updatedAt ? new Date(input.updatedAt) : new Date();
  doc.text(
    `Generated ${new Date().toLocaleString()}      Recipe updated ${stamp.toLocaleString()}`,
    MARGIN,
    72,
  );

  doc.setTextColor(0);
  y = 84 + 26;

  // ---- Sections ----------------------------------------------------------
  for (const section of input.sections) {
    const fields = section.fields.filter(
      (f) => f.value !== null && f.value !== undefined && String(f.value).trim() !== '',
    );
    if (!fields.length) continue;

    newPageIfNeeded(56);

    // Section header bar
    doc.setFillColor(241, 241, 245);
    doc.rect(MARGIN, y, CONTENT_W, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30);
    doc.text(section.title.toUpperCase(), MARGIN + 8, y + 14);
    y += 20;

    doc.setFontSize(9.5);
    let striped = false;
    for (const field of fields) {
      const valueLines: string[] = doc.splitTextToSize(String(field.value), VALUE_W);
      const rowH = Math.max(valueLines.length * LINE_H, 18) + 4;
      newPageIfNeeded(rowH);

      if (striped) {
        doc.setFillColor(250, 250, 251);
        doc.rect(MARGIN, y, CONTENT_W, rowH, 'F');
      }
      striped = !striped;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100);
      doc.text(doc.splitTextToSize(field.label, LABEL_W - 8)[0], MARGIN + 8, y + 13);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(20);
      doc.text(valueLines, MARGIN + LABEL_W + 8, y + 13);

      y += rowH;
      doc.setDrawColor(232);
      doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    }
    y += 20;
  }

  // ---- Notes -------------------------------------------------------------
  if (input.notes && input.notes.trim()) {
    newPageIfNeeded(60);
    doc.setFillColor(241, 241, 245);
    doc.rect(MARGIN, y, CONTENT_W, 20, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(30);
    doc.text('NOTES', MARGIN + 8, y + 14);
    y += 30;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(20);
    const lines: string[] = doc.splitTextToSize(input.notes, CONTENT_W - 16);
    for (const line of lines) {
      newPageIfNeeded(LINE_H);
      doc.text(line, MARGIN + 8, y);
      y += LINE_H;
    }
  }

  // ---- Page footers ------------------------------------------------------
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(input.title || 'Production Recipe', MARGIN, PAGE_H - 26);
    doc.text(`Page ${p} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 26, { align: 'right' });
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

export function isSandboxedPreview(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** Plain file download via an anchor. Works in the published app / standalone tab. */
export function downloadRecipePdf(input: RecipePdfInput) {
  const url = URL.createObjectURL(recipePdfBlob(input));
  const a = document.createElement('a');
  a.href = url;
  a.download = recipePdfFilename(input);
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
