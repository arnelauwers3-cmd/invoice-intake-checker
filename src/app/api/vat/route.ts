import { checkVat } from "@/lib/vies";

// GET /api/vat?number=BE0202239951[&country=BE] — standalone VIES check, useful for testing
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  return Response.json(await checkVat(searchParams.get("number"), searchParams.get("country")));
}
