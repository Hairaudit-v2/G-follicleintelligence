"use client";

export function CaseSummaryDocumentPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 print:hidden"
    >
      Print
    </button>
  );
}
