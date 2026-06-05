import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-90";

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
