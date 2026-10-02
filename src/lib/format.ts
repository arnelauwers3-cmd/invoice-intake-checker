export function formatMoney(amount: number | null | undefined, currency: string): string {
  if (amount == null) return "–";
  try {
    return new Intl.NumberFormat("en-IE", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

export function formatNumber(n: number | null | undefined, maxDecimals = 4): string {
  if (n == null) return "–";
  return new Intl.NumberFormat("en-IE", { maximumFractionDigits: maxDecimals }).format(n);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}
