"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui";
import {
  ArchiveStaffModal,
  LinkHrIdentityModal,
  ManageEmploymentModal,
  SetMaternityLeaveModal,
  StaffEditModal,
} from "@/src/components/fi/workforce/StaffLifecycleModals";
import { StaffLifecyclePanel } from "@/src/components/fi/workforce/StaffLifecyclePanel";
import { StaffHrTaskMapEntryBanner } from "@/src/components/fi/workforce/StaffHrTaskMapEntryBanner";
import { StaffProfileOverviewPanel } from "@/src/components/fi/workforce/StaffProfileOverviewPanel";
import type { StaffProfileOverviewModel } from "@/src/lib/workforce/staffProfileHubCore";
import type { StaffMemberLifecycleRow } from "@/src/lib/workforce-os/staffLifecycleTypes";
import {
  isExternallyManagedStaff,
  resolveIdentitySourceBadge,
} from "@/src/lib/workforce-os/staffLifecycleCore";
import { resolveStaffLifecycleOperationalPresentation } from "@/src/lib/workforce-os/staffLifecyclePresentation";
import { cn } from "@/lib/utils";

type ProfileTab = "overview" | "details" | "lifecycle" | "audit";

const TABS: { id: ProfileTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "details", label: "Details" },
  { id: "lifecycle", label: "Lifecycle & HR" },
  { id: "audit", label: "Audit" },
];

