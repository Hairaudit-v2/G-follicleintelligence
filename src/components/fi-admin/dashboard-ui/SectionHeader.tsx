type SectionHeaderProps = {
  title: string;
  description?: string;
  id?: string;
  /** Eyebrow label above title (e.g. module name) */
  kicker?: string;
  className?: string;
};

export function SectionHeader({
  title,
  description,
  id,
  kicker,
  className = "",
}: SectionHeaderProps) {
  return (
    <header className={`space-y-0.5 ${className}`.trim()}>
      {kicker ? (
        <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-cyan-400/85">
          {kicker}
        </p>
      ) : null}
      <h2 id={id} className="text-xs font-semibold tracking-tight text-[#F8FAFC] sm:text-sm">
        {title}
      </h2>
      {description ? (
        <p className="max-w-2xl text-[11px] leading-relaxed text-slate-400 sm:text-xs">
          {description}
        </p>
      ) : null}
    </header>
  );
}
