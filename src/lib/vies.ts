// VAT number verification against the European Commission's VIES REST API.
// Design rule: we only ever report "invalid" when VIES explicitly says so.
// Timeouts, outages and member-state errors become "unverified".

export type VatStatus = "valid" | "invalid" | "unverified" | "not_applicable";

export interface VatCheckResult {
  status: VatStatus;
  countryCode: string | null;
  vatNumber: string | null; // normalized, without country prefix
  registeredName: string | null;
  registeredAddress: string | null;
  message: string;
  checkedAt: string;
}

// VIES uses EL for Greece and XI for Northern Ireland (goods only).
const VIES_COUNTRIES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR",
  "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO",
  "SE", "SI", "SK", "XI",
]);

const VIES_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api/ms";
const TIMEOUT_MS = 10_000;

/** Map ISO country codes to the code VIES expects. */
export function toViesCountry(code: string): string {
  const upper = code.trim().toUpperCase();
  return upper === "GR" ? "EL" : upper;
}

/**
 * Split a raw VAT string ("BE 0202.239.951", "DE143454214") into country + number.
 * The fallback country is used when the number has no letter prefix.
 */
export function normalizeVat(
  raw: string,
  fallbackCountry?: string | null,
): { countryCode: string | null; vatNumber: string } {
  const compact = raw.replace(/[\s.\-/]/g, "").toUpperCase();
  const prefix = compact.slice(0, 2);
  if (/^[A-Z]{2}$/.test(prefix)) {
    return { countryCode: toViesCountry(prefix), vatNumber: compact.slice(2) };
  }
  return {
    countryCode: fallbackCountry ? toViesCountry(fallbackCountry) : null,
    vatNumber: compact,
  };
}

const clean = (v: unknown) =>
  typeof v === "string" && v.trim() && v.trim() !== "---"
    ? v.replace(/\s+/g, " ").trim()
    : null;

const UNVERIFIED_REASONS: Record<string, string> = {
  MS_UNAVAILABLE: "the member state's VAT database is temporarily unavailable",
  TIMEOUT: "the member state's VAT database did not respond in time",
  MS_MAX_CONCURRENT_REQ: "the member state's VAT database is overloaded",
  GLOBAL_MAX_CONCURRENT_REQ: "VIES is overloaded",
  SERVICE_UNAVAILABLE: "VIES is temporarily unavailable",
};

export async function checkVat(
  rawVat: string | null | undefined,
  fallbackCountry?: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<VatCheckResult> {
  const checkedAt = new Date().toISOString();
  const base = { registeredName: null, registeredAddress: null, checkedAt };

  if (!rawVat || !rawVat.trim()) {
    return {
      ...base,
      status: "not_applicable",
      countryCode: fallbackCountry ? toViesCountry(fallbackCountry) : null,
      vatNumber: null,
      message: "No VAT number on the invoice.",
    };
  }

  const { countryCode, vatNumber } = normalizeVat(rawVat, fallbackCountry);

  if (!countryCode || !VIES_COUNTRIES.has(countryCode)) {
    return {
      ...base,
      status: "not_applicable",
      countryCode,
      vatNumber,
      message: countryCode
        ? `${countryCode} is not an EU member state, so VIES does not apply.`
        : "No country prefix found, so VIES could not be queried.",
    };
  }

  const result = (status: VatStatus, message: string, extra = {}) => ({
    ...base,
    status,
    countryCode,
    vatNumber,
    message,
    ...extra,
  });

  let data: Record<string, unknown>;
  try {
    const res = await fetchImpl(
      `${VIES_URL}/${countryCode}/vat/${encodeURIComponent(vatNumber)}`,
      { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" },
    );
    if (!res.ok) {
      return result("unverified", `Could not be verified: VIES returned HTTP ${res.status}.`);
    }
    data = await res.json();
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return result(
      "unverified",
      timedOut
        ? `Could not be verified: VIES did not respond within ${TIMEOUT_MS / 1000}s.`
        : "Could not be verified: VIES could not be reached.",
    );
  }

  const userError = String(data.userError ?? "");

  if (data.isValid === true) {
    const name = clean(data.name);
    return result(
      "valid",
      name ? `Valid, registered to ${name}.` : "Valid (this member state does not publish the company name).",
      { registeredName: name, registeredAddress: clean(data.address) },
    );
  }
  if (userError === "INVALID") {
    return result("invalid", `VIES reports ${countryCode}${vatNumber} as not registered.`);
  }
  if (userError === "INVALID_INPUT") {
    return result("invalid", `${countryCode}${vatNumber} does not match the VAT number format for ${countryCode}.`);
  }
  const reason = UNVERIFIED_REASONS[userError] ?? `VIES returned "${userError || "an unknown response"}"`;
  return result("unverified", `Could not be verified: ${reason}. Try again later.`);
}
