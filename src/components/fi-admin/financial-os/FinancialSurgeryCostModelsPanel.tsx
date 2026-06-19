"use client";

import { useState, useTransition } from "react";

import {
  createSurgeryCostModelAction,
  updateSurgeryCostModelAction,
  archiveSurgeryCostModelAction,
  activateSurgeryCostModelAction,
} from "@/lib/actions/financial-os-surgery-economics-actions";
import { SURGEON_COST_TYPES } from "@/src/lib/financialOs/financialSurgeryEconomicsCore";
import type { FiSurgeryCostModelRow } from "@/src/lib/financialOs/financialSurgeryCostModel.server";
import {
  FinancialOsFeedbackText,
  FinancialOsFormPanel,
  financialOsClasses,
  type FinancialOsFeedback,
} from "@/src/components/fi-admin/financial-os/financialOsUi";

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function dollarsToCents(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n * 100));
}

type FormState = {
  procedure_type: string;
  surgeon_cost_type: string;
  surgeon_cost_value: string;
  rn_hourly: string;
  tech_hourly: string;
  assistant_hourly: string;
  room_hourly: string;
  consumables_base: string;
  graft_consumable: string;
  prp_cost: string;
  exosome_cost: string;
  medication_cost: string;
  default_duration_minutes: string;
};

function emptyForm(): FormState {
  return {
    procedure_type: "",
    surgeon_cost_type: "fixed",
    surgeon_cost_value: "0",
    rn_hourly: "0",
    tech_hourly: "0",
    assistant_hourly: "0",
    room_hourly: "0",
    consumables_base: "0",
    graft_consumable: "0",
    prp_cost: "0",
    exosome_cost: "0",
    medication_cost: "0",
    default_duration_minutes: "480",
  };
}

function formFromModel(model: FiSurgeryCostModelRow): FormState {
  return {
    procedure_type: model.procedure_type,
    surgeon_cost_type: model.surgeon_cost_type,
    surgeon_cost_value: centsToDollars(model.surgeon_cost_value_cents),
    rn_hourly: centsToDollars(model.rn_hourly_rate_cents),
    tech_hourly: centsToDollars(model.technician_hourly_rate_cents),
    assistant_hourly: centsToDollars(model.assistant_hourly_rate_cents),
    room_hourly: centsToDollars(model.room_hourly_cost_cents),
    consumables_base: centsToDollars(model.consumables_base_cost_cents),
    graft_consumable: centsToDollars(model.graft_consumable_cost_cents),
    prp_cost: centsToDollars(model.prp_cost_cents),
    exosome_cost: centsToDollars(model.exosome_cost_cents),
    medication_cost: centsToDollars(model.medication_cost_cents),
    default_duration_minutes: String(model.default_duration_minutes),
  };
}

function payloadFromForm(form: FormState) {
  return {
    procedure_type: form.procedure_type.trim(),
    surgeon_cost_type: form.surgeon_cost_type,
    surgeon_cost_value_cents: dollarsToCents(form.surgeon_cost_value),
    rn_hourly_rate_cents: dollarsToCents(form.rn_hourly),
    technician_hourly_rate_cents: dollarsToCents(form.tech_hourly),
    assistant_hourly_rate_cents: dollarsToCents(form.assistant_hourly),
    room_hourly_cost_cents: dollarsToCents(form.room_hourly),
    consumables_base_cost_cents: dollarsToCents(form.consumables_base),
    graft_consumable_cost_cents: dollarsToCents(form.graft_consumable),
    prp_cost_cents: dollarsToCents(form.prp_cost),
    exosome_cost_cents: dollarsToCents(form.exosome_cost),
    medication_cost_cents: dollarsToCents(form.medication_cost),
    default_duration_minutes: Math.max(1, Math.min(1440, Number(form.default_duration_minutes) || 480)),
  };
}

