import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status";
import { formatDate, formatMoney } from "@/lib/format";
import { getSupplier } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: PageProps<"/suppliers/[id]">): Promise<Metadata> {
  const s = await getSupplier((await props.params).id);
  return { title: s?.name ?? "Supplier not found" };
}

export default async function SupplierPage(props: PageProps<"/suppliers/[id]">) {
  const s = await getSupplier((await props.params).id);
  if (!s) notFound();

  const totalEur = s.invoices.filter((i) => !i.isDuplicate).reduce((sum, i) => sum + (i.totalEur ?? 0), 0);
  const tracked = s.priceHistory.filter((p) => p.points.length > 1);
  const once = s.priceHistory.filter((p) => p.points.length === 1);

  return (
    <div className="space-y-6">
      <Link href="/suppliers" className="btn-ghost -ml-2 text-xs">
        <ArrowLeft className="size-3.5" /> All suppliers
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{s.name}</h1>
          <p className="mt-1 font-mono text-sm text-muted">
            {s.vatNumber ?? "No VAT number"} {s.countryCode && <>· {s.countryCode}</>}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">
            {s.invoices.length} invoice{s.invoices.length === 1 ? "" : "s"}
          </p>
          <p className="font-mono text-xl font-semibold tabular">{formatMoney(totalEur, "EUR")}</p>
        </div>
      </div>

      <section className="card overflow-x-auto">
        <h2 className="border-b border-line px-5 py-3 text-sm font-semibold">Invoice history</h2>
        <table className="w-full min-w-[36rem] text-sm">
          <tbody className="divide-y divide-line">
            {s.invoices.map((inv) => (
              <tr key={inv.id} className="relative hover:bg-paper/60">
                <td className="w-28 px-5 py-3">
                  <StatusBadge status={inv.overallStatus} />
                </td>
                <td className="px-3 py-3 font-mono text-xs">
                  <Link href={`/invoices/${inv.id}`} className="after:absolute after:inset-0">
                    {inv.invoiceNumber}
                  </Link>
                  {inv.isDuplicate && <span className="ml-2 font-sans text-faint">duplicate, not counted</span>}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-muted">{formatDate(inv.invoiceDate)}</td>
                <td className="px-3 py-3 text-right font-mono whitespace-nowrap tabular">{formatMoney(inv.total, inv.currency)}</td>
                <td className="px-5 py-3 text-right font-mono whitespace-nowrap text-muted tabular">
                  {inv.currency !== "EUR" ? formatMoney(inv.totalEur, "EUR") : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">Price history</h2>
          <p className="text-xs text-muted">
            Unit prices per item, matched on the normalised description. Duplicates are left out.
          </p>
        </div>
        {tracked.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">
            No item has been bought more than once yet. Price changes show up from the second purchase.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {tracked.map((item) => (
              <div key={item.description} className="px-5 py-4">
                <h3 className="text-sm font-medium">{item.description}</h3>
                <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
                  {item.points.map((p, i) => {
                    const prev = item.points[i - 1];
                    const comparable = prev && prev.currency === p.currency;
                    const pct = comparable && prev.unitPrice > 0 ? ((p.unitPrice - prev.unitPrice) / prev.unitPrice) * 100 : null;
                    return (
                      <li key={`${p.invoiceId}-${i}`} className="flex items-center gap-2">
                        {i > 0 && <span className="text-faint">→</span>}
                        <Link
                          href={`/invoices/${p.invoiceId}`}
                          className={clsx(
                            "rounded-md border px-2 py-1 hover:border-accent",
                            pct != null && pct > 0.05 ? "border-warning/40 bg-warning-soft" : "border-line bg-paper/60",
                          )}
                        >
                          <span className="font-mono font-medium tabular">{formatMoney(p.unitPrice, p.currency)}</span>
                          {pct != null && Math.abs(pct) > 0.05 && (
                            <span className={clsx("ml-1.5 font-mono tabular", pct > 0 ? "text-warning" : "text-ok")}>
                              {pct > 0 ? "+" : ""}
                              {pct.toFixed(1)}%
                            </span>
                          )}
                          <span className="ml-1.5 text-faint">{formatDate(p.date)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </div>
        )}
        {once.length > 0 && (
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            Bought once so far: {once.map((o) => o.description).join(", ")}.
          </p>
        )}
      </section>
    </div>
  );
}
