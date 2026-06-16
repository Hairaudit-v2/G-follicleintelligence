/**
 * Expected HubSpot contacts export columns (header row).
 * Matching is case-insensitive with trim.
 */

export const HUBSPOT_CONTACT_CSV_HEADERS = [
  "Record ID",
  "First Name",
  "Last Name",
  "Email",
  "Phone Number",
  "Contact owner",
  "Lead Status",
  "Create Date",
  "Last Modified Date",
  "Contact Type",
  "Lifecycle Stage",
  "Lead Source",
  "Stage of Journey",
  "Next Appointment Date",
  "Associated Deal",
  "Associated Company",
  "Associated Deal IDs",
  // Non-Surgical: optional HubSpot custom property — preserved when present
  "Non-Surgical",
] as const;

export type HubspotContactCsvHeader = (typeof HUBSPOT_CONTACT_CSV_HEADERS)[number];

export type HubspotContactParsedRow = {
  rowIndex: number;
  recordId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phoneNumber: string | null;
  contactOwner: string | null;
  leadStatus: string | null;
  createDate: string | null;
  lastModifiedDate: string | null;
  contactType: string | null;
  lifecycleStage: string | null;
  leadSource: string | null;
  stageOfJourney: string | null;
  nextAppointmentDate: string | null;
  associatedDeal: string | null;
  associatedCompany: string | null;
  associatedDealIds: string | null;
  /** HubSpot custom property: Non-Surgical interest flag or value. Null when column absent. */
  nonSurgical: string | null;
};

export const HEADER_TO_KEY: Record<string, keyof Omit<HubspotContactParsedRow, "rowIndex">> = {
  "record id": "recordId",
  "first name": "firstName",
  "last name": "lastName",
  email: "email",
  "phone number": "phoneNumber",
  "contact owner": "contactOwner",
  "lead status": "leadStatus",
  "create date": "createDate",
  "last modified date": "lastModifiedDate",
  "contact type": "contactType",
  "lifecycle stage": "lifecycleStage",
  "lead source": "leadSource",
  "stage of journey": "stageOfJourney",
  "next appointment date": "nextAppointmentDate",
  "associated deal": "associatedDeal",
  "associated company": "associatedCompany",
  "associated deal ids": "associatedDealIds",
  "non-surgical": "nonSurgical",
};
