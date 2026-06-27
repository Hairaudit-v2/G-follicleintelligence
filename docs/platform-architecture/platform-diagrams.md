# FI OS — Platform Architecture Diagrams

**Status:** Reference diagrams. Complements the [module registry](./README.md) and marketing map (`components/platform/PlatformArchitectureMap.tsx`).

---

## Diagram 1 — Platform Overview

Layered view from user personas through external integrations.

```mermaid
flowchart TB
  subgraph UserLayer["User Layer"]
    direction LR
    U1["Clinic Staff"]
    U2["Surgeons"]
    U3["Reception"]
    U4["Consultants"]
    U5["Admins"]
    U6["Enterprise Operators"]
  end

  subgraph AppLayer["Application Layer"]
    direction LR
    A1["FI Admin Portal"]
    A2["Staff PIN Access"]
    A3["Marketing Site"]
    A4["Patient Interfaces"]
  end

  subgraph CoreLayer["Core Platform Layer"]
    direction LR
    C1["LeadFlow"]
    C2["ClinicOS"]
    C3["CalendarOS"]
    C4["PatientOS"]
    C5["ConsultationOS"]
    C6["SurgeryOS"]
    C7["FinancialOS"]
    C8["ReceptionOS"]
  end

  subgraph IntelLayer["Intelligence Layer"]
    direction LR
    I1["VIE"]
    I2["HIE"]
    I3["AnalyticsOS"]
    I4["Event Bus"]
    I5["AI Engines"]
  end

  subgraph ExtLayer["External Systems"]
    direction LR
    E1["HairAudit"]
    E2["HLI"]
    E3["IIOHR"]
    E4["HubSpot"]
    E5["Google Calendar"]
    E6["Stripe"]
    E7["Twilio"]
    E8["OpenAI"]
  end

  UserLayer --> AppLayer
  AppLayer --> CoreLayer
  CoreLayer --> IntelLayer
  IntelLayer --> ExtLayer
```

---

## Diagram 2 — Module Architecture

Every OS module under Platform Core.

```mermaid
flowchart TB
  PC["Platform Core"]

  PC --> LF["LeadFlow OS"]
  PC --> CAL["CalendarOS"]
  PC --> PAT["PatientOS"]
  PC --> CON["ConsultationOS"]
  PC --> SUR["SurgeryOS"]
  PC --> FIN["FinancialOS"]
  PC --> REC["ReceptionOS"]
  PC --> WF["WorkforceOS"]
  PC --> ACA["AcademyOS"]
  PC --> AUD["AuditOS"]
  PC --> ANA["AnalyticsOS"]
  PC --> IMG["ImagingOS"]
  PC --> HIE["HIE"]
  PC --> ONB["OnboardingOS"]
```

---

## Diagram 3 — Multi-Tenant Architecture

Isolation and entitlement hierarchy from platform admin to module access.

```mermaid
flowchart TB
  PA["Platform Admin"]
  T["Tenant"]
  CL["Clinics"]
  US["Users"]
  RO["Roles"]
  PE["Permissions"]
  ME["Module Entitlements"]

  PA --> T
  T --> CL
  CL --> US
  US --> RO
  RO --> PE
  PE --> ME
```

---

## Diagram 4 — Data Architecture

Supabase schema groups: core operational tables and intelligence tables.

```mermaid
flowchart TB
  DB["Supabase Database"]

  subgraph CoreTables["Core Tables"]
    direction TB
    CT1["fi_tenants"]
    CT2["fi_users"]
    CT3["fi_patients"]
    CT4["fi_cases"]
    CT5["fi_bookings"]
    CT6["fi_financial"]
    CT7["fi_staff"]
  end

  subgraph IntelTables["Intelligence Tables"]
    direction TB
    IT1["fi_events"]
    IT2["fi_intelligence_logs"]
    IT3["fi_outcome_summaries"]
    IT4["fi_analytics_events"]
  end

  DB --> CoreTables
  DB --> IntelTables
```

---

## Diagram 5 — External Integration Layer

Inbound integrations flow through webhooks and services into the FI Event Bus and intelligence pipeline.

```mermaid
flowchart TB
  subgraph External["External Systems"]
    direction LR
    X1["Google Calendar"]
    X2["Stripe"]
    X3["HubSpot"]
    X4["Twilio"]
    X5["Resend"]
  end

  WH["Webhook Layer"]
  IS["Integration Services"]
  EB["FI Event Bus"]
  IP["Intelligence Processing Layer"]

  External --> WH
  WH --> IS
  IS --> EB
  EB --> IP
```
