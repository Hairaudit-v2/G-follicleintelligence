import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

type QuickActionCardProps = Omit<ComponentProps<typeof Link>, "className"> & {
  title: string;
  description: string;
  /** Optional leading icon (e.g. lucide-react), tinted cyan */
  icon?: ReactNode;
  className?: string;
};

/**
 * Primary navigation tile — glass card with cyan hover affordance, optional lift on hover.
 */
export function QuickActionCard({ title, description, icon, className, ...link }: QuickActionCardProps) {
  return (
    <Link
      {...link}
      className={cn(
        "group block rounded-2xl border border-white/[0.08] bg-[#0F1629]/70 p-4 shadow-lg shadow-black/30 backdrop-blur-md",
        "transition duration-200 ease-out will-change-transform",
        "hover:-translate-y-0.5 hover:border-[#22C1FF]/40 hover:bg-[#141C33]/90 hover:shadow-xl hover:shadow-cyan-500/15",
        className,
      )}
    >
      {icon ? (
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-[#22C1FF]/20 bg-[#22C1FF]/10 text-[#22C1FF] transition group-hover:border-[#22C1FF]/45 group-hover:bg-[#22C1FF]/18 group-hover:shadow-[0_0_20px_rgba(34,193,255,0.25)]">
          {icon}
        </span>
      ) : null}
      <div className="text-sm font-semibold tracking-tight text-[#F8FAFC] transition group-hover:text-[#22C1FF] sm:text-base">
        {title}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-[#94A3B8] group-hover:text-[#CBD5E1]">{description}</p>
    </Link>
  );
}
