import type {
  OperationalCalendarGridPatch,
  OperationalCalendarPageData,
} from "@/src/lib/calendar/operationalCalendarTypes";

/** Merge streaming grid payload into the fast shell payload (same navigation / tenant). */
export function mergeOperationalCalendarShellAndGrid(
  shell: OperationalCalendarPageData,
  grid: OperationalCalendarGridPatch
): OperationalCalendarPageData {
  return { ...shell, ...grid };
}
