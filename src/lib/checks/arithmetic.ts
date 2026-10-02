import type { CheckResult } from "./types";

// Tolerance for rounding differences (e.g. per-line rounding of VAT).
const TOLERANCE = 0.05;

interface Amounts {
  currency: string;
  subtotal: number | null;
  vatAmount: number | null;
  total: number;
  lines: { quantity: number | null; unitPrice: number | null }[];
}

/**
 * Do the numbers on the invoice add up? This catches both supplier errors and
 * extraction mistakes by the AI, without involving the AI.
 */
export function checkArithmetic(inv: Amounts): CheckResult {
  const issues: string[] = [];
  const fmt = (n: number) => `${n.toFixed(2)} ${inv.currency}`;

  if (inv.subtotal != null && inv.vatAmount != null) {
    const expected = inv.subtotal + inv.vatAmount;
    if (Math.abs(expected - inv.total) > TOLERANCE) {
      issues.push(`subtotal + VAT = ${fmt(expected)}, but the total says ${fmt(inv.total)}`);
    }
  }

  const priced = inv.lines.filter((l) => l.unitPrice != null);
  if (inv.subtotal != null && priced.length > 0 && priced.length === inv.lines.length) {
    const linesSum = priced.reduce((s, l) => s + (l.quantity ?? 1) * l.unitPrice!, 0);
    if (Math.abs(linesSum - inv.subtotal) > TOLERANCE) {
      issues.push(`the lines add up to ${fmt(linesSum)}, but the subtotal says ${fmt(inv.subtotal)}`);
    }
  }

  if (issues.length > 0) {
    return {
      type: "arithmetic",
      status: "warning",
      title: "Amounts do not add up",
      message: `${issues.join("; ")}. Check the invoice and the extracted values.`.replace(/^./, (c) => c.toUpperCase()),
    };
  }

  const checkedSomething = (inv.subtotal != null && inv.vatAmount != null) || (inv.subtotal != null && priced.length > 0);
  return {
    type: "arithmetic",
    status: "ok",
    title: "Amounts add up",
    message: checkedSomething
      ? "Line totals, subtotal, VAT and total are consistent."
      : "Not enough amounts on the invoice to cross-check.",
  };
}
