import { db } from "@/lib/db";
import { demoInvoices } from "@/lib/demo-seed";
import { processInvoice } from "@/lib/intake";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// POST: wipe all data and load the demo history through the normal check pipeline.
export async function POST(req: Request) {
  const limit = rateLimit(`reset:${clientIp(req)}`, 3, 60_000);
  if (!limit.ok) {
    return Response.json({ error: `Please wait ${limit.retryAfterS}s before resetting again.` }, { status: 429 });
  }

  // Deleting suppliers cascades to invoices, lines and checks.
  const { error } = await db().from("suppliers").delete().not("id", "is", null);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  try {
    // Sequential on purpose: later invoices are checked against earlier ones.
    for (const inv of demoInvoices()) await processInvoice(inv);
  } catch (err) {
    console.error("demo seed failed", err);
    return Response.json({ error: "Demo data could not be loaded." }, { status: 500 });
  }
  return Response.json({ ok: true });
}
