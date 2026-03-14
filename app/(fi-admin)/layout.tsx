import Link from "next/link";

export default function FiAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans">
      <header className="mb-6 border-b border-gray-200 pb-4 flex items-center gap-4">
        <Link href="/" className="text-sm text-gray-500 hover:underline">← Home</Link>
        <h1 className="text-lg font-semibold text-gray-900">FI Admin</h1>
        <p className="text-sm text-gray-500">Internal admin only</p>
      </header>
      {children}
    </div>
  );
}
