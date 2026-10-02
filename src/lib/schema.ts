import { z } from "zod";

// ---------------------------------------------------------------------------
// 1. What we ask the AI for. Everything nullable: the model must say "not on
//    the invoice" instead of guessing. This schema is also sent to Gemini as
//    its structured-output JSON schema, so there is a single source of truth.
// ---------------------------------------------------------------------------

export const extractedLineSchema = z.object({
  description: z.string().describe("Line item description exactly as printed"),
  quantity: z.number().nullable().describe("Quantity, or null if not printed"),
  unitPrice: z.number().nullable().describe("Unit price excluding VAT, or null if not printed"),
});

export const extractedInvoiceSchema = z.object({
  supplierName: z.string().nullable().describe("Legal name of the company that issued the invoice (the seller, not the customer)"),
  supplierVatNumber: z.string().nullable().describe("Seller's VAT number including country prefix, exactly as printed"),
  supplierCountry: z.string().nullable().describe("Seller's country as ISO 3166-1 alpha-2 code, e.g. DE"),
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable().describe("Invoice date as YYYY-MM-DD"),
  dueDate: z.string().nullable().describe("Payment due date as YYYY-MM-DD"),
  currency: z.string().nullable().describe("ISO 4217 currency code, e.g. EUR, USD"),
  subtotal: z.number().nullable().describe("Total excluding VAT"),
  vatAmount: z.number().nullable().describe("VAT/tax amount"),
  total: z.number().nullable().describe("Total including VAT (amount due)"),
  lines: z.array(extractedLineSchema),
});

export type ExtractedInvoice = z.infer<typeof extractedInvoiceSchema>;

// ---------------------------------------------------------------------------
// 2. What the user submits after reviewing. Stricter: the fields the checks
//    depend on are required. Validated again on the server before saving.
// ---------------------------------------------------------------------------

const money = z.number().finite();
const isoDate = z.iso.date({ message: "Use YYYY-MM-DD" });

export const invoiceLineInputSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  quantity: money.nullable(),
  unitPrice: money.nullable(),
});

export const invoiceInputSchema = z.object({
  supplierName: z.string().trim().min(1, "Supplier name is required"),
  supplierVatNumber: z.string().trim().nullable(),
  supplierCountry: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Use a 2-letter country code")
    .nullable(),
  invoiceNumber: z.string().trim().min(1, "Invoice number is required"),
  invoiceDate: isoDate,
  dueDate: isoDate.nullable(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code"),
  subtotal: money.nullable(),
  vatAmount: money.nullable(),
  total: money,
  lines: z.array(invoiceLineInputSchema),
  rawText: z.string().max(50_000).nullable(),
});

export type InvoiceInput = z.infer<typeof invoiceInputSchema>;

export type CheckStatus = "ok" | "warning" | "problem";
