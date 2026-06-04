import { FoundationIntegrityPanel } from "@/src/components/fi/FoundationIntegrityPanel";

export default async function FoundationIntegrityPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <div className="space-y-4">
      <h2 className="text-base font-medium text-gray-900">Foundation integrity</h2>
      <p className="text-xs text-gray-600 max-w-3xl">
        Read-only view of how FI events and legacy globals resolve into foundation tables (persons, patients, cases,
        timeline, media). For internal operators only — same deployment access model as other FI Admin pages.
      </p>
      <FoundationIntegrityPanel tenantId={tenantId} />
    </div>
  );
}
