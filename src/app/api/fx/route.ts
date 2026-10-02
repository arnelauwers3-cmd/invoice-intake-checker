import { getEurRate } from "@/lib/fx";

// GET /api/fx?currency=USD&date=2026-09-15 — standalone exchange-rate lookup, useful for testing
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const currency = searchParams.get("currency");
  if (!currency) return Response.json({ error: "currency is required" }, { status: 400 });
  return Response.json(await getEurRate(currency, searchParams.get("date")));
}
