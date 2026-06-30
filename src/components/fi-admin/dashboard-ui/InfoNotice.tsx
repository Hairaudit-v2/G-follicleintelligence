import type { HTMLAttributes, ReactNode } from "react";

const variants = {
  info: "border-[#22C1FF]/25 bg-[#0F1629]/80 text-[#E0F2FE]",
  success: "border-emerald-500/25 bg-emerald-950/35 text-emerald-100",
  warning: "border-amber-500/25 bg-amber-950/30 text-amber-100",
  danger: "border-rose-500/30 bg-rose-950/40 text-rose-100",
} as const;

type InfoNoticeProps = HTMLAttributes<HTMLDivElement> & {
  variant?: keyof typeof variants;
  title?: string;
  children: ReactNode;
};

/**
 * Inline alert / callout — maps to OS login error/notice tone without copying markup everywhere.
 */
export function InfoNotice({
  variant = "info",
  title,
  children,
  className = "",
  ...rest
}: InfoNoticeProps) {
  const role = variant === "danger" ? "alert" : "status";
  return (
    <div
      role={role}
      className={`rounded-xl border px-4 py-3 text-sm leading-relaxed backdrop-blur-sm ${variants[variant]} ${className}`.trim()}
      {...rest}
    >
      {title ? <p className="mb-1.5 font-semibold text-[#F8FAFC]">{title}</p> : null}
      {children}
    </div>
  );
}
