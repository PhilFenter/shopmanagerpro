// Dev helper: dump the positioned text + image boxes of a work-order PDF as JSON.
// Usage: npx vite-node scripts/dump-workorder.ts <file.pdf> > out.json
import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdf } from '../src/lib/production/pdfExtract';

const file = process.argv[2];
const data = new Uint8Array(fs.readFileSync(file));
const res = await extractPdf(pdfjs, data);
for (const p of res.pages) for (const im of p.images) delete im.objId;
process.stdout.write(JSON.stringify(res));
