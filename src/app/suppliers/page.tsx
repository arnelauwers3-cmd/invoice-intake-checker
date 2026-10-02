import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/format";
import { listSuppliers } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const suppliers = await listSuppliers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Suppliers</h1>
        <p className="mt-1 text-muted">Suppliers are recognised by VAT number, or by name when there is none.</p>
      </div>

      {suppliers.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <Building2 className="size-8 text-faint" aria-hidden />
          <p className="font-medium">No suppliers yet</p>
          <p className="text-sm text-muted">Suppliers appear here after their first invoice is checked.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">Supplier</th>
                <th className="px-3 py-2.5 font-medium">VAT number</th>
                <th className="px-3 py-2.5 text-right font-medium">Invoices</th>
                <th className="px-3 py-2.5 font-medium">Last invoice</th>
                <th className="px-3 py-2.5 text-right font-medium">Flagged</th>
                <th className="px-5 py-2.5 text-right font-medium">Total EUR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {suppliers.map((s) => (
                <tr key={s.id} className="relative hover:bg-paper/60">
                  <td className="px-5 py-3 font-medium">
                    <Link href={`/suppliers/${s.id}`} className="after:absolute after:inset-0">
                      {s.name}
                    </Link>
                    {s.countryCode && <span className="ml-2 font-mono text-xs text-faint">{s.countryCode}</span>}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-muted">{s.vatNumber ?? "–"}</td>
                  <td className="px-3 py-3 text-right font-mono tabular">{s.invoiceCount}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted">{formatDate(s.lastInvoiceDate)}</td>
                  <td className="px-3 py-3 text-right font-mono tabular">
                    {s.openIssues > 0 ? <span className="text-warning">{s.openIssues}</span> : <span className="text-faint">0</span>}
                  </td>
                  <td className="px-5 py-3 text-right font-mono whitespace-nowrap tabular">{formatMoney(s.totalEur, "EUR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
