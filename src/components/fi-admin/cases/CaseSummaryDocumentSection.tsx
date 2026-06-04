import type { ReactNode } from "react";

export function CaseSummaryDocumentSection({
  title,
  id,
  children,
}: {
  title: string;
  /** Optional anchor for in-page navigation. */
  id?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="break-inside-avoid border-b border-gray-200 pb-6 print:border-gray-800 print:pb-4">
      <h2 className="mb-3 text-base font-semibold text-gray-900 print:text-black">{title}</h2>
      <div className="space-y-3 text-sm text-gray-800 print:text-black">{children}</div>
    </section>
  );
}
