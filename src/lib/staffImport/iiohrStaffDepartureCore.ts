import {
  OFFBOARDING_CENTRE_EMPLOYMENT_STATUSES,
  type StaffEmploymentStatus,
} from "@/src/lib/workforce-os/staffLifecycleTypes";
import { parseStaffEmploymentStatus } from "@/src/lib/workforce-os/staffLifecycleCore";

/** Maps IIOHR HR feed `employment_status` to FI workforce employment status. */
export function mapHrEmploymentToFiDepartureStatus(
  hrStatus: string | null | undefined
): StaffEmploymentStatus | null {
  const s = String(hrStatus ?? "")
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (s === "terminated") return "terminated";
  if (s === "resigned") return "resigned";
  if (s === "contract_ended" || s === "contract ended" || s === "contract_expired") {
    return "contract_ended";
  }
  if (s === "inactive") return "inactive";
  return null;
}

export function isIiohrFullOffboardHrStatus(hrStatus: string | null | undefined): boolean {
  const mapped = mapHrEmploymentToFiDepartureStatus(hrStatus);
  return (
    mapped === "terminated" || mapped === "resigned" || mapped === "contract_ended"
  );
}

export function isAlreadyOffboardedEmploymentStatus(status: string | null | undefined): boolean {
  const parsed = parseStaffEmploymentStatus(status ?? "active");
  return OFFBOARDING_CENTRE_EMPLOYMENT_STATUSES.has(parsed);
}

export type IiohrDepartureAlignmentKind = "full_offboard" | "deactivate_only" | "none";

/** Determines how an IIOHR HR employment status should align FI workforce state. */
export function resolveIiohrDepartureAlignmentKind(
  hrStatus: string | null | undefined
): IiohrDepartureAlignmentKind {
  if (isIiohrFullOffboardHrStatus(hrStatus)) return "full_offboard";
  if (mapHrEmploymentToFiDepartureStatus(hrStatus) === "inactive") return "deactivate_only";
  return "none";
}
