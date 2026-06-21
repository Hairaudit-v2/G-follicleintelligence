import {
  publishAnalyticsEvent,
  type AnalyticsEventCoreOptions,
  type PublishAnalyticsEventInput,
} from "./analyticsEventCore";
import type {
  ConsultationAnalyticsEventType,
  FinancialAnalyticsEventType,
  LeadFlowAnalyticsEventType,
  PatientAnalyticsEventType,
  SurgeryAnalyticsEventType,
  WorkforceAnalyticsEventType,
} from "./analyticsEventTypes";

type ModulePublishInput = Omit<PublishAnalyticsEventInput, "moduleName">;

export async function publishWorkforceEvent(
  input: ModulePublishInput & { eventType: WorkforceAnalyticsEventType },
  options?: AnalyticsEventCoreOptions
) {
  return publishAnalyticsEvent({ ...input, moduleName: "workforce_os" }, options);
}

export async function publishSurgeryEvent(
  input: ModulePublishInput & { eventType: SurgeryAnalyticsEventType },
  options?: AnalyticsEventCoreOptions
) {
  return publishAnalyticsEvent({ ...input, moduleName: "surgery_os" }, options);
}

export async function publishFinancialEvent(
  input: ModulePublishInput & { eventType: FinancialAnalyticsEventType },
  options?: AnalyticsEventCoreOptions
) {
  return publishAnalyticsEvent({ ...input, moduleName: "financial_os" }, options);
}

export async function publishConsultationEvent(
  input: ModulePublishInput & { eventType: ConsultationAnalyticsEventType },
  options?: AnalyticsEventCoreOptions
) {
  return publishAnalyticsEvent({ ...input, moduleName: "consultation_os" }, options);
}

export async function publishLeadFlowEvent(
  input: ModulePublishInput & { eventType: LeadFlowAnalyticsEventType },
  options?: AnalyticsEventCoreOptions
) {
  return publishAnalyticsEvent({ ...input, moduleName: "leadflow" }, options);
}

export async function publishPatientEvent(
  input: ModulePublishInput & { eventType: PatientAnalyticsEventType },
  options?: AnalyticsEventCoreOptions
) {
  return publishAnalyticsEvent({ ...input, moduleName: "patient_os" }, options);
}
