import { redirect } from "next/navigation";

/**
 * Spec-facing path `/admin/pilot-control`.
 * Tenant-scoped Control Centre lives at `/fi-admin/[tenantId]/pilot-control`
 * with server-side permission enforcement on that page.
 */
export default function AdminPilotControlRedirectPage() {
  redirect("/fi-admin");
}
