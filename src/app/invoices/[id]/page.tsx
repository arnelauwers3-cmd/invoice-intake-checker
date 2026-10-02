import clsx from "clsx";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Steps } from "@/components/intake/intake-flow";
import { DeleteInvoiceButton } from "@/components/delete-invoice-button";
import { STATUS_META } from "@/components/status";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { getInvoice } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/invoices/[id]">): Promise<Metadata> {
  const inv = await getInvoice((await props.params).id);
  return { title: inv ? `${inv.supplierName} ${inv.invoiceNumber}` : "Invoice not found" };
}

const HEADLINE = {
  ok: "All checks passed",
  warning: "Needs a closer look",
  problem: "Do not pay before resolving",
} as const;

export default async function InvoicePage(props: PageProps<"/invoices/[id]">) {
  const { id } = await props.params;
  const { new: isNew } = await props.searchParams;
  const inv = await getInvoice(id);
  if (!inv) notFound();

  const meta = STATUS_META[inv.overallStatus];
  const Icon = meta.icon;
  const issues = inv.checks.filter((c) => c.status !== "ok");

  return (
    <div className="space-y-6">
      {isNew ? (
        <Steps current={3} />
      ) : (
        <Link href="/invoices" className="btn-ghost -ml-2 text-xs">
          <ArrowLeft className="size-3.5" /> All invoices
        </Link>
      )}

      {/* Verdict */}
      <section className={clsx("rounded-xl border p-5 sm:p-6", meta.soft, meta.border)}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <Icon className={clsx("mt-0.5 size-7 shrink-0", meta.text)} aria-hidden />
            <div>
              <p className={clsx("text-sm font-semibold", meta.text)}>{HEADLINE[inv.overallStatus]}</p>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
                <Link href={`/suppliers/${inv.supplierId}`} className="hover:underline">
                  {inv.supplierName}
                </Link>{" "}
                <span className="font-mono text-xl font-normal text-muted">{inv.invoiceNumber}</span>
              </h1>
              <p className="mt-1 text-sm text-muted">
                {issues.length === 0
                  ? `${inv.checks.length} checks, all OK.`
                  : `${issues.length} of ${inv.checks.length} checks need attention.`}
              </p>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="font-mono text-2xl font-semibold tabular">{formatMoney(inv.total, inv.currency)}</p>
            {inv.currency !== "EUR" && (
              <p className="font-mono text-sm text-muted tabular">≈ {formatMoney(inv.totalEur, "EUR")}</p>
            )}
            <p className="mt-1 text-xs text-muted">Due {formatDate(inv.dueDate)}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        {/* Checks */}
        <section className="card divide-y divide-line">
          <h2 className="px-5 py-3 text-sm font-semibold">Checks</h2>
          {inv.checks.map((c) => {
            const m = STATUS_META[c.status];
            const CIcon = m.icon;
            return (
              <div key={c.type} className="flex gap-3 px-5 py-4">
                <CIcon className={clsx("mt-0.5 size-5 shrink-0", m.text)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h3 className="font-medium">{c.title}</h3>
                    <span className="text-xs text-faint">{CHECK_LABEL[c.type]}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{c.message}</p>
                  {c.type === "price_increase" && Array.isArray(c.details?.increases) && (
                    <PriceIncreaseTable increases={c.details.increases as PriceIncrease[]} />
                  )}
                  {c.type === "duplicate" && Array.isArray(c.details?.matches) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(c.details.matches as string[]).map((mid) => (
                        <Link key={mid} href={`/invoices/${mid}`} className="inline-flex items-center gap-0.5 text-xs font-medium text-accent hover:underline">
                          Open earlier invoice <ChevronRight className="size-3" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* Invoice data */}
        <section className="card h-fit">
          <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">Invoice details</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-5 py-4 text-sm">
            <Row label="Supplier">{inv.supplierName}</Row>
            <Row label="VAT number">
              <span className="font-mono">{inv.supplierVatNumber ?? "–"}</span>
              {inv.viesName && <span className="block text-xs text-muted">VIES: {inv.viesName}</span>}
            </Row>
            <Row label="Country">{inv.supplierCountry ?? "–"}</Row>
            <Row label="Invoice date">{formatDate(inv.invoiceDate)}</Row>
            <Row label="Due date">{formatDate(inv.dueDate)}</Row>
            <Row label="Subtotal">{formatMoney(inv.subtotal, inv.currency)}</Row>
            <Row label="VAT">{formatMoney(inv.vatAmount, inv.currency)}</Row>
            <Row label="Total">
              <span className="font-medium">{formatMoney(inv.total, inv.currency)}</span>
            </Row>
            {inv.currency !== "EUR" && (
              <>
                <Row label="Rate">
                  {inv.fxRate ? (
                    <>
                      1 {inv.currency} = {formatNumber(inv.fxRate, 6)} EUR
                      <span className="block text-xs text-muted">ECB, {formatDate(inv.fxRateDate)}</span>
                    </>
                  ) : (
                    "Unavailable"
                  )}
                </Row>
                <Row label="Total in EUR">{formatMoney(inv.totalEur, "EUR")}</Row>
              </>
            )}
          </dl>
        </section>
      </div>

      {/* Lines */}
      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">Line items</h2>
        {inv.lines.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No line items.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-paper/60 text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Unit price</th>
                  {inv.currency !== "EUR" && <th className="px-3 py-2 text-right font-medium">Unit price EUR</th>}
                  <th className="px-5 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {inv.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-5 py-2.5">{l.description}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular">{formatNumber(l.quantity)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular">{formatMoney(l.unitPrice, inv.currency)}</td>
                    {inv.currency !== "EUR" && (
                      <td className="px-3 py-2.5 text-right font-mono text-muted tabular">{formatMoney(l.unitPriceEur, "EUR")}</td>
                    )}
                    <td className="px-5 py-2.5 text-right font-mono tabular">
                      {l.unitPrice == null ? "–" : formatMoney((l.quantity ?? 1) * l.unitPrice, inv.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {inv.rawText && (
        <details className="card group">
          <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold marker:hidden">
            <span className="inline-flex items-center gap-1">
              <ChevronRight className="size-4 transition-transform group-open:rotate-90" /> Original text
            </span>
          </summary>
          <pre className="max-h-96 overflow-auto border-t border-line p-5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink/85">
            {inv.rawText}
          </pre>
        </details>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-faint">
          Checked {new Date(inv.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Brussels" })}. Results are stored as they were at intake.
        </p>
        <div className="flex gap-2">
          <DeleteInvoiceButton id={inv.id} />
          {isNew && (
            <Link href="/" className="btn-primary">
              Check another invoice
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

const CHECK_LABEL = {
  vat: "VIES",
  fx: "ECB exchange rate",
  duplicate: "History",
  price_increase: "History",
  arithmetic: "Totals",
} as const;

interface PriceIncrease {
  description: string;
  previousInvoiceNumber: string;
  previousDate: string;
  previousPrice: number;
  newPrice: number;
  currency: string;
  changePct: number;
}

function PriceIncreaseTable({ increases }: { increases: PriceIncrease[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-line">
      <table className="w-full text-xs">
        <thead className="bg-paper/60 text-left text-muted">
          <tr>
            <th className="px-3 py-1.5 font-medium">Item</th>
            <th className="px-3 py-1.5 text-right font-medium">Before</th>
            <th className="px-3 py-1.5 text-right font-medium">Now</th>
            <th className="px-3 py-1.5 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {increases.map((p) => (
            <tr key={p.description}>
              <td className="px-3 py-1.5">
                {p.description}
                <span className="block text-faint">
                  vs. {p.previousInvoiceNumber}, {formatDate(p.previousDate)}
                </span>
              </td>
              <td className="px-3 py-1.5 text-right font-mono tabular">{formatMoney(p.previousPrice, p.currency)}</td>
              <td className="px-3 py-1.5 text-right font-mono tabular">{formatMoney(p.newPrice, p.currency)}</td>
              <td className="px-3 py-1.5 text-right font-mono font-medium text-warning tabular">+{p.changePct}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </>
  );
}

