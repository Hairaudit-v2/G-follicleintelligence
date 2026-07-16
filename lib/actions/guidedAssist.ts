/**
 * Thin re-export of guided-assist server actions (canonical: fi-onboarding-os-guided-assist-actions).
 */
export {
  dismissGuidedAssistTipAction,
  enableGuidedAssistForAllStaffAction,
  exportGuidedAssistHealthCsvAction,
  incrementGuidedAssistViews,
  incrementGuidedAssistViewsAction,
  loadGuidedAssistHealthSnapshotAction,
  loadGuidedAssistRolloutSnapshotAction,
  loadGuidedAssistSettingsStateAction,
  markGuidedAssistWhatsNewSeenAction,
  recordGuidedAssistClientEventAction,
  recordGuidedAssistTipFeedbackAction,
  setGuidedAssistEnabledAction,
  setGuidedAssistForceShowAction,
  setGuidedAssistRolloutItemAction,
  setGuidedAssistTenantDefaultsAction,
  snoozeGuidedAssistTipAction,
  touchGuidedAssistEngagementAction,
} from "@/lib/actions/fi-onboarding-os-guided-assist-actions";
