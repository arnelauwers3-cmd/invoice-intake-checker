// Sample invoices in /public/sample-invoices, used for demos.
export const SAMPLES = [
  { file: "01-de-office-supplies.txt", label: "German office supplies (EUR, valid VAT)" },
  { file: "02-de-office-supplies-price-increase.txt", label: "Same supplier, two months later (price increase)" },
  { file: "03-de-duplicate-reminder.txt", label: "Payment reminder for an invoice already received (duplicate)" },
  { file: "04-us-saas-usd.txt", label: "US software subscription (USD)" },
  { file: "05-uk-design-gbp.txt", label: "UK design studio (GBP, outside VIES)" },
  { file: "06-pl-print-invalid-vat.txt", label: "Polish print shop (PLN, invalid VAT number)" },
  { file: "07-ch-translation-totals-mismatch.txt", label: "Swiss translator (CHF, totals don't add up)" },
  { file: "08-us-saas-double-charge.txt", label: "US subscription billed twice (same amount)" },
] as const;
