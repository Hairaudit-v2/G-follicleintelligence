"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { parseCrmLeadPreviewSearchParam } from "@/src/lib/crm/crmLeadPreviewQuery";
import { leadTitleFromRow } from "@/src/lib/crm/crmLeadListDisplay";
import type { CrmShellRelatedLeadItem } from "@/src/lib/crm/crmShellLoaders";
import { useCrmLeadSlideOver } from "./LeadSlideOver";

const card = "rounded border border-gray-200 bg-white p-3 shadow-sm";

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
              <p className="mt-1 text-xs text-gray-600">Same person — peek in the slide-over without leaving this page.</p>
            </div>
            <p className="text-xs text-gray-500">
              Tip: share{" "}
              <code className="rounded bg-gray-100 px-1 font-mono text-[10px]">?preview=&lt;lead-id&gt;</code>
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
                    isActive ? "border-blue-300 bg-blue-50/80" : "border-gray-100 bg-gray-50/50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-gray-900">{title}</p>
                    <p className="text-xs text-gray-600">
                      {r.status}
                      {r.stage_label ? ` · ${r.stage_label}` : ""}
                      {" · "}
                      <span className="text-gray-500">updated {new Date(r.updated_at).toLocaleDateString()}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800 shadow-sm hover:bg-gray-50"
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
