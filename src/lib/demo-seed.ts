import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { InvoiceInput } from "./schema";

// Hand-verified data for sample invoices 1, 4 and 5. Seeding uses these instead of
// calling the AI, so a reset costs no AI quota and always gives the same history.
// Samples 2, 3, 6, 7 and 8 are left for the live demo.

function sampleText(file: string): string | null {
  try {
    return readFileSync(path.join(process.cwd(), "public", "sample-invoices", file), "utf8");
  } catch {
    return null;
  }
}

export function demoInvoices(): InvoiceInput[] {
  return [
    {
      supplierName: "Bürowelt Schmidt GmbH",
      supplierVatNumber: "DE143454214",
      supplierCountry: "DE",
      invoiceNumber: "RE-2026-0412",
      invoiceDate: "2026-07-14",
      dueDate: "2026-08-13",
      currency: "EUR",
      subtotal: 349,
      vatAmount: 0,
      total: 349,
      lines: [
        { description: "Kopierpapier A4, 80 g, 500 Blatt", quantity: 20, unitPrice: 4.9 },
        { description: "Toner HP 59A schwarz", quantity: 2, unitPrice: 89.5 },
        { description: "Ordner breit, 8 cm, blau", quantity: 30, unitPrice: 2.4 },
      ],
      rawText: sampleText("01-de-office-supplies.txt"),
    },
    {
      supplierName: "Harbour & Finch Ltd",
      supplierVatNumber: "GB123456789",
      supplierCountry: "GB",
      invoiceNumber: "HF-0219",
      invoiceDate: "2026-08-03",
      dueDate: "2026-09-02",
      currency: "GBP",
      subtotal: 2100,
      vatAmount: 0,
      total: 2100,
      lines: [
        { description: "Brand workshop (1 day, on-site)", quantity: 1, unitPrice: 1200 },
        { description: "Illustration set – custom icons", quantity: 6, unitPrice: 150 },
      ],
      rawText: sampleText("05-uk-design-gbp.txt"),
    },
    {
      supplierName: "Cloudnest, Inc.",
      supplierVatNumber: null,
      supplierCountry: "US",
      invoiceNumber: "INV-10293",
      invoiceDate: "2026-09-01",
      dueDate: "2026-09-15",
      currency: "USD",
      subtotal: 85,
      vatAmount: 0,
      total: 85,
      lines: [
        { description: "Team plan (monthly) – per seat", quantity: 5, unitPrice: 12 },
        { description: "Extra storage 100 GB", quantity: 1, unitPrice: 25 },
      ],
      rawText: sampleText("04-us-saas-usd.txt"),
    },
  ];
}
