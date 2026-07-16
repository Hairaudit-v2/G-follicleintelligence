import { permanentRedirect } from "next/navigation";

/** Legacy nested path — canonical public route is `/migrate-from-hubspot`. */
export default function PlatformMigrateFromHubspotRedirect() {
  permanentRedirect("/migrate-from-hubspot");
}
