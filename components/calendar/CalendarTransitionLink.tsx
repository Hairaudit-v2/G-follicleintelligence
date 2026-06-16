"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, type ComponentProps, type MouseEvent } from "react";

import { pushCalendarHref } from "@/lib/calendar/calendarRouterTransition";

type CalendarTransitionLinkProps = Omit<ComponentProps<typeof Link>, "onClick"> & {
  onClick?: ComponentProps<typeof Link>["onClick"];
};

/**
 * Same as {@link Link} for prefetch/href, but primary-click navigations use
 * {@link pushCalendarHref} inside `startTransition` to reduce INP on the calendar shell.
 */
export function CalendarTransitionLink({ href, onClick, ...rest }: CalendarTransitionLinkProps) {
  const router = useRouter();
  const hrefStr = typeof href === "string" ? href : "";

  const handleClick = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!hrefStr.startsWith("/")) return;

      e.preventDefault();
      pushCalendarHref(router, hrefStr);
    },
    [hrefStr, onClick, router]
  );

  return <Link href={href} onClick={handleClick} {...rest} />;
}
