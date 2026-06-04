import { FoundationIntegrityPanel } from "@/src/components/fi/FoundationIntegrityPanel";

export default async function FoundationIntegrityPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">Foundation integrity</h1>
      <p className="max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
        Read-only view of how FI events and legacy globals resolve into foundation tables (persons, patients, cases,
        timeline, media). For internal operators only — same deployment access model as other FI Admin pages.
      </p>
      <FoundationIntegrityPanel tenantId={tenantId} />
    </div>
  );
}
