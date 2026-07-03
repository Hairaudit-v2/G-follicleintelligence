/**
 * FI OS calendar responsive chrome — tablet compact band (~768px–1279px).
 * Desktop full chrome uses Tailwind `xl:` (1280px+).
 */
export const FI_OS_CAL_DESKTOP_PREFIX = "xl:" as const;

/** Hide on tablet compact; show at desktop (`xl+`). */
export const fiOsCalDesktopOnly = "hidden xl:block";

/** Show on tablet compact; hide at desktop (`xl+`). */
export const fiOsCalTabletOnly = "xl:hidden";

/** Horizontal chip/filter rows on tablet — scroll instead of wrap. */
export const fiOsCalTabletChipScroll =
  "flex max-w-full items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:thin] xl:flex-wrap xl:overflow-visible xl:whitespace-normal";

/** Bottom padding so floating Guided Assist does not cover calendar grid / feed rows. */
export const fiOsCalFloatingAssistScrollPad =
  "pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]";

/** Minimum visible grid height on tablet when chrome is stacked. */
export const fiOsCalTabletGridMinHeight =
  "min-h-[min(28rem,calc(100dvh-17rem))] xl:min-h-0";

export function isFiOsCalendarTabletCompactWidth(widthPx: number): boolean {
  return widthPx >= 768 && widthPx < 1280;
}
