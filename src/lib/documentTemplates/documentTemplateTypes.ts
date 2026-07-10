import type { DocumentTemplateCategory } from "./documentTemplateConstants";

export type FiDocumentTemplateRow = {
  id: string;
  tenant_id: string;
  category: DocumentTemplateCategory;
  slug: string;
  name: string;
  body: string;
  is_default: boolean;
  is_active: boolean;
  version: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
