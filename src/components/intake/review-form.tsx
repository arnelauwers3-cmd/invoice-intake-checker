"use client";

import clsx from "clsx";
import { ArrowLeft, Loader2, Plus, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import { invoiceInputSchema, type ExtractedInvoice } from "@/lib/schema";
import { Steps } from "./intake-flow";

type LineState = { id: number; description: string; quantity: string; unitPrice: string };
type FormState = Record<
  | "supplierName" | "supplierVatNumber" | "supplierCountry" | "invoiceNumber" | "invoiceDate"
  | "dueDate" | "currency" | "subtotal" | "vatAmount" | "total",
  string
> & { lines: LineState[] };

type FieldName = Exclude<keyof FormState, "lines">;

let nextLineId = 1;

export function emptyInvoice(): ExtractedInvoice {
  return {
    supplierName: null, supplierVatNumber: null, supplierCountry: null, invoiceNumber: null, invoiceDate: null,
    dueDate: null, currency: "EUR", subtotal: null, vatAmount: null, total: null,
    lines: [{ description: "", quantity: null, unitPrice: null }],
  };
}

const str = (v: string | number | null) => (v == null ? "" : String(v));

function toFormState(inv: ExtractedInvoice): FormState {
  return {
    supplierName: str(inv.supplierName),
    supplierVatNumber: str(inv.supplierVatNumber),
    supplierCountry: str(inv.supplierCountry),
    invoiceNumber: str(inv.invoiceNumber),
    invoiceDate: str(inv.invoiceDate),
    dueDate: str(inv.dueDate),
    currency: str(inv.currency),
    subtotal: str(inv.subtotal),
    vatAmount: str(inv.vatAmount),
    total: str(inv.total),
    lines: inv.lines.map((l) => ({
      id: nextLineId++,
      description: l.description,
      quantity: str(l.quantity),
      unitPrice: str(l.unitPrice),
    })),
  };
}

/** Accepts "1234.5", "1,234.50", "1.234,50", "1 234,50". Returns NaN for garbage, null for empty. */
export function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/[\s'€$£]/g, "");
  if (!s) return null;
  if (s.includes(",") && s.includes(".")) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}

const orNull = (s: string) => (s.trim() ? s.trim() : null);

function toPayload(f: FormState, rawText: string) {
  return {
    supplierName: f.supplierName.trim(),
    supplierVatNumber: orNull(f.supplierVatNumber),
    supplierCountry: orNull(f.supplierCountry),
    invoiceNumber: f.invoiceNumber.trim(),
    invoiceDate: f.invoiceDate.trim(),
    dueDate: orNull(f.dueDate),
    currency: f.currency.trim(),
    subtotal: parseAmount(f.subtotal),
    vatAmount: parseAmount(f.vatAmount),
    total: parseAmount(f.total) ?? undefined,
    lines: f.lines
      .filter((l) => l.description.trim() || l.quantity.trim() || l.unitPrice.trim())
      .map((l) => ({ description: l.description.trim(), quantity: parseAmount(l.quantity), unitPrice: parseAmount(l.unitPrice) })),
    rawText: rawText.trim() || null,
  };
}

export function ReviewForm({
  initial,
  sourceText,
  aiExtracted,
  onBack,
}: {
  initial: ExtractedInvoice;
  sourceText: string;
  aiExtracted: boolean;
  onBack: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Fields the AI could not find: highlight them so the reviewer knows to look.
  const missing = useMemo(() => {
    if (!aiExtracted) return new Set<string>();
    return new Set(Object.entries(initial).filter(([, v]) => v === null).map(([k]) => k));
  }, [initial, aiExtracted]);

  const set = (name: FieldName) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [name]: e.target.value }));
  const setLine = (id: number, key: keyof Omit<LineState, "id">, value: string) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.id === id ? { ...l, [key]: value } : l)) }));

  // Live consistency hints (same logic as the server-side arithmetic check, simplified).
  const hints = useMemo(() => {
    const out: string[] = [];
    const sub = parseAmount(form.subtotal);
    const vat = parseAmount(form.vatAmount);
    const tot = parseAmount(form.total);
    const cur = /^[A-Za-z]{3}$/.test(form.currency.trim()) ? form.currency.trim().toUpperCase() : "EUR";
    const lines = form.lines.map((l) => ({ q: parseAmount(l.quantity), p: parseAmount(l.unitPrice) }));
    if (sub != null && vat != null && tot != null && ![sub, vat, tot].some(Number.isNaN) && Math.abs(sub + vat - tot) > 0.05) {
      out.push(`Subtotal + VAT = ${formatMoney(sub + vat, cur)}, but total is ${formatMoney(tot, cur)}.`);
    }
    if (sub != null && !Number.isNaN(sub) && lines.length > 0 && lines.every((l) => l.p != null && !Number.isNaN(l.p))) {
      const sum = lines.reduce((s, l) => s + (l.q ?? 1) * l.p!, 0);
      if (Math.abs(sum - sub) > 0.05) out.push(`Lines add up to ${formatMoney(sum, cur)}, but subtotal is ${formatMoney(sub, cur)}.`);
    }
    return out;
  }, [form]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const payload = toPayload(form, sourceText);
    const parsed = invoiceInputSchema.safeParse(payload);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!errs[key]) errs[key] = issue.path.at(-1) === "total" && payload.total === undefined ? "Total is required" : issue.message.replace(/^Invalid input: expected number, received NaN$/, "Not a valid number");
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Saving failed.");
      router.push(`/invoices/${body.id}?new=1`);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Saving failed.");
      setSaving(false);
    }
  }

  const field = (name: FieldName, label: string, opts: { placeholder?: string; mono?: boolean; className?: string; type?: string; inputMode?: "decimal" } = {}) => {
    const err = errors[name];
    const isMissing = missing.has(name) && !form[name];
    return (
      <div className={opts.className}>
        <label htmlFor={name} className="mb-1 block text-xs font-medium text-muted">
          {label}
        </label>
        <input
          id={name}
          type={opts.type ?? "text"}
          inputMode={opts.inputMode}
          value={form[name]}
          onChange={set(name)}
          placeholder={opts.placeholder}
          aria-invalid={!!err}
          className={clsx("field", opts.mono && "font-mono tabular", err && "field-invalid", isMissing && !err && "border-warning/50 bg-warning-soft/40")}
        />
        {err ? (
          <p className="mt-1 text-xs text-problem">{err}</p>
        ) : isMissing ? (
          <p className="mt-1 text-xs text-warning">Not found on the invoice</p>
        ) : null}
      </div>
    );
  };

  return (
    <form onSubmit={submit} noValidate>
      <Steps current={2} />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Review the extracted fields</h1>
          <p className="mt-1 text-muted">
            {aiExtracted
              ? "AI can make mistakes. Compare with the original and correct anything that is off."
              : "Fill in the invoice details."}
          </p>
        </div>
      </div>

      <div className={clsx("mt-6 grid gap-6", sourceText.trim() && "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
        {sourceText.trim() && (
          <aside className="card h-fit overflow-hidden lg:sticky lg:top-6">
            <div className="border-b border-line px-4 py-2.5 text-xs font-medium text-muted">Original invoice text</div>
            <pre className="max-h-[32rem] overflow-auto p-4 font-mono text-[12px] leading-relaxed whitespace-pre text-ink/85 lg:max-h-[calc(100vh-8rem)]">
              {sourceText}
            </pre>
          </aside>
        )}

        <div className="space-y-5">
          <Section title="Supplier">
            <div className="grid gap-3 sm:grid-cols-6">
              {field("supplierName", "Name", { className: "sm:col-span-6" })}
              {field("supplierVatNumber", "VAT number", { mono: true, placeholder: "e.g. DE143454214", className: "sm:col-span-4" })}
              {field("supplierCountry", "Country", { mono: true, placeholder: "DE", className: "sm:col-span-2" })}
            </div>
          </Section>

          <Section title="Invoice">
            <div className="grid gap-3 sm:grid-cols-6">
              {field("invoiceNumber", "Invoice number", { mono: true, className: "sm:col-span-3" })}
              {field("currency", "Currency", { mono: true, placeholder: "EUR", className: "sm:col-span-3" })}
              {field("invoiceDate", "Invoice date", { type: "date", className: "sm:col-span-3" })}
              {field("dueDate", "Due date", { type: "date", className: "sm:col-span-3" })}
            </div>
          </Section>

          <Section title="Line items">
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-1.5 font-medium">Description</th>
                    <th className="w-24 pb-1.5 font-medium">Qty</th>
                    <th className="w-28 pb-1.5 font-medium">Unit price</th>
                    <th className="w-28 pb-1.5 text-right font-medium">Amount</th>
                    <th className="w-9" />
                  </tr>
                </thead>
                <tbody>
                  {form.lines.map((l, i) => {
                    const q = parseAmount(l.quantity);
                    const p = parseAmount(l.unitPrice);
                    const amount = p != null && !Number.isNaN(p) && !Number.isNaN(q ?? 0) ? (q ?? 1) * p : null;
                    return (
                      <tr key={l.id} className="align-top">
                        <td className="py-1 pr-2">
                          <input aria-label={`Line ${i + 1} description`} className={clsx("field", errors[`lines.${i}.description`] && "field-invalid")} value={l.description} onChange={(e) => setLine(l.id, "description", e.target.value)} />
                        </td>
                        <td className="py-1 pr-2">
                          <input aria-label={`Line ${i + 1} quantity`} inputMode="decimal" className={clsx("field font-mono tabular", errors[`lines.${i}.quantity`] && "field-invalid")} value={l.quantity} onChange={(e) => setLine(l.id, "quantity", e.target.value)} />
                        </td>
                        <td className="py-1 pr-2">
                          <input aria-label={`Line ${i + 1} unit price`} inputMode="decimal" className={clsx("field font-mono tabular", errors[`lines.${i}.unitPrice`] && "field-invalid")} value={l.unitPrice} onChange={(e) => setLine(l.id, "unitPrice", e.target.value)} />
                        </td>
                        <td className="py-2.5 pr-2 text-right font-mono tabular text-muted">
                          {amount == null ? "–" : amount.toFixed(2)}
                        </td>
                        <td className="py-1">
                          <button type="button" className="btn-ghost p-2" aria-label={`Remove line ${i + 1}`} onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((x) => x.id !== l.id) }))}>
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" className="btn-ghost mt-1 -ml-2 text-xs" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, { id: nextLineId++, description: "", quantity: "", unitPrice: "" }] }))}>
              <Plus className="size-3.5" /> Add line
            </button>
          </Section>

          <Section title="Amounts">
            <div className="grid gap-3 sm:grid-cols-3">
              {field("subtotal", "Subtotal (excl. VAT)", { mono: true, inputMode: "decimal" })}
              {field("vatAmount", "VAT amount", { mono: true, inputMode: "decimal" })}
              {field("total", "Total (incl. VAT)", { mono: true, inputMode: "decimal" })}
            </div>
            {hints.length > 0 && (
              <div className="mt-3 flex gap-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">
                <TriangleAlert className="size-4 shrink-0" aria-hidden />
                <div>
                  {hints.map((h) => (
                    <p key={h}>{h}</p>
                  ))}
                  <p className="mt-0.5 opacity-80">You can still save; this will show up as a warning.</p>
                </div>
              </div>
            )}
          </Section>

          {serverError && (
            <p role="alert" className="rounded-md border border-problem/25 bg-problem-soft px-3 py-2 text-sm text-problem">
              {serverError}
            </p>
          )}
          {Object.keys(errors).length > 0 && (
            <p role="alert" className="text-sm text-problem">
              Please fix the highlighted fields.
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button type="button" className="btn-ghost -ml-2" onClick={onBack} disabled={saving}>
              <ArrowLeft className="size-4" /> Back
            </button>
            <div className="flex items-center gap-3">
              {saving && <span className="text-xs text-muted">Checking VIES, ECB rates and history…</span>}
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                Run checks & save
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
