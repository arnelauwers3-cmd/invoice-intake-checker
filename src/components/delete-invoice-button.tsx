"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteInvoiceButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Delete this invoice? Its check results are deleted too.")) return;
    setBusy(true);
    const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/invoices");
      router.refresh();
    } else {
      setBusy(false);
      alert("The invoice could not be deleted.");
    }
  }

  return (
    <button type="button" className="btn-danger" onClick={remove} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete
    </button>
  );
}
