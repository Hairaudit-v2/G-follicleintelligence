/**
 * Full-bleed scheduling workspace: cancel the tenant card inner padding so the grid can use the whole OS panel.
 */
export default function TenantCalendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-m-4 flex min-h-[calc(100dvh-10.5rem)] flex-1 flex-col sm:-m-6 lg:-m-8">{children}</div>
  );
}