export function FinancialSurgeryCostModelForm(props: { tenantId: string; canMutate: boolean }) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  if (!props.canMutate) {
    return <p className={financialOsClasses.mutedMeta}>Finance or manager role required to manage cost models.</p>;
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    start(async () => {
      const res = await createSurgeryCostModelAction(props.tenantId, { ...payloadFromForm(form), activate: true });
      if (!res.ok) {
        setFeedback({ message: res.error, tone: "error" });
        return;
      }
      setForm(emptyForm());
      setFeedback({ message: "Cost model created and activated.", tone: "success" });
    });
  }

  return (
    <FinancialOsFormPanel title="Create procedure cost model">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className={financialOsClasses.formLabel}>
            Procedure type
            <input
              value={form.procedure_type}
              onChange={(e) => setForm((f) => ({ ...f, procedure_type: e.target.value }))}
              className={financialOsClasses.input}
              placeholder="e.g. fue"
              required
            />
          </label>
          <label className={financialOsClasses.formLabel}>
            Surgeon fee mode
            <select
              value={form.surgeon_cost_type}
              onChange={(e) => setForm((f) => ({ ...f, surgeon_cost_type: e.target.value }))}
              className={financialOsClasses.select}
            >
              {SURGEON_COST_TYPES.map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
              ))}
            </select>
          </label>
          <label className={financialOsClasses.formLabel}>
            Surgeon fee value (AUD or basis points for %)
            <input
              value={form.surgeon_cost_value}
              onChange={(e) => setForm((f) => ({ ...f, surgeon_cost_value: e.target.value }))}
              className={financialOsClasses.input}
              type="number"
              min={0}
              step="0.01"
            />
          </label>
          <label className={financialOsClasses.formLabel}>
            RN hourly (AUD)
            <input value={form.rn_hourly} onChange={(e) => setForm((f) => ({ ...f, rn_hourly: e.target.value }))} className={financialOsClasses.input} type="number" min={0} step="0.01" />
          </label>
          <label className={financialOsClasses.formLabel}>
            Technician hourly (AUD)
            <input value={form.tech_hourly} onChange={(e) => setForm((f) => ({ ...f, tech_hourly: e.target.value }))} className={financialOsClasses.input} type="number" min={0} step="0.01" />
          </label>
          <label className={financialOsClasses.formLabel}>
            Assistant hourly (AUD)
            <input value={form.assistant_hourly} onChange={(e) => setForm((f) => ({ ...f, assistant_hourly: e.target.value }))} className={financialOsClasses.input} type="number" min={0} step="0.01" />
          </label>
          <label className={financialOsClasses.formLabel}>
            Room hourly (AUD)
            <input value={form.room_hourly} onChange={(e) => setForm((f) => ({ ...f, room_hourly: e.target.value }))} className={financialOsClasses.input} type="number" min={0} step="0.01" />
          </label>
          <label className={financialOsClasses.formLabel}>
            Consumables base (AUD)
            <input value={form.consumables_base} onChange={(e) => setForm((f) => ({ ...f, consumables_base: e.target.value }))} className={financialOsClasses.input} type="number" min={0} step="0.01" />
          </label>
          <label className={financialOsClasses.formLabel}>
            Graft consumable (AUD/graft)
            <input value={form.graft_consumable} onChange={(e) => setForm((f) => ({ ...f, graft_consumable: e.target.value }))} className={financialOsClasses.input} type="number" min={0} step="0.01" />
          </label>
          <label className={financialOsClasses.formLabel}>
            PRP cost (AUD)
            <input value={form.prp_cost} onChange={(e) => setForm((f) => ({ ...f, prp_cost: e.target.value }))} className={financialOsClasses.input} type="number" min={0} step="0.01" />
          </label>
          <label className={financialOsClasses.formLabel}>
            Exosome cost (AUD)
            <input value={form.exosome_cost} onChange={(e) => setForm((f) => ({ ...f, exosome_cost: e.target.value }))} className={financialOsClasses.input} type="number" min={0} step="0.01" />
          </label>
          <label className={financialOsClasses.formLabel}>
            Medication cost (AUD)
            <input value={form.medication_cost} onChange={(e) => setForm((f) => ({ ...f, medication_cost: e.target.value }))} className={financialOsClasses.input} type="number" min={0} step="0.01" />
          </label>
          <label className={financialOsClasses.formLabel}>
            Default duration (minutes)
            <input value={form.default_duration_minutes} onChange={(e) => setForm((f) => ({ ...f, default_duration_minutes: e.target.value }))} className={financialOsClasses.input} type="number" min={1} max={1440} />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={pending} className={financialOsClasses.primaryButton}>
            {pending ? "Saving…" : "Create & activate"}
          </button>
          <FinancialOsFeedbackText message={feedback?.message ?? null} tone={feedback?.tone} />
        </div>
      </form>
    </FinancialOsFormPanel>
  );
}

