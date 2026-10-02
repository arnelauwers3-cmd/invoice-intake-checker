// Live smoke test for the VIES client: npx tsx scripts/smoke-vies.mts
import { checkVat } from "../src/lib/vies";

const cases: [string, string | null][] = [
  ["BE 0202.239.951", null], // valid, name published
  ["DE143454214", null], // valid, Germany hides the name
  ["PL1234567890", null], // invalid
  ["094014201", "GR"], // Greece: GR must become EL
  ["GB123456789", null], // UK: not applicable since Brexit
  ["", "DE"], // no VAT number
];

// Simulated outage: fetch that never answers within the timeout
const hangingFetch: typeof fetch = (_url, init) =>
  new Promise((_, reject) =>
    init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)),
  );

for (const [vat, country] of cases) {
  const r = await checkVat(vat, country);
  console.log(`${(vat || "(empty)").padEnd(18)} → ${r.status.padEnd(14)} ${r.message}`);
}

const offline = await checkVat("BE0202239951", null, () => Promise.reject(new TypeError("fetch failed")));
console.log(`${"offline".padEnd(18)} → ${offline.status.padEnd(14)} ${offline.message}`);

console.log("(waiting 10s for simulated timeout…)");
const keepAlive = setInterval(() => {}, 1000);
const slow = await checkVat("BE0202239951", null, hangingFetch);
console.log(`${"timeout".padEnd(18)} → ${slow.status.padEnd(14)} ${slow.message}`);
clearInterval(keepAlive);
