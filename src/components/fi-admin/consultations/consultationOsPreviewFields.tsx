import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ConsultationOsSectionBinder = {
  values: Record<string, string>;
  onFieldChange: (fieldKey: string, value: string) => void;
  disabled?: boolean;
};

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-90";

const editableInputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm outline-none ring-sky-400/20 focus-visible:border-sky-300 focus-visible:ring-2";

const labelClass = "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500";

export function LabeledDisabledInput({
  id,
  label,
  defaultValue = "",
  placeholder = "—",
  className,
}: {
  id: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        disabled
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );
}

export function LabeledTextInput({
  id,
  label,
  value,
  onChange,
  placeholder = "",
  className,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn(className)}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(editableInputClass, disabled && "cursor-not-allowed bg-slate-50 opacity-80")}
      />
    </div>
  );
}

export function LabeledTextarea({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  className,
  rows = 8,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  hint?: ReactNode;
  className?: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(editableInputClass, "min-h-[10rem] resize-y", disabled && "cursor-not-allowed bg-slate-50 opacity-80")}
      />
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function LabeledDisabledTextarea({
  id,
  label,
  placeholder,
  hint,
  className,
}: {
  id: string;
  label: string;
  placeholder: string;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea
        id={id}
        name={id}
        disabled
        rows={8}
        placeholder={placeholder}
        className={cn(inputClass, "min-h-[10rem] resize-y")}
      />
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
