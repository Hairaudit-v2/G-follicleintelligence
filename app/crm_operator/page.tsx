import { redirectFiOsRoleAliasToFiAdmin } from "@/src/lib/fiOs/fiOsRoleAliasRedirect.server";

export default async function CrmOperatorEntryAliasPage() {
  await redirectFiOsRoleAliasToFiAdmin("/crm_operator");
}
