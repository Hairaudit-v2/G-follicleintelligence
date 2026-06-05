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
  created_at?: string;
  updated_at?: string;
};
