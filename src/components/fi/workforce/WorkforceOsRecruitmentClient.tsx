"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import {
  advanceRecruitmentCandidateAction,
  createRecruitmentCandidateAction,
  updateRecruitmentOfferStatusAction,
  upsertWorkforceRoleRequirementAction,
} from "@/src/lib/actions/workforce-phase-2-sprint-1-actions";
import {
  allowedRecruitmentStageTargets,
  RECRUITMENT_CANDIDATE_SOURCES,
  RECRUITMENT_OFFER_STATUSES,
  RECRUITMENT_OFFER_STATUS_LABELS,
  RECRUITMENT_PIPELINE_STAGE_LABELS,
  RECRUITMENT_PIPELINE_STAGES,
  resolveCandidateOnboardingTemplate,
  type OnboardingTemplateOption,
  type RecruitmentCandidate,
  type RecruitmentOfferStatus,
  type RecruitmentPipelineStage,
  type WorkforceRoleRequirement,
} from "@/src/lib/workforce/recruitmentPipelineCore";

const ACTIVE_PIPELINE_STAGES = RECRUITMENT_PIPELINE_STAGES.filter(
  (s) => s !== "hired" && s !== "withdrawn"
);

type StageFilter = "all" | RecruitmentPipelineStage;

export function WorkforceOsRecruitmentClient({
  tenantId,
  candidates: initialCandidates,
  roleRequirements: initialRoleRequirements,
  onboardingTemplates,
  stageCounts,
  canManage,
}: {
  tenantId: string;
  candidates: RecruitmentCandidate[];
  roleRequirements: WorkforceRoleRequirement[];
  onboardingTemplates: OnboardingTemplateOption[];
  stageCounts: Record<RecruitmentPipelineStage, number>;
  canManage: boolean;
}) {
  const router = useRouter();
  const base = `/fi-admin/${tenantId}/workforce-os`;
  const [candidates, setCandidates] = useState(initialCandidates);
  const [roleRequirements] = useState(initialRoleRequirements);
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);

  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    source: "direct",
    roleRequirementId: "",
    onboardingTemplateCode: "",
    notes: "",
  });

  const [roleForm, setRoleForm] = useState({
    roleRequirementId: "",
    roleCode: "",
    displayName: "",
    description: "",
    onboardingTemplateCode: "",
  });

  const templateLabelByCode = useMemo(() => {
    return new Map(onboardingTemplates.map((t) => [t.code, t.displayName]));
  }, [onboardingTemplates]);

  const visibleCandidates = useMemo(() => {
    if (stageFilter === "all") return candidates;
    return candidates.filter((c) => c.pipelineStage === stageFilter);
  }, [candidates, stageFilter]);

  const activeCount = useMemo(
    () => candidates.filter((c) => c.pipelineStage !== "hired" && c.pipelineStage !== "withdrawn").length,
    [candidates]
  );

  function resetFeedback() {
    setMessage(null);
    setError(null);
  }

  function onCreateCandidate(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    startTransition(async () => {
      const res = await createRecruitmentCandidateAction(tenantId, {
        fullName: createForm.fullName,
        email: createForm.email || undefined,
        phone: createForm.phone || undefined,
        source: createForm.source,
        roleRequirementId: createForm.roleRequirementId || undefined,
        onboardingTemplateCode: createForm.onboardingTemplateCode || undefined,
        notes: createForm.notes || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Candidate added to pipeline.");
      setShowCreate(false);
      setCreateForm({
        fullName: "",
        email: "",
        phone: "",
        source: "direct",
        roleRequirementId: "",
        onboardingTemplateCode: "",
        notes: "",
      });
      router.refresh();
    });
  }

  function onUpsertRoleRequirement(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    startTransition(async () => {
      const res = await upsertWorkforceRoleRequirementAction(tenantId, {
        roleRequirementId: roleForm.roleRequirementId || undefined,
        roleCode: roleForm.roleCode,
        displayName: roleForm.displayName,
        description: roleForm.description || undefined,
        onboardingTemplateCode: roleForm.onboardingTemplateCode || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(roleForm.roleRequirementId ? "Role requirement updated." : "Role requirement created.");
      setShowRoleForm(false);
      setRoleForm({
        roleRequirementId: "",
        roleCode: "",
        displayName: "",
        description: "",
        onboardingTemplateCode: "",
      });
      router.refresh();
    });
  }

  function onAdvanceStage(candidate: RecruitmentCandidate, toStage: RecruitmentPipelineStage) {
    resetFeedback();
    startTransition(async () => {
      const res = await advanceRecruitmentCandidateAction(tenantId, candidate.id, { toStage });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidate.id
            ? {
                ...c,
                pipelineStage: toStage,
                offerStatus:
                  toStage === "offer" && c.offerStatus === "none"
                    ? "draft"
                    : toStage === "hired" &&
                        (c.offerStatus === "extended" || c.offerStatus === "draft")
                      ? "accepted"
                      : toStage === "withdrawn" && c.offerStatus === "extended"
                        ? "declined"
                        : c.offerStatus,
              }
            : c
        )
      );
      setMessage(`${candidate.fullName} moved to ${RECRUITMENT_PIPELINE_STAGE_LABELS[toStage]}.`);
      router.refresh();
    });
  }

  function onUpdateOffer(candidate: RecruitmentCandidate, offerStatus: RecruitmentOfferStatus) {
    resetFeedback();
    startTransition(async () => {
      const res = await updateRecruitmentOfferStatusAction(tenantId, candidate.id, { offerStatus });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidate.id ? { ...c, offerStatus } : c))
      );
      setMessage(`Offer status updated for ${candidate.fullName}.`);
    });
  }

  function startEditRole(role: WorkforceRoleRequirement) {
    setRoleForm({
      roleRequirementId: role.id,
      roleCode: role.roleCode,
      displayName: role.displayName,
      description: role.description ?? "",
      onboardingTemplateCode: role.onboardingTemplateCode ?? "",
    });
    setShowRoleForm(true);
  }

  function resolveOnboardingLabel(candidate: RecruitmentCandidate): string {
    const code = resolveCandidateOnboardingTemplate({
      candidateTemplateCode: candidate.onboardingTemplateCode,
      roleTemplateCode:
        roleRequirements.find((r) => r.id === candidate.roleRequirementId)?.onboardingTemplateCode ??
        null,
    });
    if (!code) return "—";
    return templateLabelByCode.get(code) ?? code;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">
            WorkforceOS · Phase 2
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#F8FAFC]">Recruitment pipeline</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#94A3B8]">
            Candidate pipeline, role requirements, interview stages, offer tracking, and onboarding
            template links.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={base}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-[#94A3B8] hover:bg-white/5"
          >
            Staff directory
          </Link>
          {canManage ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowRoleForm((v) => !v)}>
                {showRoleForm ? "Close roles" : "Role requirements"}
              </Button>
              <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
                {showCreate ? "Close form" : "Add candidate"}
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <DashboardCard className="p-4">
        <dl className="grid gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[#64748B]">Active pipeline</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">{activeCount}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">In offer</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">{stageCounts.offer}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Hired</dt>
            <dd className="mt-1 text-xl font-semibold text-emerald-200">{stageCounts.hired}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Open roles</dt>
            <dd className="mt-1 text-xl font-semibold text-[#F8FAFC]">
              {roleRequirements.filter((r) => r.isActive).length}
            </dd>
          </div>
        </dl>
      </DashboardCard>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStageFilter("all")}
          className={
            stageFilter === "all"
              ? "rounded-full bg-[#22C1FF]/20 px-3 py-1 text-xs font-semibold text-[#22C1FF]"
              : "rounded-full border border-white/10 px-3 py-1 text-xs text-[#94A3B8] hover:bg-white/5"
          }
        >
          All ({candidates.length})
        </button>
        {ACTIVE_PIPELINE_STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            onClick={() => setStageFilter(stage)}
            className={
              stageFilter === stage
                ? "rounded-full bg-[#22C1FF]/20 px-3 py-1 text-xs font-semibold text-[#22C1FF]"
                : "rounded-full border border-white/10 px-3 py-1 text-xs text-[#94A3B8] hover:bg-white/5"
            }
          >
            {RECRUITMENT_PIPELINE_STAGE_LABELS[stage]} ({stageCounts[stage]})
          </button>
        ))}
        <button
          type="button"
          onClick={() => setStageFilter("hired")}
          className={
            stageFilter === "hired"
              ? "rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200"
              : "rounded-full border border-white/10 px-3 py-1 text-xs text-[#94A3B8] hover:bg-white/5"
          }
        >
          Hired ({stageCounts.hired})
        </button>
        <button
          type="button"
          onClick={() => setStageFilter("withdrawn")}
          className={
            stageFilter === "withdrawn"
              ? "rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-100"
              : "rounded-full border border-white/10 px-3 py-1 text-xs text-[#94A3B8] hover:bg-white/5"
          }
        >
          Withdrawn ({stageCounts.withdrawn})
        </button>
      </div>

      {message ? <p className="text-sm text-emerald-200">{message}</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {canManage && showCreate ? (
        <DashboardCard className="p-6">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">Add candidate</h2>
          <form onSubmit={onCreateCandidate} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Full name *</span>
              <input
                required
                value={createForm.fullName}
                onChange={(e) => setCreateForm((f) => ({ ...f, fullName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Email</span>
              <input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Phone</span>
              <input
                value={createForm.phone}
                onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Source</span>
              <select
                value={createForm.source}
                onChange={(e) => setCreateForm((f) => ({ ...f, source: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              >
                {RECRUITMENT_CANDIDATE_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Role requirement</span>
              <select
                value={createForm.roleRequirementId}
                onChange={(e) => {
                  const roleRequirementId = e.target.value;
                  const role = roleRequirements.find((r) => r.id === roleRequirementId);
                  setCreateForm((f) => ({
                    ...f,
                    roleRequirementId,
                    onboardingTemplateCode: role?.onboardingTemplateCode ?? f.onboardingTemplateCode,
                  }));
                }}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              >
                <option value="">— None —</option>
                {roleRequirements.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Onboarding template</span>
              <select
                value={createForm.onboardingTemplateCode}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, onboardingTemplateCode: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              >
                <option value="">— Inherit from role —</option>
                {onboardingTemplates.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-[#94A3B8]">Notes</span>
              <textarea
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                Create candidate
              </Button>
            </div>
          </form>
        </DashboardCard>
      ) : null}

      {canManage && showRoleForm ? (
        <DashboardCard className="p-6">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">
            {roleForm.roleRequirementId ? "Edit role requirement" : "New role requirement"}
          </h2>
          <form onSubmit={onUpsertRoleRequirement} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Role code *</span>
              <input
                required
                value={roleForm.roleCode}
                onChange={(e) => setRoleForm((f) => ({ ...f, roleCode: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[#94A3B8]">Display name *</span>
              <input
                required
                value={roleForm.displayName}
                onChange={(e) => setRoleForm((f) => ({ ...f, displayName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-[#94A3B8]">Description</span>
              <textarea
                value={roleForm.description}
                onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="text-[#94A3B8]">Default onboarding template</span>
              <select
                value={roleForm.onboardingTemplateCode}
                onChange={(e) =>
                  setRoleForm((f) => ({ ...f, onboardingTemplateCode: e.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[#F8FAFC]"
              >
                <option value="">— None —</option>
                {onboardingTemplates.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.displayName}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {roleForm.roleRequirementId ? "Save role" : "Create role"}
              </Button>
            </div>
          </form>
        </DashboardCard>
      ) : null}

      {roleRequirements.length > 0 ? (
        <DashboardCard className="p-6">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">Role requirements</h2>
          <ul className="mt-4 divide-y divide-white/10">
            {roleRequirements.map((role) => (
              <li key={role.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-[#F8FAFC]">{role.displayName}</p>
                  <p className="text-xs text-[#64748B]">
                    {role.roleCode}
                    {role.onboardingTemplateCode
                      ? ` · Onboarding: ${templateLabelByCode.get(role.onboardingTemplateCode) ?? role.onboardingTemplateCode}`
                      : ""}
                  </p>
                </div>
                {canManage ? (
                  <Button size="sm" variant="outline" onClick={() => startEditRole(role)}>
                    Edit
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </DashboardCard>
      ) : null}

      <DashboardCard className="overflow-x-auto p-0">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-[#64748B]">
            <tr>
              <th className="px-4 py-3">Candidate</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3">Offer</th>
              <th className="px-4 py-3">Onboarding</th>
              {canManage ? <th className="px-4 py-3">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {visibleCandidates.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 6 : 5}
                  className="px-4 py-8 text-center text-[#94A3B8]"
                >
                  No candidates match the current filter.
                </td>
              </tr>
            ) : (
              visibleCandidates.map((candidate) => {
                const stageTargets = allowedRecruitmentStageTargets(candidate.pipelineStage);
                const showOfferControls =
                  candidate.pipelineStage === "offer" ||
                  candidate.pipelineStage === "hired" ||
                  candidate.pipelineStage === "reference_check";
                return (
                  <tr key={candidate.id} className="border-b border-white/[0.06]">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#F8FAFC]">{candidate.fullName}</p>
                      <p className="text-xs text-[#64748B]">
                        {[candidate.email, candidate.phone].filter(Boolean).join(" · ") || "—"}
                      </p>
                      <p className="text-xs capitalize text-[#64748B]">
                        {candidate.source.replace(/_/g, " ")}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[#CBD5E1]">
                      {candidate.roleDisplayName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-[#E2E8F0]">
                        {RECRUITMENT_PIPELINE_STAGE_LABELS[candidate.pipelineStage]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#CBD5E1]">
                      {RECRUITMENT_OFFER_STATUS_LABELS[candidate.offerStatus]}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#CBD5E1]">
                      {resolveOnboardingLabel(candidate)}
                    </td>
                    {canManage ? (
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          {stageTargets.length > 0 ? (
                            <select
                              disabled={pending}
                              defaultValue=""
                              onChange={(e) => {
                                const toStage = e.target.value as RecruitmentPipelineStage;
                                if (!toStage) return;
                                onAdvanceStage(candidate, toStage);
                                e.target.value = "";
                              }}
                              className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-[#F8FAFC]"
                            >
                              <option value="">Advance stage…</option>
                              {stageTargets.map((s) => (
                                <option key={s} value={s}>
                                  → {RECRUITMENT_PIPELINE_STAGE_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          ) : null}
                          {showOfferControls ? (
                            <select
                              disabled={pending}
                              value={candidate.offerStatus}
                              onChange={(e) =>
                                onUpdateOffer(
                                  candidate,
                                  e.target.value as RecruitmentOfferStatus
                                )
                              }
                              className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-[#F8FAFC]"
                            >
                              {RECRUITMENT_OFFER_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {RECRUITMENT_OFFER_STATUS_LABELS[s]}
                                </option>
                              ))}
                            </select>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </DashboardCard>
    </div>
  );
}