export function WorkforceOsStaffProfileClient({
  tenantId,
  lifecycle,
  audit,
  overview,
  canManage,
  iiohrCandidates,
}: {
  tenantId: string;
  lifecycle: StaffMemberLifecycleRow;
  audit: {
    id: string;
    event_type: string;
    source: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }[];
  overview: StaffProfileOverviewModel;
  canManage: boolean;
  iiohrCandidates: { id: string; full_name: string | null; email: string | null }[];
}) {
  const base = `/fi-admin/${tenantId}/workforce-os`;
  const profileHref = `${base}/staff/${lifecycle.id}`;
  const [tab, setTab] = useState<ProfileTab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [employmentOpen, setEmploymentOpen] = useState(false);
  const [maternityLeaveOpen, setMaternityLeaveOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const identityBadge = resolveIdentitySourceBadge(lifecycle.identity_source);
  const external = isExternallyManagedStaff(lifecycle);
  const hrLinked = Boolean(lifecycle.iiohr_staff_record_id);
  const lifecycleState = resolveStaffLifecycleOperationalPresentation(lifecycle);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">
            Team · Staff profile
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#F8FAFC]">
            {lifecycle.full_name}
          </h1>
          <p className="mt-2 text-sm text-[#94A3B8]">
            One profile for onboarding, access, readiness, and roster status.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setEditOpen(true)}>
              Edit Staff
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEmploymentOpen(true)}>
              Manage Employment
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMaternityLeaveOpen(true)}>
              Set maternity leave
            </Button>
            <Button size="sm" variant="outline" onClick={() => setArchiveOpen(true)}>
              {lifecycle.archived_at ? "Restore Staff" : "Archive Staff"}
            </Button>
            {!hrLinked ? (
              <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}>
                Link HR Identity
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <StaffHrTaskMapEntryBanner
        tenantId={tenantId}
        surface="staff_profile"
        staffId={lifecycle.id}
      />

      <nav className="flex flex-wrap gap-2 border-b border-white/10 pb-3" aria-label="Staff profile tabs">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              tab === item.id
                ? "bg-[#22C1FF]/20 text-[#22C1FF]"
                : "text-[#94A3B8] hover:bg-white/5 hover:text-[#E2E8F0]"
            )}
            data-testid={`staff-profile-tab-${item.id}`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "overview" ? (
        <StaffProfileOverviewPanel
          name={lifecycle.full_name}
          roleLabel={lifecycle.role_code}
          status={overview.unifiedStatus}
          blockers={overview.blockers}
          actionMenu={overview.actionMenu}
          actionContext={overview.actionContext}
          tenantId={tenantId}
          progressStages={overview.progressStages}
          onModalAction={(actionId) => {
            if (actionId === "set_maternity_leave" || actionId === "manage_leave") {
              setMaternityLeaveOpen(true);
            } else if (actionId === "manage_employment" || actionId === "set_leave" || actionId === "mark_inactive") {
              setEmploymentOpen(true);
            } else if (actionId === "archive_staff") {
              setArchiveOpen(true);
            } else if (actionId === "re_enable_roster_after_return") {
              setEmploymentOpen(true);
            }
          }}
        />
      ) : null}

      {tab === "details" ? (
        <DashboardCard className="p-6">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#E2E8F0]">
              {identityBadge.label}
            </span>
            <span className="rounded-full border border-[#22C1FF]/30 bg-[#22C1FF]/10 px-3 py-1 text-xs font-semibold text-[#7DD3FC]">
              {lifecycleState.label}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#E2E8F0]">
              {hrLinked ? "HR Linked" : "No HR Link"}
            </span>
            {lifecycle.archived_at ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
                Archived
              </span>
            ) : (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                Active directory
              </span>
            )}
          </div>
          {external ? (
            <p className="mt-4 text-sm text-sky-100/90">
              Managed externally — editing restricted on identity fields.
            </p>
          ) : null}
          <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[#64748B]">Email</dt>
              <dd className="mt-1 text-[#E2E8F0]">{lifecycle.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Phone</dt>
              <dd className="mt-1 text-[#E2E8F0]">{lifecycle.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Role</dt>
              <dd className="mt-1 capitalize text-[#E2E8F0]">
                {(lifecycle.role_code ?? "—").replace(/_/g, " ")}
              </dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Identity source</dt>
              <dd className="mt-1 text-[#E2E8F0]">{lifecycle.identity_source.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Timezone</dt>
              <dd className="mt-1 font-mono text-xs text-[#CBD5E1]">{lifecycle.timezone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[#64748B]">Notes</dt>
              <dd className="mt-1 text-[#E2E8F0]">{lifecycle.notes ?? "—"}</dd>
            </div>
          </dl>
        </DashboardCard>
      ) : null}

      {tab === "lifecycle" ? <StaffLifecyclePanel lifecycle={lifecycle} /> : null}

      {tab === "audit" ? (
        <DashboardCard className="p-6">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">Audit timeline</h2>
          {audit.length === 0 ? (
            <p className="mt-4 text-sm text-[#94A3B8]">No lifecycle audit events recorded.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {audit.map((event) => (
                <li
                  key={event.id}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
                >
                  <p className="font-medium text-[#E2E8F0]">{event.event_type.replace(/_/g, " ")}</p>
                  <p className="mt-1 text-xs text-[#64748B]">
                    {new Date(event.created_at).toLocaleString()} · {event.source}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      ) : null}

      <p className="text-center text-sm text-[#64748B]">
        <Link href={`${base}/directory`} className="underline-offset-2 hover:underline">
          Back to Team directory
        </Link>
        {" · "}
        <Link href={profileHref} className="underline-offset-2 hover:underline">
          Profile overview
        </Link>
        {lifecycle.fi_staff_id ? (
          <>
            {" · "}
            <Link
              href={`/fi-admin/${tenantId}/staff/${lifecycle.fi_staff_id}/twin`}
              className="underline-offset-2 hover:underline"
            >
              Staff Twin (operational view)
            </Link>
          </>
        ) : null}
      </p>

      {canManage ? (
        <>
          <StaffEditModal
            tenantId={tenantId}
            row={lifecycle}
            open={editOpen}
            onClose={() => setEditOpen(false)}
          />
          <ManageEmploymentModal
            tenantId={tenantId}
            staffMemberId={lifecycle.id}
            open={employmentOpen}
            onClose={() => setEmploymentOpen(false)}
          />
          <SetMaternityLeaveModal
            tenantId={tenantId}
            staffMemberId={lifecycle.id}
            staffName={lifecycle.full_name}
            open={maternityLeaveOpen}
            onClose={() => setMaternityLeaveOpen(false)}
          />
          <ArchiveStaffModal
            tenantId={tenantId}
            staffMemberId={lifecycle.id}
            staffName={lifecycle.full_name}
            archived={Boolean(lifecycle.archived_at)}
            open={archiveOpen}
            onClose={() => setArchiveOpen(false)}
          />
          <LinkHrIdentityModal
            tenantId={tenantId}
            staffMemberId={lifecycle.id}
            open={linkOpen}
            onClose={() => setLinkOpen(false)}
            candidates={iiohrCandidates}
          />
        </>
      ) : null}
    </div>
  );
}
