/**
 * Scheduling workspace: fill the OS main column so the grid owns vertical scroll,
 * not the global app shell.
 */
export default function TenantCalendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="-m-4 flex min-h-0 flex-1 flex-col overflow-hidden sm:-m-6 lg:-m-8">
      {children}
    </div>
  );
}
