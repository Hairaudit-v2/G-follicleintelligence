/**
 * ImagingOS Phase 5 — tenant-aware protocol catalog resolver (pure logic).
 * Unifies VIE / ImagingOS DB / HLI sources without deleting legacy catalogs.
 */

import type { ProtocolSlotDef } from "@/src/lib/imagingOs/imagingOsProtocol";
import { getVieProtocol } from "@/src/lib/vie/vieProtocolCatalog";

export const PROTOCOL_CATALOG_RESOLVER_VERSION = "protocol_catalog_resolver_v1" as const;

export type ProtocolCatalogSource =
  | "tenant_db"
  | "imagingos_canonical"
  | "hli_mapping"
  | "vie_legacy";

export type NormalizedProtocolSlot = ProtocolSlotDef;

export type NormalizedProtocol = {
  slug: string;
  name: string;
  description?: string | null;
  slots: NormalizedProtocolSlot[];
  metadata: {
    source: ProtocolCatalogSource;
    version: string;
    resolved_at: string;
    mapped_from?: string;
  };
};

export type TenantDbTemplateInput = {
  slug: string;
  name: string;
  description?: string | null;
  slots: ProtocolSlotDef[];
  tenant_id?: string | null;
};

export type HliProtocolSlotInput = {
  slot_slug: string;
  label: string;
  is_required: boolean;
  capture_guidance?: string | null;
  required_image_category?: string | null;
};

export type HliProtocolTemplateInput = {
  slug: string;
  name: string;
  description?: string | null;
  slots: HliProtocolSlotInput[];
};

/** HLI template slug → canonical ImagingOS/VIE slug when a direct mapping exists. */
export const HLI_TO_CANONICAL_PROTOCOL_SLUG: Record<string, string> = {
  consultation_standard: "baseline_consultation",
  surgery_pre_op_standard: "hair_transplant_planning",
  immediate_post_op_standard: "post_op_review",
  follow_up_standard: "follow_up_review",
  hli_intake_standard: "baseline_consultation",
  hairaudit_case_standard: "full_clinical_head_series",
};

export function hliSlotsToProtocolSlots(slots: HliProtocolSlotInput[]): ProtocolSlotDef[] {
  return slots.map((s) => ({
    slug: s.slot_slug,
    label: s.label,
    required: s.is_required,
    suggested_region: s.required_image_category ?? undefined,
    instruction: s.capture_guidance ?? undefined,
  }));
}

export function vieCatalogSlotsToProtocolSlots(templateSlug: string): ProtocolSlotDef[] {
  const catalog = getVieProtocol(templateSlug);
  if (!catalog) return [];
  return catalog.slots.map((s) => ({
    slug: s.slug,
    label: s.label,
    required: s.required,
    suggested_region: s.suggested_region,
    instruction: s.instruction,
  }));
}

export function resolveFromTenantDb(
  input: TenantDbTemplateInput,
  resolvedAt: string
): NormalizedProtocol | null {
  if (!input.slots.length) return null;
  return {
    slug: input.slug,
    name: input.name,
    description: input.description,
    slots: input.slots,
    metadata: {
      source: "tenant_db",
      version: PROTOCOL_CATALOG_RESOLVER_VERSION,
      resolved_at: resolvedAt,
    },
  };
}

export function resolveFromImagingOsCanonical(
  templateSlug: string,
  resolvedAt: string
): NormalizedProtocol | null {
  const catalog = getVieProtocol(templateSlug);
  if (!catalog) return null;
  const slots = vieCatalogSlotsToProtocolSlots(templateSlug);
  if (!slots.length) return null;
  return {
    slug: catalog.slug,
    name: catalog.name,
    description: catalog.description,
    slots,
    metadata: {
      source: "imagingos_canonical",
      version: PROTOCOL_CATALOG_RESOLVER_VERSION,
      resolved_at: resolvedAt,
    },
  };
}

export function resolveFromHliMapping(
  hli: HliProtocolTemplateInput,
  resolvedAt: string
): NormalizedProtocol | null {
  const hliSlots = hliSlotsToProtocolSlots(hli.slots);
  const mappedSlug = HLI_TO_CANONICAL_PROTOCOL_SLUG[hli.slug];
  const canonical = mappedSlug ? resolveFromImagingOsCanonical(mappedSlug, resolvedAt) : null;

  if (canonical) {
    return {
      slug: hli.slug,
      name: hli.name || canonical.name,
      description: hli.description ?? canonical.description,
      slots: hliSlots.length > 0 ? hliSlots : canonical.slots,
      metadata: {
        source: "hli_mapping",
        version: PROTOCOL_CATALOG_RESOLVER_VERSION,
        resolved_at: resolvedAt,
        mapped_from: mappedSlug,
      },
    };
  }

  if (!hliSlots.length) return null;
  return {
    slug: hli.slug,
    name: hli.name,
    description: hli.description,
    slots: hliSlots,
    metadata: {
      source: "hli_mapping",
      version: PROTOCOL_CATALOG_RESOLVER_VERSION,
      resolved_at: resolvedAt,
    },
  };
}

export function resolveFromVieLegacy(templateSlug: string, resolvedAt: string): NormalizedProtocol {
  const catalog = getVieProtocol(templateSlug);
  if (catalog) {
    const slots = vieCatalogSlotsToProtocolSlots(templateSlug);
    return {
      slug: catalog.slug,
      name: catalog.name,
      description: catalog.description,
      slots,
      metadata: {
        source: "vie_legacy",
        version: PROTOCOL_CATALOG_RESOLVER_VERSION,
        resolved_at: resolvedAt,
      },
    };
  }
  return {
    slug: templateSlug,
    name: templateSlug,
    slots: [],
    metadata: {
      source: "vie_legacy",
      version: PROTOCOL_CATALOG_RESOLVER_VERSION,
      resolved_at: resolvedAt,
    },
  };
}

export function resolveProtocolCatalog(input: {
  templateSlug: string;
  tenantDbTemplate?: TenantDbTemplateInput | null;
  hliTemplate?: HliProtocolTemplateInput | null;
  resolvedAt?: string;
}): NormalizedProtocol {
  const slug = input.templateSlug.trim();
  const at = input.resolvedAt ?? new Date().toISOString();

  if (input.tenantDbTemplate?.slug === slug) {
    const fromDb = resolveFromTenantDb(input.tenantDbTemplate, at);
    if (fromDb) return fromDb;
  }

  const canonical = resolveFromImagingOsCanonical(slug, at);
  if (canonical) return canonical;

  if (input.hliTemplate) {
    const hliMatch =
      input.hliTemplate.slug === slug ||
      HLI_TO_CANONICAL_PROTOCOL_SLUG[input.hliTemplate.slug] === slug;
    if (hliMatch) {
      const fromHli = resolveFromHliMapping(input.hliTemplate, at);
      if (fromHli) return fromHli;
    }
  }

  const hliMappedSlug = HLI_TO_CANONICAL_PROTOCOL_SLUG[slug];
  if (hliMappedSlug) {
    const mapped = resolveFromImagingOsCanonical(hliMappedSlug, at);
    if (mapped) {
      return {
        ...mapped,
        slug,
        metadata: {
          source: "hli_mapping",
          version: PROTOCOL_CATALOG_RESOLVER_VERSION,
          resolved_at: at,
          mapped_from: hliMappedSlug,
        },
      };
    }
  }

  return resolveFromVieLegacy(slug, at);
}