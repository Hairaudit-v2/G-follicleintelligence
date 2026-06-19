"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeft, MonitorPlay } from "lucide-react";

import { formatAlertTimestamp } from "@/src/components/fi-admin/enterprise-demo/globalCommandCentreUi";
import { globalCommandCentrePresentationClasses as pc } from "@/src/components/fi-admin/enterprise-demo/globalCommandCentrePresentationUi";
import type { GlobalCommandCentrePayload } from "@/src/lib/enterprise-demo/enterpriseDemoGlobalCommandCentreLoader.server";
import {
  buildGlobalCommandCentrePresentationView,
  type PresentationStorySection,
  type PresentationStorySectionId,
} from "@/src/lib/enterprise-demo/enterpriseDemoGlobalCommandCentrePresentationModel";

type GlobalCommandCentrePresentationProps = {
  data: GlobalCommandCentrePayload;
  dashboardHref: string;
};

function StorySectionBlock({ section }: { section: PresentationStorySection }) {
  return (
    <section
      id={`titan-story-${section.id}`}
      className={pc.storySection}
      aria-labelledby={`titan-story-title-${section.id}`}
    >
      <p className={pc.storyIndex}>
        {String(section.index).padStart(2, "0")} · Executive story
      </p>
      <h2 id={`titan-story-title-${section.id}`} className={pc.storyTitle}>
        {section.title}
      </h2>
      <p className={pc.storySubtitle}>{section.subtitle}</p>
      <p className={pc.storyNarrative}>{section.narrative}</p>
      <div className={pc.highlightGrid}>
        {section.highlights.map((highlight) => (
          <div key={`${section.id}-${highlight.label}`} className={pc.highlightTile}>
            <div className={pc.highlightLabel}>{highlight.label}</div>
            <div className={pc.highlightValue}>{highlight.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function GlobalCommandCentrePresentation({ data, dashboardHref }: GlobalCommandCentrePresentationProps) {
  const view = useMemo(() => buildGlobalCommandCentrePresentationView(data), [data]);
  const [activeSectionId, setActiveSectionId] = useState<PresentationStorySectionId>("network_health");

  const scrollToSection = useCallback((sectionId: PresentationStorySectionId) => {
    setActiveSectionId(sectionId);
    document.getElementById(`titan-story-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className={pc.root}>
      <div className={pc.backdrop} aria-hidden />

      <header className={pc.topBar}>
        <div className="min-w-0">
          <p className={pc.brandKicker}>
            {data.codename} · Presentation mode
          </p>
          <h1 className={pc.brandTitle}>{data.tenantName}</h1>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className={pc.badge}>Phase 1H</span>
          <span className={pc.badge}>Read-only demo</span>
          <Link href={dashboardHref} className={pc.exitLink}>
            <ArrowLeft className="mr-1.5 inline h-3.5 w-3.5" aria-hidden />
            Exit presentation
          </Link>
        </div>
      </header>

      <div className={pc.painStrip} aria-label="Operator pain callouts">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          <MonitorPlay className="h-3.5 w-3.5 text-amber-400/70" aria-hidden />
          Operator pain · franchise exposure
        </div>
        <div className={pc.painGrid}>
          {view.painCallouts.map((callout) => (
            <article key={callout.id} className={pc.painCard(callout.severity)}>
              <h3 className={pc.painTitle}>{callout.title}</h3>
              <p className={pc.painHeadline}>{callout.headline}</p>
              <p className={pc.painMetric}>{callout.metric}</p>
            </article>
          ))}
        </div>
      </div>

      <nav className={pc.sectionNav} aria-label="Story sections">
        {view.sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className={pc.sectionDot(activeSectionId === section.id)}
            aria-label={`Go to ${section.title}`}
            aria-current={activeSectionId === section.id ? "true" : undefined}
            onClick={() => scrollToSection(section.id)}
          />
        ))}
      </nav>

      <main className={pc.main}>
        {view.sections.map((section) => (
          <StorySectionBlock key={section.id} section={section} />
        ))}
      </main>

      <footer className={pc.footer}>
        Read-only presentation · {data.todayYmd} · Generated {formatAlertTimestamp(data.generatedAt)} ·{" "}
        {data.networkKpis.activeClinics} clinics simulated
      </footer>
    </div>
  );
}
