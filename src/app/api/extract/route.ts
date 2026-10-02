import { ExtractionError, extractInvoice, MAX_INPUT_CHARS } from "@/lib/gemini";
import { clientIp, rateLimit } from "@/lib/rate-limit";

// POST { text } → extracted invoice fields (a suggestion; nothing is saved here)
export async function POST(req: Request) {
  const limit = rateLimit(`extract:${clientIp(req)}`, 10, 60_000);
  if (!limit.ok) {
    return Response.json(
      { error: `Too many extractions. Try again in ${limit.retryAfterS}s.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterS) } },
    );
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text.length < 30) {
    return Response.json({ error: "Paste the full invoice text (at least a few lines)." }, { status: 400 });
  }
  if (text.length > MAX_INPUT_CHARS) {
    return Response.json({ error: `Invoice text is too long (max ${MAX_INPUT_CHARS.toLocaleString("en")} characters).` }, { status: 413 });
  }

  try {
    const invoice = await extractInvoice(text);
    return Response.json({ invoice });
  } catch (err) {
    console.error("extract failed", err);
    const quota = err instanceof Error && /429|RESOURCE_EXHAUSTED|quota/i.test(err.message);
    const message = quota
      ? "The AI quota of this demo is used up for now. Try again in a minute, or fill in the fields manually."
      : err instanceof ExtractionError
        ? err.message
        : "The AI extraction failed. Try again, or fill in the fields manually.";
    return Response.json({ error: message }, { status: quota ? 429 : 502 });
  }
}
