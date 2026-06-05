"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { parseAppointmentPreviewSearchParam } from "@/src/lib/bookings/appointmentPreviewQuery";
import type { AppointmentShellRelatedAppointmentItem } from "@/src/lib/bookings/appointmentSlideOverLoader";
import { useAppointmentSlideOver } from "../AppointmentSlideOver";

const card = "rounded border border-gray-200 bg-white p-3 shadow-sm";

type Props = {
  tenantId: string;
  currentAppointmentId: string;
  previewAppointmentId?: string;
  relatedAppointments: AppointmentShellRelatedAppointmentItem[];
};

/**
 * Deep-link `?preview=<appointmentId>` on the full appointment page and a related-appointments peek strip.
 */
export function AppointmentDetailPreviewBridge({
  tenantId,
  currentAppointmentId,
  previewAppointmentId,
  relatedAppointments,
}: Props) {
  const { openAppointment, close, activeAppointmentId } = useAppointmentSlideOver();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hadActivePreviewRef = useRef(false);
  const bootstrappedRef = useRef(false);

  const setPreviewQuery = useCallback(
    (previewId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!previewId || previewId === currentAppointmentId) {
        params.delete("preview");
      } else {
        params.set("preview", previewId);
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [currentAppointmentId, pathname, router, searchParams]
  );

  const openPreview = useCallback(
    (appointmentId: string) => {
      const id = appointmentId.trim();
      if (!id || id === currentAppointmentId) return;
      openAppointment(id);
      setPreviewQuery(id);
    },
    [currentAppointmentId, openAppointment, setPreviewQuery]
  );

  const previewFromUrl = useCallback((): string | undefined => {
    return parseAppointmentPreviewSearchParam(searchParams.get("preview") ?? undefined);
  }, [searchParams]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    const initial = previewAppointmentId?.trim();
    if (initial && initial !== currentAppointmentId) {
      openAppointment(initial);
    }
  }, [previewAppointmentId, currentAppointmentId, openAppointment]);

  useEffect(() => {
    const fromUrl = previewFromUrl();
    if (!fromUrl || fromUrl === currentAppointmentId) {
      if (activeAppointmentId) close();
      return;
    }
    if (activeAppointmentId !== fromUrl) {
      openAppointment(fromUrl);
    }
  }, [previewFromUrl, currentAppointmentId, openAppointment, close, activeAppointmentId]);

  useEffect(() => {
    if (activeAppointmentId) {
      hadActivePreviewRef.current = true;
      return;
    }
    const fromUrl = previewFromUrl();
    if (!fromUrl || !hadActivePreviewRef.current) return;
    hadActivePreviewRef.current = false;
    setPreviewQuery(null);
  }, [activeAppointmentId, previewFromUrl, setPreviewQuery]);

  if (relatedAppointments.length === 0) return null;

  return (
    <section className={card} aria-label="Related appointments">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Related appointments</h2>
          <p className="mt-1 text-xs text-gray-600">Same lead or patient — peek in the slide-over without leaving this page.</p>
        </div>
        <p className="text-xs text-gray-500">
          Tip: share{" "}
          <code className="rounded bg-gray-100 px-1 font-mono text-[10px]">?preview=&lt;appointment-id&gt;</code>
        </p>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {relatedAppointments.map((r) => {
          const isActive = activeAppointmentId === r.id;
          return (
            <li
              key={r.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-sm ${
                isActive ? "border-blue-300 bg-blue-50/80" : "border-gray-100 bg-gray-50/50"
              }`}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{r.title ?? r.booking_type}</p>
                <p className="text-xs text-gray-600">
                  {r.booking_status} · {r.booking_type}
                  {" · "}
                  <span className="text-gray-500">
                    {new Date(r.start_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                  </span>
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
                  href={`/fi-admin/${tenantId}/appointments/${r.id}`}
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
  );
}
