import "server-only";
import { checkArithmetic } from "./checks/arithmetic";
import { checkDuplicates } from "./checks/duplicates";
import { fxCheckResult, vatCheckResult } from "./checks/external";
import { lineKey, supplierNameKey } from "./checks/normalize";
import { checkPriceIncreases } from "./checks/price-increase";
import { worstStatus, type HistoryInvoice } from "./checks/types";
import { db, num } from "./db";
import { getEurRate, roundMoney, toEur } from "./fx";
import type { InvoiceInput } from "./schema";
import { checkVat, normalizeVat } from "./vies";

// The deterministic pipeline that runs after the user has reviewed the fields.
// No AI is involved from here on.

async function findOrCreateSupplier(input: InvoiceInput, vatFull: string | null, country: string | null) {
  const nameKey = supplierNameKey(input.supplierName);
  const supabase = db();

  if (vatFull) {
    const { data } = await supabase.from("suppliers").select("id").eq("vat_number", vatFull).maybeSingle();
    if (data) return data.id as string;
  }

  // Fall back to the normalized name, but never merge with a supplier that has a different VAT number.
  const { data: byName } = await supabase
    .from("suppliers")
    .select("id, vat_number")
    .eq("name_key", nameKey)
    .limit(5);
  const match = byName?.find((s) => !s.vat_number || !vatFull);
  if (match) {
    if (vatFull && !match.vat_number) {
      await supabase.from("suppliers").update({ vat_number: vatFull }).eq("id", match.id);
    }
    return match.id as string;
  }

  const { data: created, error } = await supabase
    .from("suppliers")
    .insert({ name: input.supplierName, name_key: nameKey, vat_number: vatFull, country_code: country })
    .select("id")
    .single();
  if (error) throw new Error(`Could not create supplier: ${error.message}`);
  return created.id as string;
}

async function loadHistory(supplierId: string): Promise<HistoryInvoice[]> {
  const { data, error } = await db()
    .from("invoices")
    .select("id, invoice_number, invoice_date, currency, total, invoice_lines(description, description_key, unit_price, unit_price_eur)")
    .eq("supplier_id", supplierId);
  if (error) throw new Error(`Could not load supplier history: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    invoiceNumber: r.invoice_number,
    invoiceDate: r.invoice_date,
    currency: r.currency,
    total: num(r.total)!,
    lines: (r.invoice_lines ?? []).map((l) => ({
      description: l.description,
      descriptionKey: l.description_key,
      unitPrice: num(l.unit_price),
      unitPriceEur: num(l.unit_price_eur),
    })),
  }));
}

export async function processInvoice(input: InvoiceInput): Promise<string> {
  const vat = input.supplierVatNumber ? normalizeVat(input.supplierVatNumber, input.supplierCountry) : null;
  const vatFull = vat?.countryCode ? `${vat.countryCode}${vat.vatNumber}` : (vat?.vatNumber ?? null);
  const country = input.supplierCountry ?? (vat?.countryCode === "EL" ? "GR" : (vat?.countryCode ?? null));

  const supplierId = await findOrCreateSupplier(input, vatFull, country);

  // External calls and history lookup are independent, so run them in parallel.
  const [vatResult, fx, history] = await Promise.all([
    checkVat(input.supplierVatNumber, input.supplierCountry),
    getEurRate(input.currency, input.invoiceDate),
    loadHistory(supplierId),
  ]);

  const lines = input.lines.map((l, i) => ({
    position: i + 1,
    description: l.description,
    descriptionKey: lineKey(l.description),
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    unitPriceEur: l.unitPrice == null || fx.rate == null ? null : Math.round(l.unitPrice * fx.rate * 10_000) / 10_000,
  }));
  const totalEur = toEur(input.total, fx.rate);

  const checks = [
    vatCheckResult(vatResult),
    fxCheckResult(fx, input.total, input.currency, totalEur),
    checkDuplicates(input, history),
    checkPriceIncreases({ invoiceDate: input.invoiceDate, currency: input.currency, lines }, history),
    checkArithmetic(input),
  ];

  const { data: id, error } = await db().rpc("save_invoice", {
    inv: {
      supplier_id: supplierId,
      invoice_number: input.invoiceNumber,
      invoice_date: input.invoiceDate,
      due_date: input.dueDate,
      currency: input.currency,
      subtotal: input.subtotal == null ? null : roundMoney(input.subtotal),
      vat_amount: input.vatAmount == null ? null : roundMoney(input.vatAmount),
      total: roundMoney(input.total),
      fx_rate: fx.rate,
      fx_rate_date: fx.rateDate,
      total_eur: totalEur,
      vat_status: vatResult.status,
      vies_name: vatResult.registeredName,
      vat_checked_at: vatResult.checkedAt,
      overall_status: worstStatus(checks),
      raw_text: input.rawText,
    },
    lines: lines.map((l) => ({
      position: l.position,
      description: l.description,
      description_key: l.descriptionKey,
      quantity: l.quantity,
      unit_price: l.unitPrice,
      unit_price_eur: l.unitPriceEur,
    })),
    checks,
  });
  if (error) throw new Error(`Could not save invoice: ${error.message}`);
  return id as string;
}
