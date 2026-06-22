import Link from "next/link";

import { OnboardingNewSessionClient } from "@/src/components/fi-admin/platform/OnboardingNewSessionClient";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

export const dynamic = "force-dynamic";

export default function OnboardingOsNewPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/fi-admin/platform/onboarding" className="text-sm text-cyan-400 hover:text-cyan-300">
          ← All sessions
        </Link>
        <p className={fiOsChromeClasses.sectionEyebrow}>OnboardingOS · Phase B</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-50">Start tenant provisioning</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Choose a clinic deployment template, review included modules and training tracks, then create a tracked
          provisioning session.
        </p>
      </div>

      <OnboardingNewSessionClient />
    </div>
  );
}
