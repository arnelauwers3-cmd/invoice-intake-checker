"use client";

import clsx from "clsx";
import { ClipboardPaste, FileUp, Loader2, Lock, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { extractPdfText, ScannedPdfError } from "@/lib/pdf";
import { SAMPLES } from "@/lib/samples";
import type { ExtractedInvoice } from "@/lib/schema";
import { emptyInvoice, ReviewForm } from "./review-form";

type Source = { kind: "paste" } | { kind: "pdf"; fileName: string; pages?: number } | { kind: "sample"; label: string };

export function IntakeFlow() {
  const [step, setStep] = useState<"input" | "review">("input");
  const [tab, setTab] = useState<"paste" | "pdf">("paste");
  const [text, setText] = useState("");
  const [source, setSource] = useState<Source>({ kind: "paste" });
  const [busy, setBusy] = useState<null | "pdf" | "extract" | "sample">(null);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedInvoice | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    setBusy("pdf");
    try {
      const pdfText = await extractPdfText(file);
      setText(pdfText);
      setSource({ kind: "pdf", fileName: file.name });
      setTab("paste");
    } catch (err) {
      setError(
        err instanceof ScannedPdfError ? err.message : "This PDF could not be read. It may be damaged or password-protected.",
      );
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function loadSample(file: string) {
    if (!file) return;
    setError(null);
    setBusy("sample");
    try {
      const res = await fetch(`/sample-invoices/${file}`);
      setText(await res.text());
      setSource({ kind: "sample", label: SAMPLES.find((s) => s.file === file)?.label ?? file });
      setTab("paste");
    } finally {
      setBusy(null);
    }
  }

  async function extract() {
    setError(null);
    setBusy("extract");
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Extraction failed.");
      setExtracted(body.invoice);
      setStep("review");
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setBusy(null);
    }
  }

  function enterManually() {
    setExtracted(emptyInvoice());
    setStep("review");
  }

  if (step === "review" && extracted) {
    return (
      <ReviewForm
        initial={extracted}
        sourceText={text}
        aiExtracted={text.trim().length > 0 && extracted.supplierName !== null}
        onBack={() => setStep("input")}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Steps current={1} />

      <h1 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">Check an incoming invoice</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Paste the invoice text or upload a PDF. AI reads the fields, you review them, and then plain code checks the VAT
        number, converts the amount to EUR and compares it with earlier invoices.
      </p>

      <div className="card mt-6 overflow-hidden">
        <div className="flex border-b border-line" role="tablist">
          <TabButton active={tab === "paste"} onClick={() => setTab("paste")} icon={<ClipboardPaste className="size-4" />}>
            Paste text
          </TabButton>
          <TabButton active={tab === "pdf"} onClick={() => setTab("pdf")} icon={<FileUp className="size-4" />}>
            Upload PDF
          </TabButton>
        </div>

        <div className="p-4 sm:p-5">
          {tab === "paste" ? (
            <>
              {source.kind !== "paste" && text && (
                <p className="mb-2 flex items-center gap-1.5 text-xs text-muted">
                  {source.kind === "pdf" ? (
                    <>
                      <Lock className="size-3.5" aria-hidden /> Text extracted in your browser from{" "}
                      <span className="font-medium text-ink">{source.fileName}</span>. Only this text is sent to the AI.
                    </>
                  ) : (
                    <>
                      Sample loaded: <span className="font-medium text-ink">{source.label}</span>
                    </>
                  )}
                </p>
              )}
              <label htmlFor="invoice-text" className="sr-only">
                Invoice text
              </label>
              <textarea
                id="invoice-text"
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (source.kind !== "paste" && !e.target.value) setSource({ kind: "paste" });
                }}
                placeholder="Paste the full text of the invoice here…"
                rows={16}
                spellCheck={false}
                className="field resize-y font-mono text-[13px] leading-relaxed"
              />
            </>
          ) : (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files[0]);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-line-strong px-6 py-14 text-center transition-colors hover:border-accent hover:bg-accent-soft/40"
            >
              {busy === "pdf" ? (
                <Loader2 className="size-8 animate-spin text-accent" aria-hidden />
              ) : (
                <FileUp className="size-8 text-faint" aria-hidden />
              )}
              <span className="font-medium">{busy === "pdf" ? "Reading PDF…" : "Drop a PDF here or click to choose"}</span>
              <span className="max-w-sm text-xs text-muted">
                The text is extracted in your browser; the file itself is never uploaded. PDFs without a text layer
                (scans, photos) are not supported.
              </span>
              <input
                ref={fileInput}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
          )}

          {error && (
            <p role="alert" className="mt-3 rounded-md border border-problem/25 bg-problem-soft px-3 py-2 text-sm text-problem">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <label htmlFor="sample" className="text-xs text-muted">
                Try a sample:
              </label>
              <select
                id="sample"
                className="field w-auto max-w-[16rem] py-1 text-xs"
                value=""
                onChange={(e) => loadSample(e.target.value)}
                disabled={busy !== null}
              >
                <option value="">Choose…</option>
                {SAMPLES.map((s, i) => (
                  <option key={s.file} value={s.file}>
                    {i + 1}. {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" onClick={enterManually} disabled={busy !== null}>
                Enter manually
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={extract}
                disabled={busy !== null || text.trim().length < 30}
              >
                {busy === "extract" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
                {busy === "extract" ? "Reading invoice…" : "Extract fields"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        "flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors sm:flex-none",
        active ? "border-b-2 border-accent text-ink" : "border-b-2 border-transparent text-muted hover:text-ink",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ["Add invoice", "Review fields", "Checks"];
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((label, i) => {
        const n = i + 1;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={clsx(
                "grid size-5 place-items-center rounded-full text-[11px] font-semibold",
                n === current ? "bg-accent text-white" : n < current ? "bg-accent-soft text-accent" : "bg-line text-muted",
              )}
            >
              {n}
            </span>
            <span className={n === current ? "font-medium text-ink" : "text-muted"}>{label}</span>
            {n < steps.length && <span className="mx-1 h-px w-6 bg-line-strong" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
