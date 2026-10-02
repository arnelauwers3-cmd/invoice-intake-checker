// Live smoke test for the FX client: npx tsx scripts/smoke-fx.mts
import { getEurRate, toEur } from "../src/lib/fx";

const cases: [string, string | null][] = [
  ["EUR", "2026-09-15"],
  ["USD", "2026-09-15"], // weekday
  ["USD", "2026-09-26"], // Saturday → Friday's rate
  ["GBP", "2026-08-03"],
  ["PLN", "2026-07-10"],
  ["SEK", "2027-01-01"], // future date → latest
  ["XYZ", "2026-09-15"], // unknown currency
];

for (const [cur, date] of cases) {
  const r = await getEurRate(cur, date);
  console.log(`${cur} ${date} → ${r.status.padEnd(14)} 1000 ${cur} = ${toEur(1000, r.rate) ?? "–"} EUR | ${r.message}`);
}
