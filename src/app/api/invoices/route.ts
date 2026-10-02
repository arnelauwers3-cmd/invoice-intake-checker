import { processInvoice } from "@/lib/intake";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { invoiceInputSchema } from "@/lib/schema";

// POST reviewed invoice → run all checks, save, return the new id
export async function POST(req: Request) {
  const limit = rateLimit(`save:${clientIp(req)}`, 20, 60_000);
  if (!limit.ok) {
    return Response.json({ error: `Too many requests. Try again in ${limit.retryAfterS}s.` }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = invoiceInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Some fields are missing or invalid.", fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const id = await processInvoice(parsed.data);
    return Response.json({ id }, { status: 201 });
  } catch (err) {
    console.error("save failed", err);
    return Response.json({ error: "The invoice could not be saved. Please try again." }, { status: 500 });
  }
}
