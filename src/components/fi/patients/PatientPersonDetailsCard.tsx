import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";

function metadataKeySummary(meta: Record<string, unknown>): string {
  const keys = Object.keys(meta).filter((k) => !k.startsWith("_"));
  if (keys.length === 0) return "No keys";
  const preview = keys.slice(0, 10).join(", ");
  return keys.length > 10 ? `${preview}, …` : preview;
}

export function PatientPersonDetailsCard({ data }: { data: PatientProfileFoundationData }) {
  const { name, email, phone } = displayFromPersonMetadata(data.person.metadata);
  const dob = data.person.metadata.date_of_birth;
  const addr = data.person.metadata.address;
  const dobStr = typeof dob === "string" ? dob : null;
  const addrStr = typeof addr === "string" ? addr : null;

  return (
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Person details</h2>
      <dl className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-gray-500">Name</dt>
          <dd>{name}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Email</dt>
          <dd>{email ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Phone</dt>
          <dd>{phone ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Date of birth</dt>
          <dd>{dobStr ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-gray-500">Address</dt>
          <dd>{addrStr ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-gray-500">Metadata (keys only)</dt>
          <dd className="break-words font-mono text-xs text-gray-600">{metadataKeySummary(data.person.metadata)}</dd>
        </div>
      </dl>
    </section>
  );
}
