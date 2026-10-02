import type { FxResult } from "../fx";
import type { VatCheckResult } from "../vies";
import type { CheckResult } from "./types";

// Turn the results of the external services into check results with a status.

export function vatCheckResult(vat: VatCheckResult): CheckResult {
  const map = {
    valid: ["ok", "VAT number valid"],
    not_applicable: ["ok", "VAT check not applicable"],
    unverified: ["warning", "VAT number could not be verified"],
    invalid: ["problem", "VAT number invalid"],
  } as const;
  const [status, title] = map[vat.status];
  return {
    type: "vat",
    status,
    title,
    message: vat.message,
    details: {
      vatStatus: vat.status,
      countryCode: vat.countryCode,
      vatNumber: vat.vatNumber,
      registeredName: vat.registeredName,
      registeredAddress: vat.registeredAddress,
      checkedAt: vat.checkedAt,
    },
  };
}

export function fxCheckResult(fx: FxResult, total: number, currency: string, totalEur: number | null): CheckResult {
  if (fx.status === "same_currency") {
    return { type: "fx", status: "ok", title: "Invoiced in EUR", message: "No currency conversion needed." };
  }
  if (fx.status === "unavailable") {
    return { type: "fx", status: "warning", title: "No exchange rate", message: `${fx.message} The EUR amount is unknown.` };
  }
  return {
    type: "fx",
    status: "ok",
    title: `Converted to EUR`,
    message: `${total.toFixed(2)} ${currency} = ${totalEur!.toFixed(2)} EUR. ${fx.message}`,
    details: { rate: fx.rate, rateDate: fx.rateDate },
  };
}
