import type { ReactNode } from "react";

export function SystemStatusSection({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-100">{title}</h2>
        {description ? <p className="mt-1 max-w-3xl text-sm text-slate-400">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
