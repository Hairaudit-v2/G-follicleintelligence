import Link from "next/link";
import type { ComponentProps } from "react";

type QuickActionCardProps = Omit<ComponentProps<typeof Link>, "className"> & {
  title: string;
  description: string;
  className?: string;
};

/**
 * Primary navigation tile — glass card with cyan hover affordance.
 */
export function QuickActionCard({ title, description, className = "", ...link }: QuickActionCardProps) {
  return (
    <Link
      {...link}
      className={
        `group block rounded-2xl border border-white/[0.08] bg-[#0F1629]/70 p-4 shadow-lg shadow-black/30 backdrop-blur-md transition ` +
        `hover:border-[#22C1FF]/35 hover:bg-[#141C33]/90 hover:shadow-cyan-950/20 ` +
        className
      }
    >
      <div className="text-sm font-semibold tracking-tight text-[#F8FAFC] transition group-hover:text-[#22C1FF]">
        {title}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[#94A3B8] group-hover:text-[#94A3B8]/95">{description}</p>
    </Link>
  );
}
