// Currency conversion to EUR using ECB reference rates via the Frankfurter API.
// The rate is taken on the invoice date; on weekends and holidays the ECB has no
// fixing, so Frankfurter returns the last business day before it. We store and
// show that actual rate date so the conversion stays auditable.

export interface FxResult {
  status: "ok" | "same_currency" | "unavailable";
  rate: number | null; // 1 unit of `currency` = rate EUR
  rateDate: string | null;
  message: string;
}

const FX_URL = "https://api.frankfurter.dev/v1";
const TIMEOUT_MS = 8_000;

export const roundMoney = (n: number) => Math.round(n * 100) / 100;

export function toEur(amount: number | null, rate: number | null): number | null {
  if (amount == null || rate == null) return null;
  return roundMoney(amount * rate);
}

async function fetchRate(path: string, currency: string, fetchImpl: typeof fetch) {
  const res = await fetchImpl(`${FX_URL}/${path}?base=${currency}&symbols=EUR`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { date: string; rates: { EUR?: number } };
  if (typeof data.rates?.EUR !== "number") return null;
  return { rate: data.rates.EUR, rateDate: data.date };
}

export async function getEurRate(
  currency: string,
  invoiceDate: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<FxResult> {
  const cur = currency.trim().toUpperCase();
  if (cur === "EUR") {
    return { status: "same_currency", rate: 1, rateDate: invoiceDate, message: "Invoice is already in EUR." };
  }
  if (!/^[A-Z]{3}$/.test(cur)) {
    return { status: "unavailable", rate: null, rateDate: null, message: `"${currency}" is not a valid currency code.` };
  }

  const today = new Date().toISOString().slice(0, 10);
  const useLatest = !invoiceDate || invoiceDate > today;

  try {
    const hit = await fetchRate(useLatest ? "latest" : invoiceDate, cur, fetchImpl);
    if (!hit) {
      return { status: "unavailable", rate: null, rateDate: null, message: `The ECB publishes no EUR rate for ${cur}.` };
    }
    const note = !invoiceDate
      ? " (no invoice date, so the latest rate was used)"
      : useLatest
        ? " (invoice date is in the future, so the latest rate was used)"
        : hit.rateDate !== invoiceDate
          ? ` (no ECB fixing on ${invoiceDate}, so the previous business day was used)`
          : "";
    return {
      status: "ok",
      rate: hit.rate,
      rateDate: hit.rateDate,
      message: `1 ${cur} = ${hit.rate} EUR, ECB rate of ${hit.rateDate}${note}.`,
    };
  } catch {
    return { status: "unavailable", rate: null, rateDate: null, message: "Exchange rate service could not be reached." };
  }
}
