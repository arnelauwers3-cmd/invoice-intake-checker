// Live smoke test for Gemini extraction: npx tsx --conditions=react-server scripts/smoke-gemini.mts [file ...]
// (the react-server condition lets us import a module guarded by "server-only")
import { config } from "dotenv";
import { readFileSync } from "node:fs";

config({ path: ".env.local" });
const { extractInvoice } = await import("../src/lib/gemini");

const files = process.argv.slice(2);
if (files.length === 0) files.push("public/sample-invoices/01-de-office-supplies.txt");

for (const file of files) {
  const started = Date.now();
  try {
    const inv = await extractInvoice(readFileSync(file, "utf8"));
    console.log(`\n=== ${file} (${Date.now() - started} ms)`);
    console.log(JSON.stringify(inv, null, 2));
  } catch (err) {
    console.log(`\n=== ${file} FAILED:`, err instanceof Error ? err.message : err);
  }
}
