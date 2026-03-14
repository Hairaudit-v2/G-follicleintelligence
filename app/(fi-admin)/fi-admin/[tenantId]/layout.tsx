import Link from "next/link";

export default async function TenantAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const base = `/fi-admin/${tenantId}`;

  return (
    <div className="space-y-4">
      <nav className="flex gap-4 border-b border-gray-200 pb-2 text-sm">
        <Link href={`${base}/cases`} className="text-gray-600 hover:text-gray-900 underline">
          Cases
        </Link>
        <Link href={`${base}/audit`} className="text-gray-600 hover:text-gray-900 underline">
          Audit queue
        </Link>
      </nav>
      {children}
    </div>
  );
}
