import type { CheckResult, HistoryInvoice } from "./types";

interface CurrentLine {
  descriptionKey: string;
  description: string;
  unitPrice: number | null;
  unitPriceEur: number | null;
}

export interface PriceChange {
  description: string;
  previousInvoiceNumber: string;
  previousDate: string;
  previousPrice: number;
  newPrice: number;
  currency: string; // currency the comparison was made in
  changePct: number;
}

/**
 * For every line, find the most recent earlier invoice from the same supplier
 * that has a line with the same normalized description, and compare unit prices.
 * Same currency → compare as invoiced; different currency → compare in EUR.
 */
export function checkPriceIncreases(
  current: { invoiceDate: string; currency: string; lines: CurrentLine[] },
  history: HistoryInvoice[],
): CheckResult {
  const earlier = history
    .filter((h) => h.invoiceDate <= current.invoiceDate)
    .sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate));

  const increases: PriceChange[] = [];
  let compared = 0;

  for (const line of current.lines) {
    if (line.unitPrice == null || !line.descriptionKey) continue;

    for (const prev of earlier) {
      const match = prev.lines.find((l) => l.descriptionKey === line.descriptionKey);
      if (!match) continue;

      const sameCurrency = prev.currency === current.currency;
      const oldP = sameCurrency ? match.unitPrice : match.unitPriceEur;
      const newP = sameCurrency ? line.unitPrice : line.unitPriceEur;
      if (oldP == null || newP == null) break;

      compared++;
      if (newP - oldP > 0.005) {
        increases.push({
          description: line.description,
          previousInvoiceNumber: prev.invoiceNumber,
          previousDate: prev.invoiceDate,
          previousPrice: oldP,
          newPrice: newP,
          currency: sameCurrency ? current.currency : "EUR",
          changePct: oldP > 0 ? Math.round(((newP - oldP) / oldP) * 1000) / 10 : 100,
        });
      }
      break; // only compare with the most recent occurrence
    }
  }

  if (increases.length > 0) {
    const list = increases
      .map((c) => `"${c.description}" ${c.previousPrice.toFixed(2)} → ${c.newPrice.toFixed(2)} ${c.currency} (+${c.changePct}%)`)
      .join("; ");
    return {
      type: "price_increase",
      status: "warning",
      title: `Price increase on ${increases.length} line${increases.length === 1 ? "" : "s"}`,
      message: `Higher than the previous invoice: ${list}.`,
      details: { increases },
    };
  }

  return {
    type: "price_increase",
    status: "ok",
    title: "No price increases",
    message:
      compared === 0
        ? "No earlier purchases of these items from this supplier to compare with."
        : `${compared} line${compared === 1 ? "" : "s"} compared with earlier invoices; none got more expensive.`,
  };
}
