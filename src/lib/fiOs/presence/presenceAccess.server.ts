import "server-only";

import { canViewTodaySignalLearning } from "@/src/lib/fiOs/todaySignal/todaySignalLearningAccess.server";

/** D6E — same access gate as Signal Learning (platform + clinic ops admins). */
export async function canViewPresenceIntelligence(tenantId: string): Promise<boolean> {
  return canViewTodaySignalLearning(tenantId);
}
