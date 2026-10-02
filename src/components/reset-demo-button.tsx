"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ResetDemoButton({ label = "Reset demo data" }: { label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reset() {
    if (!confirm("This deletes all invoices and suppliers and loads 3 demo invoices. Continue?")) return;
    setBusy(true);
    const res = await fetch("/api/demo/reset", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body.error ?? "Reset failed.");
      return;
    }
    router.refresh();
  }

  return (
    <button type="button" className="btn-secondary" onClick={reset} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
      {busy ? "Loading…" : label}
    </button>
  );
}
