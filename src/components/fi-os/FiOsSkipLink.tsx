/**
 * Visually hidden until keyboard focus — jumps to FI OS main content.
 */
export function FiOsSkipLink({ targetId = "fi-os-main-content" }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[200] focus:m-0 focus:h-auto focus:w-auto focus:overflow-visible focus:whitespace-normal focus:rounded-lg focus:bg-cyan-600 focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-cyan-400/60 focus:[clip:auto]"
    >
      Skip to main content
    </a>
  );
}