export function FinancialSurgeryCostModelHistory(props: {
  tenantId: string;
  groups: Array<{
    procedure_type: string;
    active: FiSurgeryCostModelRow | null;
    history: FiSurgeryCostModelRow[];
  }>;
  creatorLabels: Record<string, string>;
  canMutate: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [feedback, setFeedback] = useState<FinancialOsFeedback | null>(null);
  const [pending, start] = useTransition();

  function runAction(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setFeedback(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        setFeedback({ message: res.error ?? "Request failed.", tone: "error" });
        return;
      }
      setEditingId(null);
      setEditForm(null);
      setFeedback({ message: success, tone: "success" });
    });
  }

  return (
    <div className="space-y-4">
      {feedback ? <FinancialOsFeedbackText message={feedback.message} tone={feedback.tone} /> : null}
      {props.groups.length === 0 ? (
        <p className={financialOsClasses.mutedMeta}>No cost models yet. Create one above to enable profitability snapshots.</p>
      ) : null}
      {props.groups.map((group) => (
        <div key={group.procedure_type} className={financialOsClasses.formPanel}>
          <h3 className={financialOsClasses.formTitle}>{group.procedure_type.toUpperCase()}</h3>
          {group.active ? (
            <div className="mt-3 space-y-2">
              <p className={financialOsClasses.bodyTextXs}>
                Active model · surgeon {group.active.surgeon_cost_type} · duration {group.active.default_duration_minutes}m
              </p>
              {props.canMutate ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={financialOsClasses.secondaryButton}
                    onClick={() => {
                      setEditingId(group.active!.id);
                      setEditForm(formFromModel(group.active!));
                    }}
                  >
                    Edit active model
                  </button>
                  <button
                    type="button"
                    className={financialOsClasses.secondaryButton}
                    onClick={() =>
                      runAction(
                        () => archiveSurgeryCostModelAction(props.tenantId, { model_id: group.active!.id }),
                        "Model archived."
                      )
                    }
                  >
                    Archive
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className={financialOsClasses.warningText}>No active model — snapshots will show Needs Configuration.</p>
          )}

          {editingId === group.active?.id && editForm ? (
            <form
              className="mt-3 grid gap-2 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                runAction(
                  () =>
                    updateSurgeryCostModelAction(props.tenantId, {
                      model_id: group.active!.id,
                      ...payloadFromForm(editForm),
                    }),
                  "Active model updated."
                );
              }}
            >
              <label className={financialOsClasses.formLabel}>
                Surgeon fee value
                <input value={editForm.surgeon_cost_value} onChange={(e) => setEditForm({ ...editForm, surgeon_cost_value: e.target.value })} className={financialOsClasses.input} />
              </label>
              <label className={financialOsClasses.formLabel}>
                Room hourly (AUD)
                <input value={editForm.room_hourly} onChange={(e) => setEditForm({ ...editForm, room_hourly: e.target.value })} className={financialOsClasses.input} />
              </label>
              <button type="submit" disabled={pending} className={financialOsClasses.primaryButton}>Save changes</button>
            </form>
          ) : null}

          {group.history.length ? (
            <div className="mt-4">
              <p className={financialOsClasses.metricLabel}>Previous versions</p>
              <ul className="mt-2 space-y-2 text-xs text-slate-400">
                {group.history.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/[0.06] px-2 py-1.5">
                    <span>
                      Created {new Date(m.created_at).toLocaleString()} · archived{" "}
                      {m.archived_at ? new Date(m.archived_at).toLocaleString() : "—"}
                      {m.created_by_fi_user_id ? ` · ${props.creatorLabels[m.created_by_fi_user_id] ?? m.created_by_fi_user_id}` : ""}
                    </span>
                    {props.canMutate ? (
                      <button
                        type="button"
                        className={financialOsClasses.textButton}
                        onClick={() =>
                          runAction(
                            () => activateSurgeryCostModelAction(props.tenantId, { model_id: m.id }),
                            "Model activated."
                          )
                        }
                      >
                        Activate
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
