"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { StartCaptureProtocolButton } from "@/src/components/fi/vie/StartCaptureProtocolButton";
import { PatientImagingCompletenessSummary } from "@/src/components/fi/vie/PatientImagingCompletenessSummary";

export function PatientImageUploadForm({
  tenantId,
  patientId,
  data,
  canCapture = true,
}: {
  tenantId: string;
  patientId: string;
  data: PatientProfileFoundationData;
  canCapture?: boolean;
}) {
  const router = useRouter();

  return (
    <div className="rounded-lg border border-cyan-100 bg-cyan-50/40 p-4">
      <h3 className="text-sm font-semibold text-gray-900">Protocol-driven capture</h3>
      <p className="mt-1 text-xs text-gray-600">
        Generic image upload is disabled. All clinical photography must follow a Visual Intelligence Engine protocol so
        views, quality checks, and Patient Twin sync stay consistent.
      </p>
      <div className="mt-3">
        <PatientImagingCompletenessSummary completeness={data.vieImagingCompleteness} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <StartCaptureProtocolButton
          tenantId={tenantId}
          patientId={patientId}
          canCapture={canCapture}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-semibold text-white hover:bg-gray-800"
        />
        <Link
          href={`/fi-admin/${tenantId}/patients/${patientId}/imaging?tab=capture`}
          className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-900 hover:bg-gray-50"
          onClick={() => router.refresh()}
        >
          Open ImagingOS capture
        </Link>
      </div>
    </div>
  );
}
