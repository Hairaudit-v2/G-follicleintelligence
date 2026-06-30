/** Pure plan builder for Evolved Perth service → room / staff eligibility seeding. */

export type SeedServiceRow = {
  id: string;
  name: string;
  booking_type: string | null;
  category: string | null;
  is_active: boolean;
};

export type SeedRoomRow = {
  id: string;
  room_code: string;
  display_name: string;
  is_active: boolean;
};

export type EligibilityProfileId =
  | "consult"
  | "regenerative"
  | "surgery"
  | "block_time"
  | "non_room";

export type EligibilityProfile = {
  id: EligibilityProfileId;
  label: string;
  roomCodes: string[] | "all_active";
  preferredRoomCode: string | null;
  staffRoles: string[];
  skipRoomEligibility: boolean;
};

export const EVOLVED_PERTH_ELIGIBILITY_PROFILES: Record<
  Exclude<EligibilityProfileId, "non_room">,
  EligibilityProfile
> = {
  consult: {
    id: "consult",
    label: "Consultation / follow-up / review",
    roomCodes: ["cons_1", "cons_2", "patient_room_1", "patient_room_2"],
    preferredRoomCode: "cons_1",
    staffRoles: ["consultant", "trichologist", "doctor", "surgeon"],
    skipRoomEligibility: false,
  },
  regenerative: {
    id: "regenerative",
    label: "PRP / exosomes / regenerative",
    roomCodes: ["prp_1", "prp_2"],
    preferredRoomCode: "prp_1",
    staffRoles: ["nurse", "doctor", "technician"],
    skipRoomEligibility: false,
  },
  surgery: {
    id: "surgery",
    label: "Surgery / transplant",
    roomCodes: ["surgery_1", "surgery_2"],
    preferredRoomCode: "surgery_1",
    staffRoles: ["surgeon", "doctor", "nurse", "technician"],
    skipRoomEligibility: false,
  },
  block_time: {
    id: "block_time",
    label: "Block time / admin hold",
    roomCodes: "all_active",
    preferredRoomCode: null,
    staffRoles: ["doctor", "nurse", "technician", "consultant", "trichologist", "surgeon"],
    skipRoomEligibility: false,
  },
};

const BOOKING_TYPE_PROFILE: Partial<Record<string, EligibilityProfileId>> = {
  consultation: "consult",
  hair_transplant_consultation: "consult",
  trichology: "consult",
  beard_transplant_consultation: "consult",
  eyebrow_transplant_consultation: "consult",
  follow_up: "consult",
  review: "consult",
  prp: "regenerative",
  prf: "regenerative",
  exosomes: "regenerative",
  mesotherapy: "regenerative",
  surgery: "surgery",
  other: "block_time",
};

function normalizeHay(service: SeedServiceRow): string {
  return `${service.name} ${service.booking_type ?? ""} ${service.category ?? ""}`.toLowerCase();
}

/** Phone / virtual / internal services should not receive room eligibility rows. */
export function isNonRoomRequiredService(service: SeedServiceRow): boolean {
  const hay = normalizeHay(service);
  if (/\bphone\s+consult/.test(hay)) return true;
  if (/\bvirtual\s+consult/.test(hay)) return true;
  if (/\badmin\s+task\b/.test(hay)) return true;
  if (/\binternal\s+task\b/.test(hay)) return true;
  if (/\bphone\b/.test(hay) && /\bconsult/.test(hay)) return true;
  return false;
}

function nameMatchesBlockTime(name: string): boolean {
  return /\bblock\s*time\b/.test(name) || /\badmin\s+hold\b/.test(name);
}

function nameMatchesConsult(name: string): boolean {
  return (
    /\bconsult/.test(name) ||
    /\btrichology\b/.test(name) ||
    /\bfollow[- ]?up\b/.test(name) ||
    /\bsurgery\s+review\b/.test(name) ||
    /\btransplant\s+consult/.test(name)
  );
}

function nameMatchesSurgery(name: string): boolean {
  if (/\bconsult/.test(name)) return false;
  return (
    /\bsurgery\b/.test(name) ||
    /\bfue\b/.test(name) ||
    /\bdfi\b/.test(name) ||
    /\btransplant\s+surgery\b/.test(name) ||
    (/\bbeard\s+transplant\b/.test(name) && !/\bconsult/.test(name)) ||
    (/\beyebrow\s+transplant\b/.test(name) && !/\bconsult/.test(name)) ||
    (/\bhair\s+transplant\b/.test(name) && !/\bconsult/.test(name))
  );
}

function nameMatchesRegenerative(name: string): boolean {
  return (
    /\bprp\b/.test(name) ||
    /\bprf\b/.test(name) ||
    /\bexosome/.test(name) ||
    /\bmeso/.test(name) ||
    /\bregenerative\b/.test(name)
  );
}

