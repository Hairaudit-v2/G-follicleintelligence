import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy HR OS roster route — redirects to WorkforceOS roster command centre. */
export default async function HrOsRosterRedirectPage({ params, searchParams }: PageProps) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const rawSearch = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(rawSearch)) {
    if (Array.isArray(value)) {
      if (value[0]) qs.set(key, value[0]);
    } else if (value) {
      qs.set(key, value);
    }
  }

  const query = qs.toString();
  redirect(
    query
      ? `/fi-admin/${tenantId.trim()}/workforce-os/roster?${query}`
      : `/fi-admin/${tenantId.trim()}/workforce-os/roster`
  );
}
