import { FiSection } from "@/src/components/fi-design/FiSection";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

export function PatientTwinMediaCard({ twin }: { twin: PatientTwinV1 }) {
  const entries = Object.entries(twin.media.by_asset_type).sort((a, b) => b[1].count - a[1].count);
  const empty = entries.length === 0;

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-media-heading"
      title="Media summary"
      description="Counts and latest file per asset type — no storage paths or signed URLs."
    >
      {empty ? (
        <p className="text-sm text-[#94A3B8]">No unified media rows for this patient.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map(([assetType, bucket]) => (
            <li
              key={assetType}
              className="flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium text-white">{assetType}</p>
                <p className="text-xs text-[#64748B]">{bucket.count} file{bucket.count === 1 ? "" : "s"}</p>
              </div>
              <div className="min-w-0 text-right text-xs text-[#94A3B8]">
                {bucket.latest?.file_name ? (
                  <p className="truncate" title={bucket.latest.file_name}>
                    Latest: {bucket.latest.file_name}
                  </p>
                ) : (
                  <p>Latest: —</p>
                )}
                {bucket.latest?.created_at ? (
                  <p className="text-[#64748B]">{new Date(bucket.latest.created_at).toLocaleDateString()}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </FiSection>
  );
}
