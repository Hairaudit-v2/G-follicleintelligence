import "server-only";

import type { ReceptionOsViewerRole } from "@/src/lib/receptionOs/receptionOsBoardModel";
import {
  applyReceptionOsDemoMode,
  resolveReceptionOsDemoModeFromEnv,
  resolveReceptionOsDemoModeState,
  type ReceptionOsDemoModeState,
} from "@/src/lib/receptionOs/receptionOsDemoModeModel";
import { receptionPilotReviewVisible } from "@/src/lib/receptionOs/receptionPilotReviewModel";
import type { ReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsBoardModel.types";

export function defaultReceptionOsDemoModeState(canToggle: boolean): ReceptionOsDemoModeState {
  return {
    active: false,
    maskAmounts: false,
    usingSampleData: false,
    canToggle,
  };
}

export function resolveReceptionOsDemoModeForViewer(input: {
  viewerRole: ReceptionOsViewerRole;
  demoRequested?: boolean;
}): ReceptionOsDemoModeState {
  const env = resolveReceptionOsDemoModeFromEnv();
  const canToggle = receptionPilotReviewVisible(input.viewerRole);
  return resolveReceptionOsDemoModeState({
    envActive: env.envActive,
    maskAmounts: env.maskAmounts,
    demoRequested: Boolean(input.demoRequested),
    canToggle,
  });
}

export function applyReceptionOsDemoModeForPayload(
  payload: ReceptionOsCommandCentrePayload,
  demoState: ReceptionOsDemoModeState,
): ReceptionOsCommandCentrePayload {
  const withDemoField = {
    ...payload,
    demoMode: demoState.active
      ? demoState
      : defaultReceptionOsDemoModeState(demoState.canToggle),
  };
  if (!demoState.active) return withDemoField;
  return applyReceptionOsDemoMode(withDemoField, demoState);
}