export function matchEligibilityProfileId(service: SeedServiceRow): EligibilityProfileId | null {
  if (isNonRoomRequiredService(service)) return "non_room";

  const name = service.name.trim().toLowerCase();
  const bt = service.booking_type?.trim() || null;

  if (nameMatchesBlockTime(name)) return "block_time";
  if (bt && BOOKING_TYPE_PROFILE[bt]) {
    const mapped = BOOKING_TYPE_PROFILE[bt]!;
    if (mapped === "block_time" && !nameMatchesBlockTime(name) && bt === "other") {
      // `other` only maps to block_time when name confirms it
    } else if (mapped !== "block_time" || nameMatchesBlockTime(name)) {
      return mapped;
    }
  }

  if (nameMatchesConsult(name)) return "consult";
  if (nameMatchesSurgery(name)) return "surgery";
  if (nameMatchesRegenerative(name)) return "regenerative";
  if (nameMatchesBlockTime(name)) return "block_time";

  return null;
}

export type PlannedServiceEligibility = {
  service: SeedServiceRow;
  profileId: EligibilityProfileId;
  profileLabel: string;
  roomCodes: string[];
  preferredRoomCode: string | null;
  staffRoles: string[];
  skipRoomEligibility: boolean;
  missingRoomCodes: string[];
  resolvedRoomIds: string[];
  preferredRoomId: string | null;
  warning?: string;
};

export type BuildSeedPlanResult = {
  planned: PlannedServiceEligibility[];
  skipped: Array<{ service: SeedServiceRow; reason: string }>;
  warnings: string[];
  missingRoomCodes: string[];
};

export function buildEvolvedPerthServiceEligibilitySeedPlan(
  services: SeedServiceRow[],
  rooms: SeedRoomRow[]
): BuildSeedPlanResult {
  const activeRooms = rooms.filter((r) => r.is_active);
  const roomByCode = new Map(activeRooms.map((r) => [r.room_code.trim(), r]));
  const allActiveRoomCodes = activeRooms.map((r) => r.room_code.trim());

  const planned: PlannedServiceEligibility[] = [];
  const skipped: Array<{ service: SeedServiceRow; reason: string }> = [];
  const warnings: string[] = [];
  const missingRoomCodesSet = new Set<string>();

  for (const service of services.filter((s) => s.is_active)) {
    const profileId = matchEligibilityProfileId(service);
    if (!profileId) {
      skipped.push({ service, reason: "No eligibility profile matched (booking_type or name)." });
      continue;
    }

    if (profileId === "non_room") {
      planned.push({
        service,
        profileId,
        profileLabel: "Non-room (phone / virtual / internal)",
        roomCodes: [],
        preferredRoomCode: null,
        staffRoles: [],
        skipRoomEligibility: true,
        missingRoomCodes: [],
        resolvedRoomIds: [],
        preferredRoomId: null,
        warning:
          "Room eligibility skipped — bookings for this service should use room_required=false (not stored on fi_services; configure at booking time).",
      });
      continue;
    }

    const profile = EVOLVED_PERTH_ELIGIBILITY_PROFILES[profileId];
    const roomCodes =
      profile.roomCodes === "all_active" ? allActiveRoomCodes : [...profile.roomCodes];

    const missingRoomCodes = roomCodes.filter((code) => !roomByCode.has(code));
    for (const code of missingRoomCodes) missingRoomCodesSet.add(code);

    const resolvedRoomIds = roomCodes
      .map((code) => roomByCode.get(code)?.id)
      .filter((id): id is string => Boolean(id));

    const preferredRoomId =
      profile.preferredRoomCode && roomByCode.has(profile.preferredRoomCode)
        ? roomByCode.get(profile.preferredRoomCode)!.id
        : null;

    if (missingRoomCodes.length > 0) {
      warnings.push(
        `Service “${service.name}”: missing room codes [${missingRoomCodes.join(", ")}] — partial mapping only.`
      );
    }

    planned.push({
      service,
      profileId,
      profileLabel: profile.label,
      roomCodes,
      preferredRoomCode: profile.preferredRoomCode,
      staffRoles: [...profile.staffRoles],
      skipRoomEligibility: profile.skipRoomEligibility,
      missingRoomCodes,
      resolvedRoomIds,
      preferredRoomId,
    });
  }

  return {
    planned,
    skipped,
    warnings,
    missingRoomCodes: Array.from(missingRoomCodesSet).sort(),
  };
}

export function slugifyLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function tenantMatchesQuery(row: { slug: string; name: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const slug = row.slug.trim().toLowerCase();
  const name = row.name.trim().toLowerCase();
  return (
    slug === q || slug.includes(q) || name === q || name.includes(q) || slugifyLabel(name) === q
  );
}

export function clinicMatchesQuery(
  row: { display_name: string; metadata?: Record<string, unknown> | null },
  query: string
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const name = row.display_name.trim().toLowerCase();
  if (name === q) return true;
  if (slugifyLabel(row.display_name) === q) return true;
  const metaSlug = row.metadata?.slug;
  if (typeof metaSlug === "string" && metaSlug.trim().toLowerCase() === q) return true;
  return false;
}

/** Default tenant slug/name candidates (first match wins when loading from DB). */
export const DEFAULT_TENANT_LOOKUPS = [
  "evolved-hair",
  "evolved-hair-restoration",
  "evolved",
] as const;

/** Default clinic name/slug candidates. */
export const DEFAULT_CLINIC_LOOKUPS = [
  "Evolved Hair Restoration Perth",
  "evolved-hair-restoration-perth",
] as const;
