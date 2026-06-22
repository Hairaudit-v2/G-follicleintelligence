import {
  publishAnalyticsEvent,
  type AnalyticsEventCoreOptions,
  type PublishAnalyticsEventInput,
} from "./analyticsEventCore";
import type {
  AuditAnalyticsEventType,
  AcademyAnalyticsEventType,
  ConsultationAnalyticsEventType,
  FinancialAnalyticsEventType,
  ImagingAnalyticsEventType,
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

export async function publishImagingEvent(
  input: ModulePublishInput & { eventType: ImagingAnalyticsEventType },
  options?: AnalyticsEventCoreOptions
) {
  return publishAnalyticsEvent({ ...input, moduleName: "imaging_os" }, options);
}

export async function publishAuditEvent(
  input: ModulePublishInput & { eventType: AuditAnalyticsEventType },
  options?: AnalyticsEventCoreOptions
) {
  return publishAnalyticsEvent({ ...input, moduleName: "audit_os" }, options);
}

export async function publishAcademyEvent(
  input: ModulePublishInput & { eventType: AcademyAnalyticsEventType },
  options?: AnalyticsEventCoreOptions
) {
  return publishAnalyticsEvent({ ...input, moduleName: "academy_os" }, options);
}
