// Reads text positions and embedded preview images from a PDF with pdf.js.
// Runs in the browser (and in Node for fixture generation). No network, no AI.
import type { PageData, PageImage, PdfData, TextItem } from './pdfTypes';

// pdf.js types are loose; keep the surface we use small.
/* eslint-disable @typescript-eslint/no-explicit-any */
type PdfjsLib = any;

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function mul(m: Matrix, n: Matrix): Matrix {
  // returns n x m (apply n first, then m) the way PDF concatenates the CTM: CTM' = n * CTM
  return [
    n[0] * m[0] + n[1] * m[2],
    n[0] * m[1] + n[1] * m[3],
    n[2] * m[0] + n[3] * m[2],
    n[2] * m[1] + n[3] * m[3],
    n[4] * m[0] + n[5] * m[2] + m[4],
    n[4] * m[1] + n[5] * m[3] + m[5],
  ];
}

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

async function sha256Hex(bytes: Uint8Array | Uint8ClampedArray): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256File(data: ArrayBuffer | Uint8Array): Promise<string> {
  return sha256Hex(data instanceof Uint8Array ? data : new Uint8Array(data));
}

export interface ExtractOptions {
  /** keep the open pdf.js document so previews can be rendered afterwards */
  keepOpen?: boolean;
}

export interface ExtractResult extends PdfData {
  /** the open pdf.js document when keepOpen is set */
  doc?: any;
}

/** Wait for a pdf.js page object (images are decoded asynchronously). */
function getObj(page: any, id: string): Promise<any> {
  return new Promise((resolve) => {
    const store = id.startsWith('g_') ? page.commonObjs : page.objs;
    try {
      store.get(id, (obj: any) => resolve(obj));
    } catch {
      resolve(null);
    }
  });
}

export async function extractPdf(
  pdfjs: PdfjsLib,
  data: Uint8Array,
  opts: ExtractOptions = {},
): Promise<ExtractResult> {
  const doc = await pdfjs.getDocument({
    data,
    disableFontFace: true,
    isOffscreenCanvasSupported: false, // decoded images come back as raw pixels in every environment
    isEvalSupported: false,
  }).promise;
  let title: string | null = null;
  try {
    const meta = await doc.getMetadata();
    title = (meta?.info as any)?.Title ?? null;
  } catch {
    title = null;
  }

  const pages: PageData[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const H = vp.height;
    const tc = await page.getTextContent();
    const items: TextItem[] = [];
    for (const it of tc.items as any[]) {
      const t = typeof it.str === 'string' ? it.str.trim() : '';
      if (!t) continue;
      items.push({
        t,
        x: round(it.transform[4]),
        y: round(H - it.transform[5]),
        w: round(it.width),
        h: round(it.height),
      });
    }
    items.sort((a, b) => Math.round(a.y) - Math.round(b.y) || a.x - b.x);

    // Images: walk the operator list tracking the current transformation matrix.
    const OPS = pdfjs.OPS;
    const ops = await page.getOperatorList();
    const images: PageImage[] = [];
    const stack: Matrix[] = [];
    let ctm: Matrix = IDENTITY;
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      const args = ops.argsArray[i];
      if (fn === OPS.save) stack.push(ctm);
      else if (fn === OPS.restore) ctm = stack.pop() ?? IDENTITY;
      else if (fn === OPS.transform) ctm = mul(ctm, args as Matrix);
      else if (fn === OPS.paintFormXObjectBegin) {
        stack.push(ctm);
        if (Array.isArray(args?.[0]) && args[0].length === 6) ctm = mul(ctm, args[0] as Matrix);
      } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? IDENTITY;
      else if (fn === OPS.paintImageXObject) {
        const objId = args[0] as string;
        const corners = [apply(ctm, 0, 0), apply(ctm, 1, 0), apply(ctm, 0, 1), apply(ctm, 1, 1)];
        const xs = corners.map((c) => c[0]);
        const ys = corners.map((c) => H - c[1]);
        const box = {
          x: round(Math.min(...xs)),
          y: round(Math.min(...ys)),
          w: round(Math.max(...xs) - Math.min(...xs)),
          h: round(Math.max(...ys) - Math.min(...ys)),
        };
        const obj = await getObj(page, objId);
        const pw = obj?.width ?? args[1] ?? 0;
        const ph = obj?.height ?? args[2] ?? 0;
        let hash = '';
        if (obj?.data) hash = (await sha256Hex(obj.data)).slice(0, 16);
        images.push({ ...box, pw, ph, hash, objId });
      }
    }
    pages.push({ page: p, width: round(vp.width), height: round(H), items, images });
  }

  if (!opts.keepOpen) {
    await doc.destroy();
    return { title, pages };
  }
  return { title, pages, doc };
}

/**
 * Turn a decoded pdf.js image into PNG bytes (browser only).
 * Returns null when the image can't be read; the caller falls back to "no preview".
 */
export async function imageToPngBlob(doc: any, pageNo: number, objId: string): Promise<Blob | null> {
  const page = await doc.getPage(pageNo);
  await page.getOperatorList(); // ensures objects are resolved
  const obj = await getObj(page, objId);
  if (!obj?.data || !obj.width || !obj.height) return null;
  const { width, height, data } = obj as { width: number; height: number; data: Uint8ClampedArray };
  const rgba = new Uint8ClampedArray(width * height * 4);
  const px = width * height;
  if (data.length === px * 4) rgba.set(data);
  else if (data.length === px * 3) {
    for (let i = 0, j = 0; i < px; i++, j += 3) {
      rgba[i * 4] = data[j];
      rgba[i * 4 + 1] = data[j + 1];
      rgba[i * 4 + 2] = data[j + 2];
      rgba[i * 4 + 3] = 255;
    }
  } else if (data.length === px) {
    for (let i = 0; i < px; i++) {
      rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = data[i];
      rgba[i * 4 + 3] = 255;
    }
  } else return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}
