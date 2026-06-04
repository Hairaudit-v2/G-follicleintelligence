type SectionHeaderProps = {
  title: string;
  description?: string;
  id?: string;
  /** Eyebrow label above title (e.g. module name) */
  kicker?: string;
  className?: string;
};

export function SectionHeader({ title, description, id, kicker, className = "" }: SectionHeaderProps) {
  return (
    <header className={`space-y-1 ${className}`.trim()}>
      {kicker ? (
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-[#22C1FF]/90">{kicker}</p>
      ) : null}
      <h2 id={id} className="text-sm font-semibold tracking-tight text-[#F8FAFC] sm:text-base">
        {title}
      </h2>
      {description ? <p className="max-w-2xl text-xs leading-relaxed text-[#94A3B8] sm:text-sm">{description}</p> : null}
    </header>
  );
}
