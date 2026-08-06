import type { ServiceSetupConfig } from "@/src/lib/services/setup/serviceSetupTypes";

/** Lightweight staff row for Services Setup preferred-staff pickers (client-safe). */
export type ServicesCatalogStaffOption = {
  id: string;
  full_name: string;
  staff_role: string | null;
  is_active: boolean;
};

/** Row shape for `fi_services` (tenant procedure catalog). */
export type FiServiceRow = {
  id: string;
  tenant_id: string;
  name: string;
  duration_minutes: number;
  base_price: number;
  color: string | null;
  category: string | null;
  is_active: boolean;
  booking_type: string | null;
  /** Structured Services Setup UX config; empty object when unset. */
  setup_config?: ServiceSetupConfig | Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};
