import "server-only";
import type { CheckType } from "./checks/types";
import { db, num } from "./db";
import type { CheckStatus } from "./schema";
import type { VatStatus } from "./vies";

export interface InvoiceRow {
  id: string;
  supplierId: string;
  supplierName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  currency: string;
  total: number;
  totalEur: number | null;
  vatStatus: VatStatus;
  overallStatus: CheckStatus;
  createdAt: string;
  /** Flagged as a duplicate (same invoice number): excluded from totals and price history. */
  isDuplicate: boolean;
}

export interface InvoiceDetail extends InvoiceRow {
  subtotal: number | null;
  vatAmount: number | null;
  fxRate: number | null;
  fxRateDate: string | null;
  supplierVatNumber: string | null;
  supplierCountry: string | null;
  viesName: string | null;
  rawText: string | null;
  lines: { description: string; quantity: number | null; unitPrice: number | null; unitPriceEur: number | null }[];
  checks: { type: CheckType; status: CheckStatus; title: string; message: string; details: Record<string, unknown> | null }[];
}

const INVOICE_COLUMNS =
  "id, supplier_id, invoice_number, invoice_date, due_date, currency, total, total_eur, vat_status, overall_status, created_at, suppliers(name)";
// Only the duplicate check result, under an alias so it can't clash with a full invoice_checks embed.
const DUP_COLUMNS = "dup:invoice_checks(check_type, status)";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isDuplicate = (checks: any[] | undefined) =>
  (checks ?? []).some((c) => c.check_type === "duplicate" && c.status === "problem");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(r: any): InvoiceRow {
  return {
    id: r.id,
    supplierId: r.supplier_id,
    supplierName: r.suppliers?.name ?? "Unknown supplier",
    invoiceNumber: r.invoice_number,
    invoiceDate: r.invoice_date,
    dueDate: r.due_date,
    currency: r.currency,
    total: num(r.total)!,
    totalEur: num(r.total_eur),
    vatStatus: r.vat_status,
    overallStatus: r.overall_status,
    createdAt: r.created_at,
    isDuplicate: isDuplicate(r.dup),
  };
}

export async function listInvoices(): Promise<InvoiceRow[]> {
  const { data, error } = await db()
    .from("invoices")
    .select(`${INVOICE_COLUMNS}, ${DUP_COLUMNS}`)
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toRow);
}

const CHECK_ORDER: CheckType[] = ["duplicate", "vat", "price_increase", "arithmetic", "fx"];
const SEVERITY: Record<CheckStatus, number> = { ok: 0, warning: 1, problem: 2 };

export async function getInvoice(id: string): Promise<InvoiceDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data: r, error } = await db()
    .from("invoices")
    .select(
      `id, supplier_id, invoice_number, invoice_date, due_date, currency, total, total_eur, vat_status,
       overall_status, created_at, subtotal, vat_amount, fx_rate, fx_rate_date, vies_name, raw_text,
       suppliers(name, vat_number, country_code),
       invoice_lines(position, description, quantity, unit_price, unit_price_eur),
       invoice_checks(check_type, status, title, message, details)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!r) return null;

  return {
    ...toRow(r),
    isDuplicate: isDuplicate(r.invoice_checks),
    subtotal: num(r.subtotal),
    vatAmount: num(r.vat_amount),
    fxRate: num(r.fx_rate),
    fxRateDate: r.fx_rate_date,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supplierVatNumber: (r.suppliers as any)?.vat_number ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supplierCountry: (r.suppliers as any)?.country_code ?? null,
    viesName: r.vies_name,
    rawText: r.raw_text,
    lines: [...(r.invoice_lines ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((l) => ({
        description: l.description,
        quantity: num(l.quantity),
        unitPrice: num(l.unit_price),
        unitPriceEur: num(l.unit_price_eur),
      })),
    checks: [...(r.invoice_checks ?? [])]
      .map((c) => ({
        type: c.check_type as CheckType,
        status: c.status as CheckStatus,
        title: c.title as string,
        message: c.message as string,
        details: c.details as Record<string, unknown> | null,
      }))
      // Most severe first, then a fixed order so the page is predictable.
      .sort(
        (a, b) =>
          SEVERITY[b.status] - SEVERITY[a.status] || CHECK_ORDER.indexOf(a.type) - CHECK_ORDER.indexOf(b.type),
      ),
  };
}

export interface SupplierRow {
  id: string;
  name: string;
  vatNumber: string | null;
  countryCode: string | null;
  invoiceCount: number;
  totalEur: number;
  lastInvoiceDate: string | null;
  openIssues: number;
}

export async function listSuppliers(): Promise<SupplierRow[]> {
  const { data, error } = await db()
    .from("suppliers")
    .select(`id, name, vat_number, country_code, invoices(invoice_date, total_eur, overall_status, ${DUP_COLUMNS})`)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((s) => {
      const invs = s.invoices ?? [];
      return {
        id: s.id,
        name: s.name,
        vatNumber: s.vat_number,
        countryCode: s.country_code,
        invoiceCount: invs.length,
        totalEur: invs.filter((i) => !isDuplicate(i.dup)).reduce((sum, i) => sum + (num(i.total_eur) ?? 0), 0),
        lastInvoiceDate: invs.map((i) => i.invoice_date).sort().at(-1) ?? null,
        openIssues: invs.filter((i) => i.overall_status !== "ok").length,
      };
    })
    .filter((s) => s.invoiceCount > 0);
}

export interface SupplierDetail {
  id: string;
  name: string;
  vatNumber: string | null;
  countryCode: string | null;
  invoices: InvoiceRow[];
  priceHistory: {
    description: string;
    points: { date: string; invoiceId: string; invoiceNumber: string; unitPrice: number; currency: string }[];
  }[];
}

export async function getSupplier(id: string): Promise<SupplierDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = db();
  const { data: s, error } = await supabase
    .from("suppliers")
    .select("id, name, vat_number, country_code")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!s) return null;

  const { data: invs, error: invErr } = await supabase
    .from("invoices")
    .select(`${INVOICE_COLUMNS}, ${DUP_COLUMNS}, invoice_lines(description, description_key, unit_price)`)
    .eq("supplier_id", id)
    .order("invoice_date", { ascending: true });
  if (invErr) throw new Error(invErr.message);

  // Group line prices by normalized description to show how each item's price evolved.
  const byKey = new Map<string, SupplierDetail["priceHistory"][number]>();
  for (const inv of invs ?? []) {
    if (isDuplicate(inv.dup)) continue;
    for (const l of inv.invoice_lines ?? []) {
      if (l.unit_price == null) continue;
      const entry: SupplierDetail["priceHistory"][number] = byKey.get(l.description_key) ?? {
        description: l.description,
        points: [],
      };
      entry.points.push({
        date: inv.invoice_date,
        invoiceId: inv.id,
        invoiceNumber: inv.invoice_number,
        unitPrice: num(l.unit_price)!,
        currency: inv.currency,
      });
      byKey.set(l.description_key, entry);
    }
  }

  return {
    id: s.id,
    name: s.name,
    vatNumber: s.vat_number,
    countryCode: s.country_code,
    invoices: (invs ?? []).map(toRow).reverse(),
    priceHistory: [...byKey.values()].sort((a, b) => b.points.length - a.points.length),
  };
}
