import { FileText, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ResetDemoButton } from "@/components/reset-demo-button";
import { StatusBadge, VatBadge } from "@/components/status";
import { formatDate, formatMoney } from "@/lib/format";
import { listInvoices } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const invoices = await listInvoices();
  const problems = invoices.filter((i) => i.overallStatus === "problem").length;
  const warnings = invoices.filter((i) => i.overallStatus === "warning").length;
  const totalEur = invoices.filter((i) => !i.isDuplicate).reduce((s, i) => s + (i.totalEur ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Invoices</h1>
          <p className="mt-1 text-muted">Every invoice with the result of its checks at intake.</p>
        </div>
        <div className="flex gap-2">
          <ResetDemoButton />
          <Link href="/" className="btn-primary">
            <Plus className="size-4" /> New invoice
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Invoices" value={String(invoices.length)} />
        <Stat label="Total in EUR" value={formatMoney(totalEur, "EUR")} hint="excl. duplicates" />
        <Stat label="Problems" value={String(problems)} tone={problems ? "problem" : undefined} />
        <Stat label="Warnings" value={String(warnings)} tone={warnings ? "warning" : undefined} />
      </div>

      {invoices.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <FileText className="size-8 text-faint" aria-hidden />
          <p className="font-medium">No invoices yet</p>
          <p className="max-w-sm text-sm text-muted">
            Check your first invoice, or load the demo data to see how duplicates and price increases are detected.
          </p>
          <div className="mt-2 flex gap-2">
            <ResetDemoButton label="Load demo data" />
            <Link href="/" className="btn-primary">
              New invoice
            </Link>
          </div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Supplier</th>
                <th className="px-3 py-2.5 font-medium">Invoice</th>
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">VAT no.</th>
                <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                <th className="px-5 py-2.5 text-right font-medium">EUR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {invoices.map((inv) => (
                <tr key={inv.id} className="group relative hover:bg-paper/60">
                  <td className="px-5 py-3">
                    <StatusBadge status={inv.overallStatus} />
                  </td>
                  <td className="px-3 py-3 font-medium">
                    <Link href={`/invoices/${inv.id}`} className="after:absolute after:inset-0">
                      {inv.supplierName}
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-muted">{inv.invoiceNumber}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted">{formatDate(inv.invoiceDate)}</td>
                  <td className="px-3 py-3">
                    <VatBadge status={inv.vatStatus} />
                  </td>
                  <td className="px-3 py-3 text-right font-mono whitespace-nowrap tabular">
                    {formatMoney(inv.total, inv.currency)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono whitespace-nowrap text-muted tabular">
                    {formatMoney(inv.totalEur, "EUR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: "problem" | "warning"; hint?: string }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xs text-muted">
        {label} {hint && <span className="text-faint">· {hint}</span>}
      </p>
      <p
        className={`mt-1 font-mono text-xl font-semibold tabular ${tone === "problem" ? "text-problem" : tone === "warning" ? "text-warning" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
