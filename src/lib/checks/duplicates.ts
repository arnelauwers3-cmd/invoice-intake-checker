import { daysBetween, invoiceNumberKey } from "./normalize";
import type { CheckResult, HistoryInvoice } from "./types";

export const DUPLICATE_WINDOW_DAYS = 30;

interface Current {
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  total: number;
}

/**
 * Same supplier + same invoice number            → problem (almost certainly a duplicate)
 * Same supplier + same total within 30 days      → warning (could be a recurring charge)
 * `history` must contain only invoices of the same supplier.
 */
export function checkDuplicates(current: Current, history: HistoryInvoice[]): CheckResult {
  const numberKey = invoiceNumberKey(current.invoiceNumber);

  const sameNumber = history.filter((h) => invoiceNumberKey(h.invoiceNumber) === numberKey);
  if (sameNumber.length > 0) {
    return {
      type: "duplicate",
      status: "problem",
      title: "Possible duplicate invoice",
      message: `Invoice number ${current.invoiceNumber} from this supplier was already recorded (dated ${sameNumber[0].invoiceDate}).`,
      details: { reason: "same_number", matches: sameNumber.map((h) => h.id) },
    };
  }

  const sameAmount = history.filter(
    (h) =>
      h.currency === current.currency &&
      Math.abs(h.total - current.total) < 0.005 &&
      daysBetween(h.invoiceDate, current.invoiceDate) <= DUPLICATE_WINDOW_DAYS,
  );
  if (sameAmount.length > 0) {
    const m = sameAmount[0];
    return {
      type: "duplicate",
      status: "warning",
      title: "Same amount within 30 days",
      message: `Invoice ${m.invoiceNumber} from ${m.invoiceDate} has the same total (${current.total.toFixed(2)} ${current.currency}), ${daysBetween(m.invoiceDate, current.invoiceDate)} days apart. Check that this is not billed twice.`,
      details: { reason: "same_amount", matches: sameAmount.map((h) => h.id) },
    };
  }

  return {
    type: "duplicate",
    status: "ok",
    title: "No duplicate found",
    message:
      history.length === 0
        ? "First invoice from this supplier."
        : `Compared with ${history.length} earlier invoice${history.length === 1 ? "" : "s"} from this supplier.`,
  };
}
