import Link from "next/link";

import { cn } from "@/lib/utils";
import type { ResolvedDashboardQuickAction } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { DashboardQuickLeadBarButton } from "@/src/components/fi-admin/dashboard/DashboardQuickLeadBarButton";

const compactControl = cn(
  fiOsChromeClasses.toolbarControlSurface,
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-semibold text-cyan-50",
);

function PlusPrefix() {
  return (
    <span className="text-cyan-400/90" aria-hidden>
      +
    </span>
  );
}

export function DashboardQuickActionsBar(props: { items: readonly ResolvedDashboardQuickAction[] }) {
  const { items } = props;

  return (
    <section aria-labelledby="dash-quick-actions-bar-heading" className="min-w-0">
      <h2 id="dash-quick-actions-bar-heading" className="sr-only">
        Quick actions
      </h2>
      <div className="-mx-1 flex min-h-[2.5rem] flex-wrap items-center gap-2 px-1 sm:gap-2.5">
        {items.map((item) => {
          const label = item.label.trim();

          if (item.kind === "modal_create_lead") {
            if (item.enabled) {
              return <DashboardQuickLeadBarButton key={item.key} label={label} />;
            }
            return (
              <span
                key={item.key}
                title={item.disabledReason}
                className={cn(compactControl, "cursor-not-allowed opacity-50")}
                aria-disabled="true"
              >
                <PlusPrefix />
                {label}
              </span>
            );
          }

          if (item.enabled) {
            return (
              <Link key={item.key} href={item.href} className={compactControl}>
                <PlusPrefix />
                {label}
              </Link>
            );
          }

          return (
            <span
              key={item.key}
              title={item.disabledReason}
              className={cn(compactControl, "cursor-not-allowed opacity-50")}
              aria-disabled="true"
            >
              <PlusPrefix />
              {label}
            </span>
          );
        })}
      </div>
    </section>
  );
}
