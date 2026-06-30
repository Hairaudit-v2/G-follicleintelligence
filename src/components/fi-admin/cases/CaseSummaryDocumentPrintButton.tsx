"use client";

export function CaseSummaryDocumentPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-3 py-1.5 text-sm font-medium text-slate-200 shadow-sm hover:bg-white/[0.03] print:hidden"
    >
      Print
    </button>
  );
}
