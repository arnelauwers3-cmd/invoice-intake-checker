import clsx from "clsx";
import { CircleAlert, CircleCheck, CircleX, type LucideIcon } from "lucide-react";
import type { CheckStatus } from "@/lib/schema";
import type { VatStatus } from "@/lib/vies";

export const STATUS_META: Record<CheckStatus, { label: string; icon: LucideIcon; text: string; soft: string; border: string }> = {
  ok: { label: "OK", icon: CircleCheck, text: "text-ok", soft: "bg-ok-soft", border: "border-ok/25" },
  warning: { label: "Warning", icon: CircleAlert, text: "text-warning", soft: "bg-warning-soft", border: "border-warning/25" },
  problem: { label: "Problem", icon: CircleX, text: "text-problem", soft: "bg-problem-soft", border: "border-problem/25" },
};

export function StatusBadge({ status, className }: { status: CheckStatus; className?: string }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        m.soft,
        m.text,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {m.label}
    </span>
  );
}

const VAT_META: Record<VatStatus, { label: string; status: CheckStatus | "neutral" }> = {
  valid: { label: "Valid", status: "ok" },
  invalid: { label: "Invalid", status: "problem" },
  unverified: { label: "Not verified", status: "warning" },
  not_applicable: { label: "n/a", status: "neutral" },
};

export function VatBadge({ status }: { status: VatStatus }) {
  const m = VAT_META[status];
  return (
    <span
      className={clsx(
        "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
        m.status === "neutral" ? "bg-paper text-muted" : [STATUS_META[m.status].soft, STATUS_META[m.status].text],
      )}
    >
      {m.label}
    </span>
  );
}
