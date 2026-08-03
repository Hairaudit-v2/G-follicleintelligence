"use client";

export function TrichoscopyModuleSettingsForm(props: {
  action: (formData: FormData) => void | Promise<void>;
  enabled: boolean;
  settings: {
    allowPatientUploads?: boolean;
    allowClinicCapture?: boolean;
    allowLongitudinalMonitoring?: boolean;
    allowSurgicalPlanning?: boolean;
    allowProcedureDayCapture?: boolean;
    allowPatientReports?: boolean;
    defaultReviewerRole?: string;
    defaultCaptureProtocol?: string;
  };
  subscribedCapabilities: string[];
}) {
  const sub = new Set(props.subscribedCapabilities);
  const canLongitudinal = sub.has("trichoscopy.longitudinal");
  const canSurgical = sub.has("trichoscopy.surgical_planning");
  const canProcedure = sub.has("trichoscopy.procedure_day");
  const canReports = sub.has("trichoscopy.patient_reports");

  return (
    <form action={props.action} className="space-y-4 rounded-xl border border-white/[0.08] bg-[#0F1629]/80 p-4">
      <h2 className="text-sm font-semibold text-slate-200">Module activation</h2>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" name="enabled" defaultChecked={props.enabled} />
        Module enabled for this clinic
      </label>

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Operational capabilities
        </legend>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            name="allowPatientUploads"
            defaultChecked={Boolean(props.settings.allowPatientUploads)}
          />
          Patient uploads
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            name="allowClinicCapture"
            defaultChecked={props.settings.allowClinicCapture !== false}
          />
          Clinic capture
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            name="allowLongitudinalMonitoring"
            defaultChecked={Boolean(props.settings.allowLongitudinalMonitoring)}
            disabled={!canLongitudinal}
          />
          Longitudinal monitoring {!canLongitudinal ? "(not subscribed)" : ""}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            name="allowSurgicalPlanning"
            defaultChecked={Boolean(props.settings.allowSurgicalPlanning)}
            disabled={!canSurgical}
          />
          Surgical planning {!canSurgical ? "(not subscribed)" : ""}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            name="allowProcedureDayCapture"
            defaultChecked={Boolean(props.settings.allowProcedureDayCapture)}
            disabled={!canProcedure}
          />
          Procedure-day capture {!canProcedure ? "(not subscribed)" : ""}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            name="allowPatientReports"
            defaultChecked={Boolean(props.settings.allowPatientReports)}
            disabled={!canReports}
          />
          Patient reports {!canReports ? "(not subscribed)" : ""}
        </label>
      </fieldset>

      <label className="block text-xs text-slate-400">
        Default reviewer role
        <input
          name="defaultReviewerRole"
          defaultValue={props.settings.defaultReviewerRole ?? ""}
          className="mt-1 w-full rounded-lg border border-white/[0.1] bg-[#081020] px-3 py-2 text-sm text-slate-100"
        />
      </label>
      <label className="block text-xs text-slate-400">
        Default capture protocol
        <input
          name="defaultCaptureProtocol"
          defaultValue={props.settings.defaultCaptureProtocol ?? ""}
          className="mt-1 w-full rounded-lg border border-white/[0.1] bg-[#081020] px-3 py-2 text-sm text-slate-100"
        />
      </label>

      <button
        type="submit"
        className="rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 px-3 py-2 text-xs font-semibold text-white"
      >
        Save configuration
      </button>
    </form>
  );
}
