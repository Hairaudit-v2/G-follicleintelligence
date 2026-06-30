"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { parseCrmLeadPreviewSearchParam } from "@/src/lib/crm/crmLeadPreviewQuery";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import type { CrmShellRelatedLeadItem } from "@/src/lib/crm/crmShellLoaders";
import { useCrmLeadSlideOver } from "./LeadSlideOver";

const card = "rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-3 shadow-lg shadow-black/40";

type Props = {
  tenantId: string;
  currentLeadId: string;
  /** Parsed on the server from `searchParams.preview` for the first paint. */
  previewLeadId?: string;
  relatedLeads: CrmShellRelatedLeadItem[];
};

/**
 * Deep-link `?preview=<leadId>` support on the full lead page and a related-leads peek strip.
 * Slide-over payload loads via {@link LeadSlideOverPanel} / `crmLoadLeadSlideOverBundleAction`.
 */
export function CrmLeadDetailPreviewBridge({ tenantId, currentLeadId, previewLeadId, relatedLeads }: Props) {
  const { openLead, close, activeLeadId } = useCrmLeadSlideOver();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hadActivePreviewRef = useRef(false);
  const bootstrappedRef = useRef(false);

  const setPreviewQuery = useCallback(
    (previewId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!previewId || previewId === currentLeadId) {
        params.delete("preview");
      } else {
        params.set("preview", previewId);
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [currentLeadId, pathname, router, searchParams]
  );

  const openPreview = useCallback(
    (leadId: string) => {
      const id = leadId.trim();
      if (!id || id === currentLeadId) return;
      openLead(id);
      setPreviewQuery(id);
    },
    [currentLeadId, openLead, setPreviewQuery]
  );

  const previewFromUrl = useCallback((): string | undefined => {
    return parseCrmLeadPreviewSearchParam(searchParams.get("preview") ?? undefined);
  }, [searchParams]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    const initial = previewLeadId?.trim();
    if (initial && initial !== currentLeadId) {
      openLead(initial);
    }
  }, [previewLeadId, currentLeadId, openLead]);

  useEffect(() => {
    const fromUrl = previewFromUrl();
    if (!fromUrl || fromUrl === currentLeadId) {
      if (activeLeadId) close();
      return;
    }
    if (activeLeadId !== fromUrl) {
      openLead(fromUrl);
    }
  }, [previewFromUrl, currentLeadId, openLead, close, activeLeadId]);

  useEffect(() => {
    if (activeLeadId) {
      hadActivePreviewRef.current = true;
      return;
    }
    const fromUrl = previewFromUrl();
    if (!fromUrl || !hadActivePreviewRef.current) return;
    hadActivePreviewRef.current = false;
    setPreviewQuery(null);
  }, [activeLeadId, previewFromUrl, setPreviewQuery]);

  return (
    <>
      {relatedLeads.length > 0 ? (
        <section className={card} aria-label="Related leads">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Related leads</h2>
              <p className="mt-1 text-xs text-slate-400">Same person — peek in the slide-over without leaving this page.</p>
            </div>
            <p className="text-xs text-gray-500">
              Tip: share{" "}
              <code className="rounded bg-white/[0.06] px-1 font-mono text-[10px]">?preview=&lt;lead-id&gt;</code>
            </p>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {relatedLeads.map((r) => {
              const title = leadTitleFromRow(r.summary, r.id);
              const isActive = activeLeadId === r.id;
              return (
                <li
                  key={r.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm ${
                    isActive ? "border-blue-300 bg-blue-500/10" : "border-white/[0.06] bg-white/[0.03]"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-100">{title}</p>
                    <p className="text-xs text-slate-400">
                      {r.status}
                      {r.stage_label ? ` · ${r.stage_label}` : ""}
                      {" · "}
                      <span className="text-gray-500">updated {new Date(r.updated_at).toLocaleDateString()}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border border-slate-700 bg-[#020617] text-slate-100 placeholder:text-slate-500 px-2 py-1 text-xs font-medium text-slate-200 shadow-sm hover:bg-white/[0.03]"
                      onClick={() => openPreview(r.id)}
                    >
                      Peek
                    </button>
                    <Link
                      href={`/fi-admin/${tenantId}/crm/leads/${r.id}`}
                      className="rounded px-2 py-1 text-xs text-blue-600 hover:underline"
                    >
                      Open full page →
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
