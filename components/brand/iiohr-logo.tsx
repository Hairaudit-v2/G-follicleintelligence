import { useId, type SVGProps } from "react";

import { cn } from "@/lib/utils";

type LogoTone = "light" | "dark";

interface LogoProps extends SVGProps<SVGSVGElement> {
  tone?: LogoTone;
}

const WORDMARK_FONT =
  "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, ui-serif, serif";

function getPalette(tone: LogoTone) {
  if (tone === "light") {
    return {
      ink: "#12202B",
      accent: "#A57B33",
    };
  }

  return {
    ink: "#F4EEE2",
    accent: "#B89A52",
  };
}

interface SealArtworkProps {
  idPrefix: string;
  tone: LogoTone;
}

function SealArtwork({ idPrefix, tone }: SealArtworkProps) {
  const palette = getPalette(tone);

  return (
    <>
      <defs>
        <path id={`${idPrefix}-top`} d="M 86 256 A 170 170 0 0 1 426 256" />
        <path id={`${idPrefix}-bottom`} d="M 426 256 A 170 170 0 0 1 86 256" />
      </defs>

      <circle cx="256" cy="256" r="222" stroke={palette.ink} strokeWidth="18" />
      <circle cx="256" cy="256" r="190" stroke={palette.ink} strokeOpacity="0.68" strokeWidth="5" />

      <text
        fill={palette.ink}
        fontFamily={WORDMARK_FONT}
        fontSize="24"
        fontWeight="700"
        letterSpacing="6.5"
      >
        <textPath href={`#${idPrefix}-top`} startOffset="50%" textAnchor="middle">
          INTERNATIONAL INSTITUTE
        </textPath>
      </text>

      <text
        fill={palette.ink}
        fontFamily={WORDMARK_FONT}
        fontSize="24"
        fontWeight="700"
        letterSpacing="6"
      >
        <textPath href={`#${idPrefix}-bottom`} startOffset="50%" textAnchor="middle">
          HAIR RESTORATION
        </textPath>
      </text>

      <circle cx="104" cy="256" r="9" fill={palette.accent} />
      <circle cx="408" cy="256" r="9" fill={palette.accent} />

      <path
        d="M256 132C206 132 170 172 170 228V267C170 330 205 384 256 416C307 384 342 330 342 267V228C342 172 306 132 256 132Z"
        fill="none"
        stroke={palette.ink}
        strokeLinejoin="round"
        strokeWidth="16"
      />
      <path
        d="M208 204H304"
        fill="none"
        stroke={palette.accent}
        strokeLinecap="round"
        strokeWidth="12"
      />
      <path
        d="M220 216C220 262 232 302 256 338C280 302 292 262 292 216"
        fill="none"
        stroke={palette.accent}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="14"
      />
      <path
        d="M256 166V315"
        fill="none"
        stroke={palette.ink}
        strokeLinecap="round"
        strokeWidth="12"
      />
      <circle cx="256" cy="350" r="17" fill={palette.ink} />
    </>
  );
}

export function IiohrSeal({ tone = "dark", className, ...props }: LogoProps) {
  const id = useId().replace(/:/g, "");

  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      className={cn("h-auto w-full", className)}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <SealArtwork idPrefix={`iiohr-seal-${id}`} tone={tone} />
    </svg>
  );
}

export function IiohrFullLockup({ tone = "dark", className, ...props }: LogoProps) {
  const id = useId().replace(/:/g, "");
  const palette = getPalette(tone);

  return (
    <svg
      viewBox="0 0 720 640"
      fill="none"
      className={cn("h-auto w-full", className)}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g transform="translate(175 24) scale(0.72)">
        <SealArtwork idPrefix={`iiohr-full-${id}`} tone={tone} />
      </g>

      <line x1="178" y1="410" x2="542" y2="410" stroke={palette.accent} strokeOpacity="0.85" strokeWidth="2" />
      <text
        x="360"
        y="472"
        fill={palette.ink}
        fontFamily={WORDMARK_FONT}
        fontSize="44"
        fontWeight="700"
        letterSpacing="7.5"
        textAnchor="middle"
      >
        INTERNATIONAL INSTITUTE
      </text>
      <text
        x="360"
        y="546"
        fill={palette.ink}
        fontFamily={WORDMARK_FONT}
        fontSize="56"
        fontWeight="700"
        letterSpacing="6"
        textAnchor="middle"
      >
        OF HAIR RESTORATION
      </text>
    </svg>
  );
}

export function IiohrAcronymLockup({ tone = "dark", className, ...props }: LogoProps) {
  const id = useId().replace(/:/g, "");
  const palette = getPalette(tone);

  return (
    <svg
      viewBox="0 0 820 560"
      fill="none"
      className={cn("h-auto w-full", className)}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g transform="translate(278 24) scale(0.52)">
        <SealArtwork idPrefix={`iiohr-acronym-${id}`} tone={tone} />
      </g>

      <text
        x="410"
        y="338"
        fill={palette.ink}
        fontFamily={WORDMARK_FONT}
        fontSize="120"
        fontWeight="700"
        letterSpacing="12"
        textAnchor="middle"
      >
        IIOHR
      </text>
      <line x1="188" y1="374" x2="632" y2="374" stroke={palette.accent} strokeOpacity="0.85" strokeWidth="2" />
      <text
        x="410"
        y="430"
        fill={palette.ink}
        fontFamily={WORDMARK_FONT}
        fontSize="34"
        fontWeight="700"
        letterSpacing="6"
        textAnchor="middle"
      >
        INTERNATIONAL INSTITUTE
      </text>
      <text
        x="410"
        y="486"
        fill={palette.ink}
        fontFamily={WORDMARK_FONT}
        fontSize="40"
        fontWeight="700"
        letterSpacing="4.5"
        textAnchor="middle"
      >
        OF HAIR RESTORATION
      </text>
    </svg>
  );
}

export function IiohrHorizontalLockup({ tone = "dark", className, ...props }: LogoProps) {
  const id = useId().replace(/:/g, "");
  const palette = getPalette(tone);

  return (
    <svg
      viewBox="0 0 1460 430"
      fill="none"
      className={cn("h-auto w-full", className)}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <g transform="translate(18 28) scale(0.72)">
        <SealArtwork idPrefix={`iiohr-horizontal-${id}`} tone={tone} />
      </g>

      <text
        x="472"
        y="116"
        fill={palette.accent}
        fontFamily={WORDMARK_FONT}
        fontSize="30"
        fontWeight="700"
        letterSpacing="9"
      >
        IIOHR
      </text>
      <line x1="472" y1="138" x2="1370" y2="138" stroke={palette.accent} strokeOpacity="0.7" strokeWidth="2" />
      <text
        x="472"
        y="230"
        fill={palette.ink}
        fontFamily={WORDMARK_FONT}
        fontSize="58"
        fontWeight="700"
        letterSpacing="7"
      >
        INTERNATIONAL INSTITUTE
      </text>
      <text
        x="472"
        y="318"
        fill={palette.ink}
        fontFamily={WORDMARK_FONT}
        fontSize="74"
        fontWeight="700"
        letterSpacing="6"
      >
        OF HAIR RESTORATION
      </text>
    </svg>
  );
}
