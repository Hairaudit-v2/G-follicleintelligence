/**
 * Thin re-export of guided-assist server actions (canonical: fi-onboarding-os-guided-assist-actions).
 */
export {
  dismissGuidedAssistTipAction,
  enableGuidedAssistForAllStaffAction,
  incrementGuidedAssistViews,
  incrementGuidedAssistViewsAction,
  loadGuidedAssistHealthSnapshotAction,
  loadGuidedAssistSettingsStateAction,
  markGuidedAssistWhatsNewSeenAction,
  recordGuidedAssistClientEventAction,
  recordGuidedAssistTipFeedbackAction,
  setGuidedAssistEnabledAction,
  setGuidedAssistForceShowAction,
  setGuidedAssistTenantDefaultsAction,
  snoozeGuidedAssistTipAction,
  touchGuidedAssistEngagementAction,
} from "@/lib/actions/fi-onboarding-os-guided-assist-actions";
