// Deterministic normalization so that "Toner HP 59A " and "toner hp-59a" match,
// and "RE-2026-0587" matches "RE 2026 0587". Deliberately no fuzzy matching:
// a reviewer must be able to see why two things were considered the same.

export function lineKey(description: string): string {
  return description
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function invoiceNumberKey(invoiceNumber: string): string {
  return invoiceNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function supplierNameKey(name: string): string {
  return lineKey(name)
    .replace(/\b(gmbh|bv|nv|bvba|srl|sarl|sas|sa|ltd|limited|inc|llc|ab|oy|as|aps|sp z o o|spa|ag)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Whole days between two YYYY-MM-DD dates. */
export function daysBetween(a: string, b: string): number {
  const ms = Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`));
  return Math.round(ms / 86_400_000);
}
