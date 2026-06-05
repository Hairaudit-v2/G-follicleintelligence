import type { Transition, Variants } from "framer-motion";

/** Snappy spring — faster than typical SaaS calendar easing. */
export const calendarSpring: Transition = {
  type: "spring",
  stiffness: 480,
  damping: 34,
  mass: 0.82,
};

export const calendarEaseOut: Transition = { duration: 0.16, ease: [0.22, 1, 0.36, 1] };

export const calendarShellVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: calendarEaseOut },
};

export const calendarColumnVariants: Variants = {
  hidden: { opacity: 0, x: 10 },
  show: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { ...calendarEaseOut, delay: Math.min(i * 0.03, 0.12) },
  }),
};

export const appointmentCardVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: 2 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.14, ease: [0.22, 1, 0.36, 1] } },
  exit: { opacity: 0, scale: 0.98, transition: { duration: 0.1 } },
};

export const emptyStateVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: calendarEaseOut },
};

export const staggerContainerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};
