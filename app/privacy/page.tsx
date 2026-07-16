import Link from "next/link";

import { Section } from "@/components/layout/section";
import { FadeIn } from "@/components/ui/fade-in";
import { buildPageMetadata } from "@/lib/seo/page-metadata";

export const metadata = buildPageMetadata({
  title: "Privacy Policy | Follicle Intelligence",
  description:
    "How Follicle Intelligence handles information submitted through public enquiry forms and website interactions.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border/40 bg-[#040810]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_-10%,rgb(212_175_55_/0.12),transparent_45%)]" />
        <div className="relative mx-auto max-w-3xl px-4 py-20 sm:px-6 sm:py-28">
          <FadeIn>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200/80">
              Privacy
            </p>
            <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Privacy policy
            </h1>
            <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
              This summary explains how we handle information submitted through public pages on
              follicleintelligence.ai, including the Platform and Migration Review enquiry form.
            </p>
          </FadeIn>
        </div>
      </section>

      <Section className="py-16 sm:py-20">
        <FadeIn>
          <div className="mx-auto max-w-3xl space-y-8 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">
                What we collect on the enquiry form
              </h2>
              <p className="mt-3">
                Contact details, organisation information, high-level clinic profile metrics, current
                system names, priorities and optional free-text context you choose to provide.
              </p>
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">What not to send</h2>
              <p className="mt-3">
                Do not include patient names, medical records, clinical photographs, credentials, API
                keys, database exports or other sensitive operational secrets. Migration and technical
                access are assessed separately after an initial discussion.
              </p>
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">How we use it</h2>
              <p className="mt-3">
                Enquiry information is used to respond to your request, prepare a focused platform and
                migration discussion, and improve how we route enterprise conversations. We do not sell
                this information.
              </p>
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">Retention</h2>
              <p className="mt-3">
                We retain enquiry correspondence for as long as needed to manage the relationship and
                meet legitimate business and legal requirements, then delete or archive it according to
                internal retention practice.
              </p>
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold text-foreground">Contact</h2>
              <p className="mt-3">
                Privacy questions:{" "}
                <a
                  href="mailto:hello@follicleintelligence.ai?subject=Privacy%20enquiry"
                  className="font-semibold text-amber-100/90 underline decoration-amber-400/40 underline-offset-2"
                >
                  hello@follicleintelligence.ai
                </a>
                . Security overview:{" "}
                <Link
                  href="/security"
                  className="font-semibold text-amber-100/90 underline decoration-amber-400/40 underline-offset-2"
                >
                  /security
                </Link>
                .
              </p>
            </div>
            <p className="text-xs text-muted-foreground/80">Last updated: 16 July 2026</p>
          </div>
        </FadeIn>
      </Section>
    </>
  );
}
