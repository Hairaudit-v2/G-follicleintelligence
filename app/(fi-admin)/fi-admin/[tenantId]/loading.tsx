import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";

export default function FiAdminTenantHomeLoading() {
  return (
    <div
      className="space-y-8 pb-14 animate-pulse sm:space-y-10 sm:pb-16"
      aria-busy="true"
      aria-live="polite"
    >
      <DashboardCard elevated className="h-48 p-6 sm:h-52 sm:p-8" />
      <DashboardCard className="h-72 p-6" />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DashboardCard className="h-64 p-6" />
        <DashboardCard className="h-64 p-6" />
      </div>
      <DashboardCard className="h-40 p-6" />
      <DashboardCard className="h-32 p-6" />
    </div>
  );
}
