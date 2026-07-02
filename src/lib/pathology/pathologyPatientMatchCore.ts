/**
 * Pure patient matching for pathology inbox documents (deterministic, testable).
 */

export type PathologyPatientMatchCandidate = {
  patientId: string;
  fullName: string;
  dateOfBirth: string | null;
  primaryEmail: string | null;
  mrn: string | null;
};

export type PathologyExtractedPatientHints = {
  patientName?: string | null;
  dob?: string | null;
  mrn?: string | null;
  email?: string | null;
};

export type PathologyPatientMatchEvidence = {
  matchedOn: string[];
  extractedName?: string | null;
  extractedDob?: string | null;
  extractedMrn?: string | null;
  extractedEmail?: string | null;
  candidateName?: string;
  candidateDob?: string | null;
  candidateEmail?: string | null;
  candidateMrn?: string | null;
};

export type PathologyPatientMatchScore = {
  patientId: string;
  confidence: number;
  evidence: PathologyPatientMatchEvidence;
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeMrn(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeDob(value: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return m ? m[1] : null;
}

export function scorePathologyPatientMatch(
  extracted: PathologyExtractedPatientHints,
  candidate: PathologyPatientMatchCandidate
): PathologyPatientMatchScore | null {
  const matchedOn: string[] = [];
  let confidence = 0;

  const extractedName = extracted.patientName?.trim() ? normalizeName(extracted.patientName) : null;
  const candidateName = candidate.fullName.trim() ? normalizeName(candidate.fullName) : null;
  const nameMatch = Boolean(extractedName && candidateName && extractedName === candidateName);

  const extractedDob = extracted.dob?.trim() ? normalizeDob(extracted.dob) : null;
  const candidateDob = candidate.dateOfBirth?.trim() ? normalizeDob(candidate.dateOfBirth) : null;
  const dobMatch = Boolean(extractedDob && candidateDob && extractedDob === candidateDob);

  const extractedEmail = extracted.email?.trim() ? normalizeEmail(extracted.email) : null;
  const candidateEmail = candidate.primaryEmail?.trim()
    ? normalizeEmail(candidate.primaryEmail)
    : null;
  const emailMatch = Boolean(
    extractedEmail && candidateEmail && extractedEmail === candidateEmail
  );

  const extractedMrn = extracted.mrn?.trim() ? normalizeMrn(extracted.mrn) : null;
  const candidateMrn = candidate.mrn?.trim() ? normalizeMrn(candidate.mrn) : null;
  const mrnMatch = Boolean(extractedMrn && candidateMrn && extractedMrn === candidateMrn);

  if (nameMatch && dobMatch) {
    matchedOn.push("name", "dob");
    confidence = 0.98;
  } else if (emailMatch) {
    matchedOn.push("email");
    confidence = 0.95;
  } else if (mrnMatch) {
    matchedOn.push("mrn");
    confidence = 0.94;
  } else if (nameMatch && emailMatch) {
    matchedOn.push("name", "email");
    confidence = 0.97;
  } else if (nameMatch) {
    matchedOn.push("name");
    confidence = 0.72;
  } else {
    return null;
  }

  return {
    patientId: candidate.patientId,
    confidence,
    evidence: {
      matchedOn,
      extractedName: extracted.patientName ?? null,
      extractedDob: extractedDob,
      extractedMrn: extracted.mrn ?? null,
      extractedEmail: extracted.email ?? null,
      candidateName: candidate.fullName,
      candidateDob: candidateDob,
      candidateEmail: candidate.primaryEmail,
      candidateMrn: candidate.mrn,
    },
  };
}

/** Pick the highest-confidence match; ties broken by patientId lexicographic order. */
export function pickBestPathologyPatientMatch(
  extracted: PathologyExtractedPatientHints,
  candidates: PathologyPatientMatchCandidate[]
): PathologyPatientMatchScore | null {
  const scored = candidates
    .map((c) => scorePathologyPatientMatch(extracted, c))
    .filter((s): s is PathologyPatientMatchScore => s != null)
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.patientId.localeCompare(b.patientId);
    });
  return scored[0] ?? null;
}

/** High-confidence threshold for auto-suggest (exact name+DOB, email, or MRN). */
export function isHighConfidencePathologyMatch(confidence: number): boolean {
  return confidence >= 0.94;
}
