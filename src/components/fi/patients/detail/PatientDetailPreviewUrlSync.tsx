"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { parsePatientPreviewSearchParam } from "@/src/lib/patients/patientPreviewQuery";
import { usePatientSlideOver } from "../PatientSlideOver";

/** Syncs `?preview=<patientId>` with {@link PatientSlideOverProvider} (no UI). */
export function PatientDetailPreviewUrlSync({
  currentPatientId,
  previewPatientId,
}: {
  currentPatientId: string;
  previewPatientId?: string;
}) {
  const { openPatient, close, activePatientId } = usePatientSlideOver();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hadActivePreviewRef = useRef(false);
  const bootstrappedRef = useRef(false);

  const setPreviewQuery = useCallback(
    (previewId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!previewId || previewId === currentPatientId) {
        params.delete("preview");
      } else {
        params.set("preview", previewId);
      }
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [currentPatientId, pathname, router, searchParams]
  );

  const previewFromUrl = useCallback((): string | undefined => {
    return parsePatientPreviewSearchParam(searchParams.get("preview") ?? undefined);
  }, [searchParams]);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    const initial = previewPatientId?.trim();
    if (initial && initial !== currentPatientId) {
      openPatient(initial);
    }
  }, [previewPatientId, currentPatientId, openPatient]);

  useEffect(() => {
    const fromUrl = previewFromUrl();
    if (!fromUrl || fromUrl === currentPatientId) {
      if (activePatientId) close();
      return;
    }
    if (activePatientId !== fromUrl) {
      openPatient(fromUrl);
    }
  }, [previewFromUrl, currentPatientId, openPatient, close, activePatientId]);

  useEffect(() => {
    if (activePatientId) {
      hadActivePreviewRef.current = true;
      return;
    }
    const fromUrl = previewFromUrl();
    if (!fromUrl || !hadActivePreviewRef.current) return;
    hadActivePreviewRef.current = false;
    setPreviewQuery(null);
  }, [activePatientId, previewFromUrl, setPreviewQuery]);

  return null;
}
