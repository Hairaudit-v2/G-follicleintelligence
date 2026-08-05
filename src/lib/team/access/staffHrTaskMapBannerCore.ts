/**
 * Contextual HR Task Map entry banners — pure presets and href builders.
 */

import {
  STAFF_HR_TASK_CATEGORY_LABELS,
  type StaffHrTaskCategory,
} from "@/src/lib/team/access/staffHrTaskMapCore";
import { buildStaffHrTaskMapHref } from "@/src/lib/workforce/staffLifecycleCopy";

export type StaffHrTaskMapBannerSurface =
  | "staff_profile"
  | "standard_hours"
  | "roster_command_centre"
  | "staff_access"
  | "onboarding";

export type StaffHrTaskMapBannerPreset = {
  surface: StaffHrTaskMapBannerSurface;
  message: string;
  linkLabel: string;
  category?: StaffHrTaskCategory;
  taskId?: string;
};

export const STAFF_HR_TASK_MAP_BANNER_PRESETS: Record<
  StaffHrTaskMapBannerSurface,
  StaffHrTaskMapBannerPreset
> = {
  staff_profile: {
    surface: "staff_profile",
    message:
      "Not sure which HR action to take for this staff member? The HR Task Map shows employment, leave, access, roster, and offboarding tasks in one place.",
    linkLabel: "Open staff HR tasks",
    category: "employment",
  },
  standard_hours: {
    surface: "standard_hours",
    message:
      "Standard hours are one step in the roster workflow. See related tasks for generation, leave periods, and restoring roster eligibility.",
    linkLabel: "View roster HR tasks",
    category: "roster",
    taskId: "set_standard_hours",
  },
  roster_command_centre: {
    surface: "roster_command_centre",
    message:
      "Roster work spans standard hours, leave blocks, shift review, and re-enabling staff. Use the HR Task Map when roster actions feel scattered.",
    linkLabel: "Open roster HR tasks",
    category: "roster",
  },
  staff_access: {
    surface: "staff_access",
    message:
      "Login invites, PIN setup, suspension, and permissions are separate HR tasks. The Task Map explains what each access action changes.",
    linkLabel: "View access HR tasks",
    category: "access",
    taskId: "provision_staff_access",
  },
  onboarding: {
    surface: "onboarding",
    message:
      "New hire setup continues in Staff Access, training, and roster configuration. The HR Task Map links each onboarding follow-up step.",
    linkLabel: "Open onboarding HR tasks",
    category: "onboarding",
    taskId: "add_new_staff",
  },
};

export function resolveStaffHrTaskMapBanner(
  surface: StaffHrTaskMapBannerSurface
): StaffHrTaskMapBannerPreset {
  return STAFF_HR_TASK_MAP_BANNER_PRESETS[surface];
}

export function buildStaffHrTaskMapBannerHref(
  tenantId: string,
  surface: StaffHrTaskMapBannerSurface,
  staffId?: string
): string {
  const preset = resolveStaffHrTaskMapBanner(surface);
  return buildStaffHrTaskMapHref(tenantId, {
    staffId,
    category: preset.category,
    taskId: preset.taskId,
  });
}

export function parseStaffHrTaskMapCategoryParam(
  value: string | null | undefined
): StaffHrTaskCategory | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw in STAFF_HR_TASK_CATEGORY_LABELS) {
    return raw as StaffHrTaskCategory;
  }
  return null;
}
