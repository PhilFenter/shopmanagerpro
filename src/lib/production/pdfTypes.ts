// Shared shapes for the InkSoft work-order PDF reader.
// Coordinates are PDF points with the origin at the TOP-LEFT of the page
// (pdf.js reports bottom-left; pdfExtract converts).

export interface TextItem {
  /** text, trimmed */
  t: string;
  /** left edge */
  x: number;
  /** baseline, measured from the top of the page */
  y: number;
  w: number;
  h: number;
}

export interface PageImage {
  /** bounding box on the page, top-left origin */
  x: number;
  y: number;
  w: number;
  h: number;
  /** pixel size of the embedded image */
  pw: number;
  ph: number;
  /** sha-256 (hex, first 16 chars) of the pixel data, used to de-duplicate and fingerprint */
  hash: string;
  /** operator-list object id; only meaningful while the PDF is open */
  objId?: string;
}

export interface PageData {
  page: number; // 1-based
  width: number;
  height: number;
  items: TextItem[];
  images: PageImage[];
}

export interface PdfData {
  title: string | null;
  pages: PageData[];
}
