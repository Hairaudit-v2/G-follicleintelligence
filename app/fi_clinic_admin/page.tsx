import { redirectFiOsRoleAliasToFiAdmin } from "@/src/lib/fiOs/fiOsRoleAliasRedirect.server";

export default async function FiClinicAdminEntryAliasPage() {
  await redirectFiOsRoleAliasToFiAdmin("/fi_clinic_admin");
}
