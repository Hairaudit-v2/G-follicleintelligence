export default function AppointmentsShellLoading() {
  return (
    <div
      className="mx-auto max-w-6xl animate-pulse space-y-6 py-6"
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading appointments"
    >
      <div className="space-y-2">
        <div className="h-6 w-48 rounded bg-gray-200" />
        <div className="h-4 w-full max-w-xl rounded bg-gray-100" />
        <div className="h-4 w-56 rounded bg-gray-100" />
      </div>
      <div className="h-24 rounded border border-gray-200 bg-white shadow-sm" />
      <div className="min-h-[280px] rounded border border-gray-200 bg-white shadow-sm" />
      <div className="h-32 rounded border border-gray-200 bg-white shadow-sm" />
    </div>
  );
}
