export default function CrmShellLoading() {
  return (
    <div
      className="mx-auto max-w-6xl animate-pulse space-y-6 py-6"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading CRM"
    >
      <div className="space-y-2">
        <div className="h-6 w-40 rounded bg-white/[0.08]" />
        <div className="h-4 w-full max-w-xl rounded bg-white/[0.06]" />
        <div className="h-4 w-56 rounded bg-white/[0.06]" />
      </div>
      <div className="h-24 rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40" />
      <div className="min-h-[280px] rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40" />
      <div className="h-32 rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md shadow-lg shadow-black/40" />
    </div>
  );
}
