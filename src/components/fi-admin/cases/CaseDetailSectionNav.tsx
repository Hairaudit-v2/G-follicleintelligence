"use client";

import { useCallback, useEffect, useState } from "react";
import { CASE_DETAIL_NAV_SECTIONS } from "@/src/lib/cases/caseDetailNavConstants";

const NAV_LINK_CLASS =
  "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors";
const NAV_LINK_IDLE = `${NAV_LINK_CLASS} border-transparent bg-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900`;
const NAV_LINK_ACTIVE = `${NAV_LINK_CLASS} border-gray-900 bg-gray-900 text-white`;

/**
 * Sticky horizontal nav with anchor jumps; highlights the section nearest the top of the viewport.
 */
export function CaseDetailSectionNav() {
  const [activeId, setActiveId] = useState<string>(CASE_DETAIL_NAV_SECTIONS[0]?.id ?? "");

  const updateActive = useCallback(() => {
    const offset = 120;
    let best = CASE_DETAIL_NAV_SECTIONS[0]?.id ?? "";
    let bestTop = Number.POSITIVE_INFINITY;

    for (const { id } of CASE_DETAIL_NAV_SECTIONS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const top = el.getBoundingClientRect().top;
      if (top <= offset && top < bestTop) {
        bestTop = top;
        best = id;
      }
    }

    if (bestTop === Number.POSITIVE_INFINITY) {
      for (let i = CASE_DETAIL_NAV_SECTIONS.length - 1; i >= 0; i--) {
        const { id } = CASE_DETAIL_NAV_SECTIONS[i]!;
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top < window.innerHeight * 0.55) {
          best = id;
          break;
        }
      }
    }

    setActiveId((prev) => (prev === best ? prev : best));
  }, []);

  useEffect(() => {
    updateActive();
    window.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, [updateActive]);

  useEffect(() => {
    const onHash = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (h && CASE_DETAIL_NAV_SECTIONS.some((s) => s.id === h)) setActiveId(h);
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <nav
      aria-label="Patient sections"
      className="sticky top-0 z-30 -mx-1 border-b border-gray-200 bg-white/95 px-1 py-2 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-white/80 md:py-2.5"
    >
      <div className="flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CASE_DETAIL_NAV_SECTIONS.map(({ id, label }) => (
          <a key={id} href={`#${id}`} className={activeId === id ? NAV_LINK_ACTIVE : NAV_LINK_IDLE}>
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}
