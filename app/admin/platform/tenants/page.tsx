import { redirect } from "next/navigation";

/** Alias for operators who expect `/admin/platform/tenants`; enforcement is on `/fi-admin/system/*`. */
export default function AdminPlatformTenantsRedirectPage() {
  redirect("/fi-admin/system/tenants");
}
