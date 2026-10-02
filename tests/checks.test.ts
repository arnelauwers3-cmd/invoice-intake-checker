import { describe, expect, it } from "vitest";
import { checkArithmetic } from "@/lib/checks/arithmetic";
import { checkDuplicates } from "@/lib/checks/duplicates";
import { invoiceNumberKey, lineKey, supplierNameKey } from "@/lib/checks/normalize";
import { checkPriceIncreases } from "@/lib/checks/price-increase";
import type { HistoryInvoice } from "@/lib/checks/types";
import { worstStatus } from "@/lib/checks/types";
import { normalizeVat } from "@/lib/vies";

const prev: HistoryInvoice = {
  id: "a",
  invoiceNumber: "RE-2026-0412",
  invoiceDate: "2026-07-14",
  currency: "EUR",
  total: 349,
  lines: [
    { descriptionKey: lineKey("Toner HP 59A"), description: "Toner HP 59A", unitPrice: 89.5, unitPriceEur: 89.5 },
    { descriptionKey: lineKey("Copy paper A4"), description: "Copy paper A4", unitPrice: 4.9, unitPriceEur: 4.9 },
  ],
};

describe("normalization", () => {
  it("matches line descriptions regardless of case, punctuation and accents", () => {
    expect(lineKey("  Toner HP-59A ")).toBe(lineKey("toner hp 59a"));
    expect(lineKey("Kopierpapier, A4 (500 Blatt)")).toBe("kopierpapier a4 500 blatt");
    expect(lineKey("Café crème")).toBe("cafe creme");
  });
  it("matches invoice numbers with different separators", () => {
    expect(invoiceNumberKey("RE 2026/0587")).toBe(invoiceNumberKey("re-2026-0587"));
  });
  it("strips legal forms from supplier names", () => {
    expect(supplierNameKey("Bürowelt Schmidt GmbH")).toBe(supplierNameKey("Burowelt Schmidt"));
  });
  it("splits VAT numbers into country and number", () => {
    expect(normalizeVat("BE 0202.239.951")).toEqual({ countryCode: "BE", vatNumber: "0202239951" });
    expect(normalizeVat("094014201", "GR")).toEqual({ countryCode: "EL", vatNumber: "094014201" });
    expect(normalizeVat("GR094014201")).toEqual({ countryCode: "EL", vatNumber: "094014201" });
  });
});

describe("checkDuplicates", () => {
  it("flags the same invoice number as a problem", () => {
    const r = checkDuplicates({ invoiceNumber: "re 2026 0412", invoiceDate: "2026-09-01", currency: "EUR", total: 10 }, [prev]);
    expect(r.status).toBe("problem");
  });
  it("warns on the same total within 30 days", () => {
    const r = checkDuplicates({ invoiceNumber: "X-1", invoiceDate: "2026-08-10", currency: "EUR", total: 349 }, [prev]);
    expect(r.status).toBe("warning");
  });
  it("ignores the same total after more than 30 days", () => {
    const r = checkDuplicates({ invoiceNumber: "X-1", invoiceDate: "2026-08-14", currency: "EUR", total: 349 }, [prev]);
    expect(r.status).toBe("ok");
  });
  it("ignores the same total in a different currency", () => {
    const r = checkDuplicates({ invoiceNumber: "X-1", invoiceDate: "2026-07-20", currency: "USD", total: 349 }, [prev]);
    expect(r.status).toBe("ok");
  });
});

describe("checkPriceIncreases", () => {
  const line = (description: string, unitPrice: number, unitPriceEur = unitPrice) => ({
    description,
    descriptionKey: lineKey(description),
    unitPrice,
    unitPriceEur,
  });

  it("warns when a line got more expensive", () => {
    const r = checkPriceIncreases(
      { invoiceDate: "2026-09-08", currency: "EUR", lines: [line("TONER hp 59a", 97.9), line("Copy paper A4", 4.9)] },
      [prev],
    );
    expect(r.status).toBe("warning");
    const inc = (r.details!.increases as { changePct: number }[])[0];
    expect(inc.changePct).toBe(9.4);
  });
  it("is ok when prices are equal or lower", () => {
    const r = checkPriceIncreases({ invoiceDate: "2026-09-08", currency: "EUR", lines: [line("Toner HP 59A", 85)] }, [prev]);
    expect(r.status).toBe("ok");
  });
  it("only compares with the most recent earlier invoice", () => {
    const newer: HistoryInvoice = { ...prev, id: "b", invoiceDate: "2026-08-20", lines: [line("Toner HP 59A", 99)] };
    const r = checkPriceIncreases({ invoiceDate: "2026-09-08", currency: "EUR", lines: [line("Toner HP 59A", 97.9)] }, [prev, newer]);
    expect(r.status).toBe("ok");
  });
  it("ignores invoices dated after the current one", () => {
    const r = checkPriceIncreases({ invoiceDate: "2026-07-01", currency: "EUR", lines: [line("Toner HP 59A", 120)] }, [prev]);
    expect(r.status).toBe("ok");
  });
  it("compares in EUR when the currency changed", () => {
    const r = checkPriceIncreases(
      { invoiceDate: "2026-09-08", currency: "USD", lines: [line("Toner HP 59A", 100, 87)] },
      [prev],
    );
    expect(r.status).toBe("ok"); // 100 USD looks higher, but 87 EUR < 89.50 EUR
  });
});

describe("checkArithmetic", () => {
  const base = {
    currency: "EUR",
    subtotal: 349,
    vatAmount: 66.31,
    total: 415.31,
    lines: [
      { quantity: 20, unitPrice: 4.9 },
      { quantity: 2, unitPrice: 89.5 },
      { quantity: 30, unitPrice: 2.4 },
    ],
  };
  it("accepts consistent amounts", () => {
    expect(checkArithmetic(base).status).toBe("ok");
  });
  it("warns when subtotal + VAT ≠ total", () => {
    expect(checkArithmetic({ ...base, total: 451.31 }).status).toBe("warning");
  });
  it("warns when the lines do not add up to the subtotal", () => {
    expect(checkArithmetic({ ...base, subtotal: 394, total: 460.31 }).status).toBe("warning");
  });
  it("tolerates small rounding differences", () => {
    expect(checkArithmetic({ ...base, total: 415.33 }).status).toBe("ok");
  });
});

describe("worstStatus", () => {
  it("returns the most severe status", () => {
    expect(worstStatus([{ status: "ok" }, { status: "warning" }])).toBe("warning");
    expect(worstStatus([{ status: "warning" }, { status: "problem" }, { status: "ok" }])).toBe("problem");
    expect(worstStatus([])).toBe("ok");
  });
});
