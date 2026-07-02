import type { ReceptionBoardQuickAction } from "@/src/lib/receptionBoard/receptionBoardTypes";

export const PROCEDURE_DAY_QUICK_ACTION_ID = "open_procedure_day";

export function appendProcedureDayQuickActionIfEnabled(
  actions: readonly ReceptionBoardQuickAction[],
  base: string,
  enabled: boolean
): ReceptionBoardQuickAction[] {
  if (!enabled) return [...actions];
  const b = base.replace(/\/+$/, "") || "";
  return [
    ...actions,
    {
      id: PROCEDURE_DAY_QUICK_ACTION_ID,
      label: "Open procedure day",
      href: `${b}/procedure-day`,
      description: "Today's surgical schedule and OR checklist.",
    },
  ];
}