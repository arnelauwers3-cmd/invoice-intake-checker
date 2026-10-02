import type { CheckStatus } from "../schema";

export type CheckType = "vat" | "fx" | "duplicate" | "price_increase" | "arithmetic";

export interface CheckResult {
  type: CheckType;
  status: CheckStatus;
  title: string;
  message: string;
  details?: Record<string, unknown>;
}

/** A previously saved invoice of the same supplier, as loaded from the database. */
export interface HistoryInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  currency: string;
  total: number;
  lines: HistoryLine[];
}

export interface HistoryLine {
  descriptionKey: string;
  description: string;
  unitPrice: number | null;
  unitPriceEur: number | null;
}

const RANK: Record<CheckStatus, number> = { ok: 0, warning: 1, problem: 2 };

export function worstStatus(results: { status: CheckStatus }[]): CheckStatus {
  return results.reduce<CheckStatus>(
    (worst, r) => (RANK[r.status] > RANK[worst] ? r.status : worst),
    "ok",
  );
}
