/** ClinicOS calendar QA dashboard (Stage Calendar 2C). */

export type CalendarQaStatus = "ready" | "warning" | "failed" | "not_tested";

export type CalendarQaRow = {
  id: string;
  title: string;
  description?: string;
  status: CalendarQaStatus;
  detail?: string;
};

export type CalendarQaSection = {
  id: string;
  title: string;
  description?: string;
  rows: CalendarQaRow[];
};

export type CalendarTestingPagePayload = {
  tenantId: string;
  sections: CalendarQaSection[];
};
