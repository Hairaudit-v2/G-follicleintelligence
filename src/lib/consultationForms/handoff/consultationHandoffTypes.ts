export type ConsultationHandoffBaseInput = {
  tenantId: string;
  consultationId: string;
  formInstanceId: string;
  actorUserId: string | null;
};

export type ConsultationHandoffMutationResult = {
  id: string;
  reused: boolean;
  href: string | null;
  detail?: string;
};

export type ConsultationHandoffState = {
  followUpTask: ConsultationHandoffMutationResult | null;
  quoteDraft: ConsultationHandoffMutationResult | null;
  pathology: ConsultationHandoffMutationResult | null;
  surgeryPlan: ConsultationHandoffMutationResult | null;
};

/** IDs of downstream rows already created for this form instance (server load). */
export type ConsultationHandoffInitialIds = {
  followUpTaskId: string | null;
  quoteId: string | null;
  pathologyRequestId: string | null;
  surgeryPlanId: string | null;
};
