// Client-side PDF text extraction with pdf.js. The PDF never leaves the browser;
// only the extracted text is sent to the server.

export class ScannedPdfError extends Error {}

const MAX_PAGES = 10;
const MIN_TEXT_CHARS = 40;

interface TextItem {
  str: string;
  transform: number[]; // [a, b, c, d, x, y]
  width: number;
}

/** Rebuild visual lines from positioned text fragments so tables keep their rows. */
function itemsToLines(items: TextItem[]): string[] {
  const rows: { y: number; items: TextItem[] }[] = [];
  for (const item of items) {
    if (!item.str.trim()) continue;
    const y = item.transform[5];
    const row = rows.find((r) => Math.abs(r.y - y) < 3);
    if (row) row.items.push(item);
    else rows.push({ y, items: [item] });
  }
  rows.sort((a, b) => b.y - a.y); // PDF y-axis points up

  return rows.map((row) => {
    row.items.sort((a, b) => a.transform[4] - b.transform[4]);
    let line = "";
    let lastEnd: number | null = null;
    for (const it of row.items) {
      const x = it.transform[4];
      if (lastEnd != null) {
        const gap = x - lastEnd;
        line += gap > 12 ? "    " : gap > 1.5 ? " " : "";
      }
      line += it.str;
      lastEnd = x + it.width;
    }
    return line.trimEnd();
  });
}

export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const doc = await task.promise;
  const pages: string[] = [];
  try {
    for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(itemsToLines(content.items as TextItem[]).join("\n"));
    }
  } finally {
    await task.destroy();
  }

  const text = pages.join("\n\n").trim();
  if (text.replace(/\s/g, "").length < MIN_TEXT_CHARS) {
    throw new ScannedPdfError(
      "This PDF has no text layer. It is probably a scan or a photo. Scanned invoices are not supported yet: copy the text manually or ask the supplier for a digital PDF.",
    );
  }
  return text;
}
