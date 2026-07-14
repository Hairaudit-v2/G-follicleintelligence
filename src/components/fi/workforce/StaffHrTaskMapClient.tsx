"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { DashboardCard } from "@/src/components/fi-admin/dashboard-ui/DashboardCard";
import {
  buildStaffHrTaskMap,
  findStaffHrTaskById,
  groupStaffHrTasksByCategory,
  STAFF_HR_TASK_CATEGORY_LABELS,
  type StaffHrTaskCategory,
  type StaffHrTaskDefinition,
} from "@/src/lib/workforce/staffHrTaskMapCore";
import { parseStaffHrTaskMapCategoryParam } from "@/src/lib/workforce/staffHrTaskMapBannerCore";
import {
  buildStaffProfileHref,
  buildStaffHrTaskMapHref,
  buildWorkforceCommandCentreHref,
} from "@/src/lib/workforce/staffLifecycleCopy";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: StaffHrTaskCategory[] = [
  "access",
  "onboarding",
  "employment",
  "leave_availability",
  "roster",
  "training_readiness",
  "offboarding",
  "audit",
];

function TaskCard({ task }: { task: StaffHrTaskDefinition }) {
  return (
    <div id={`hr-task-${task.id}`}>
      <DashboardCard className="p-4" data-testid={`hr-task-${task.id}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-[#F8FAFC]">{task.label}</h3>
            <p className="mt-1 text-xs text-[#94A3B8]">{task.description}</p>
            <p className="mt-2 text-[10px] font-medium uppercase tracking-wider text-[#64748B]">
              Entry point: {task.entryPoint}
            </p>
          </div>
          <Link
            href={task.route.href}
            className="shrink-0 rounded-lg border border-[#22C1FF]/30 bg-[#22C1FF]/10 px-3 py-1.5 text-xs font-semibold text-[#7DD3FC] hover:bg-[#22C1FF]/20"
          >
            {task.route.actionLabel ?? "Open"}
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
              What it changes
            </p>
            <ul className="mt-1.5 space-y-1 text-xs text-[#CBD5E1]">
              <li>
                <span className="text-[#64748B]">Lifecycle:</span> {task.impact.lifecycle}
              </li>
              <li>
                <span className="text-[#64748B]">Roster:</span> {task.impact.roster}
              </li>
              <li>
                <span className="text-[#64748B]">Access:</span> {task.impact.access}
              </li>
              <li>
                <span className="text-[#64748B]">Readiness:</span> {task.impact.readiness}
              </li>
              <li>
                <span className="text-[#64748B]">Audit:</span> {task.impact.audit}
              </li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/90">
              What it does NOT change
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-[#94A3B8]">
              {task.doesNotChange.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-3 text-[10px] text-[#64748B]">
              Permission: {task.requiredPermission.replace(/_/g, " ")}
            </p>
          </div>
        </div>
      </DashboardCard>
    </div>
  );
}

export function StaffHrTaskMapClient({
  tenantId,
  staffId,
  initialCategory,
  initialTaskId,
}: {
  tenantId: string;
  staffId?: string | null;
  initialCategory?: string | null;
  initialTaskId?: string | null;
}) {
  const tasks = useMemo(
    () => buildStaffHrTaskMap(tenantId, staffId ?? undefined),
    [tenantId, staffId]
  );
  const focusedTask = useMemo(
    () => (initialTaskId ? findStaffHrTaskById(tasks, initialTaskId) : undefined),
    [tasks, initialTaskId]
  );
  const parsedCategory =
    parseStaffHrTaskMapCategoryParam(initialCategory) ?? focusedTask?.category ?? null;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<StaffHrTaskCategory | "all">(parsedCategory ?? "all");

  useEffect(() => {
    if (!initialTaskId) return;
    const el = document.getElementById(`hr-task-${initialTaskId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [initialTaskId, tasks]);

  const grouped = useMemo(() => groupStaffHrTasksByCategory(tasks), [tasks]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => {
      if (category !== "all" && task.category !== category) return false;
      if (!q) return true;
      return (
        task.label.toLowerCase().includes(q) ||
        task.description.toLowerCase().includes(q) ||
        task.entryPoint.toLowerCase().includes(q)
      );
    });
  }, [tasks, query, category]);

  const displayTasks = useMemo(() => {
    if (initialTaskId && focusedTask) {
      return [focusedTask];
    }
    return filtered;
  }, [filtered, focusedTask, initialTaskId]);

  const commandHref = buildWorkforceCommandCentreHref(tenantId);

  return (
    <div className="space-y-6" data-testid="staff-hr-task-map">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#22C1FF]/90">
          Team · HR Task Map
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#F8FAFC]">I need to…</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#94A3B8]">
          Find where to complete each staff-related HR task, what it changes, and what it leaves
          unchanged. Use this when staff lifecycle, onboarding, access, leave, roster, and
          offboarding feel spread across multiple areas.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={commandHref}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-[#94A3B8] hover:bg-white/5 hover:text-[#E2E8F0]"
          >
            ← Overview
          </Link>
          {staffId ? (
            <Link
              href={buildStaffProfileHref(tenantId, staffId)}
              className="rounded-full border border-[#22C1FF]/30 bg-[#22C1FF]/10 px-3 py-1 text-xs font-semibold text-[#7DD3FC]"
            >
              Back to staff profile
            </Link>
          ) : null}
        </div>
      </div>

      <DashboardCard className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="search"
            placeholder="Search tasks… e.g. maternity leave, invite, standard hours"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-sm text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#22C1FF]/40 focus:outline-none"
            data-testid="hr-task-map-search"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                category === "all"
                  ? "bg-[#22C1FF]/20 text-[#22C1FF]"
                  : "text-[#64748B] hover:bg-white/5"
              )}
            >
              All
            </button>
            {CATEGORY_ORDER.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                  category === cat
                    ? "bg-[#22C1FF]/20 text-[#22C1FF]"
                    : "text-[#64748B] hover:bg-white/5"
                )}
              >
                {STAFF_HR_TASK_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        </div>
      </DashboardCard>

      {initialTaskId && focusedTask ? (
        <p className="text-xs text-[#94A3B8]" data-testid="hr-task-map-focused-hint">
          Showing HR task: <span className="text-[#E2E8F0]">{focusedTask.label}</span>
          {" · "}
          <Link
            href={buildStaffHrTaskMapHref(tenantId, staffId ? { staffId } : undefined)}
            className="text-[#7DD3FC] hover:underline"
          >
            View all tasks
          </Link>
        </p>
      ) : null}

      {query || category !== "all" || initialTaskId ? (
        <div className="space-y-3">
          {displayTasks.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">No tasks match your search.</p>
          ) : (
            displayTasks.map((task) => <TaskCard key={task.id} task={task} />)
          )}
        </div>
      ) : (
        grouped.map((group) => (
          <section key={group.category} data-testid={`hr-task-category-${group.category}`}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#64748B]">
              {group.label}
            </h2>
            <div className="space-y-3">
              {group.tasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
