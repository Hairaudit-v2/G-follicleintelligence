"use client";

import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationFrame,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { useMemo, useRef, useState, useEffect } from "react";

const VIEW_SIZE = 1000;
const CX = 500;
const CY = 500;
const CENTER_R = 100;
const ORBIT_R = 320;
const OUTER_NODE_R = 88;

// Base angles for the three outer nodes (degrees): top, bottom-right, bottom-left
const BASE_ANGLES = [270, 30, 150];

export type EcosystemTheme = "light" | "dark" | "auto";

export interface OuterNodeData {
  id: string;
  title: string;
  subtitle: string;
  detail?: string;
  label: string; // short label on connector, e.g. "STANDARDS"
}

const OUTER_NODES: OuterNodeData[] = [
  {
    id: "iiohr",
    title: "IIOHR™",
    subtitle: "Education & Certification",
    detail: "Training · Standards · Accreditation",
    label: "STANDARDS",
  },
  {
    id: "hairaudit",
    title: "HairAudit™",
    subtitle: "Surgical Audit System",
    detail: "Scoring · Validation · Global Ranking",
    label: "OUTCOMES",
  },
  {
    id: "hli",
    title: "Hair Longevity Institute™",
    subtitle: "Biological Treatment Pathway",
    detail: "Diagnosis · Intervention · Monitoring",
    label: "DATA",
  },
];

function useOrbitAngle(reduceMotion: boolean) {
  const angle = useMotionValue(0);
  useAnimationFrame((_, delta) => {
    if (reduceMotion) return;
    angle.set(angle.get() + (delta / 1000) * 6); // ~360° per 60s
  });
  return angle;
}

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function useOrbitingPosition(
  orbitAngle: MotionValue<number>,
  baseAngle: number,
  reduceMotion: boolean
) {
  return useTransform(orbitAngle, (a) => {
    const angle = reduceMotion ? baseAngle : baseAngle + a;
    return polarToCartesian(CX, CY, ORBIT_R, angle);
  });
}

// ----- Styles (theme-aware) -----
function useThemeColors(resolvedTheme: "light" | "dark") {
  const isDark = resolvedTheme === "dark";
  return useMemo(
    () =>
      isDark
        ? {
            bg: "#0F1B2D",
            ringStroke: "rgba(255,255,255,0.06)",
            lineStroke: "rgba(255,255,255,0.12)",
            lineAnimated: "rgba(198,167,94,0.5)",
            centerFill: "url(#ecosys-gold-center)",
            centerStroke: "#B8984A",
            centerGlow: "rgba(198,167,94,0.35)",
            outerFill: "rgba(255,255,255,0.04)",
            outerStroke: "rgba(255,255,255,0.12)",
            textPrimary: "#D9D9D6",
            textSecondary: "rgba(255,255,255,0.7)",
            textMuted: "rgba(255,255,255,0.5)",
            networkLabel: "rgba(255,255,255,0.4)",
          }
        : {
            bg: "#F9F9F7",
            ringStroke: "#E8E6E0",
            lineStroke: "#D4D2CC",
            lineAnimated: "rgba(166,139,75,0.6)",
            centerFill: "url(#ecosys-gold-center)",
            centerStroke: "#A68B4B",
            centerGlow: "rgba(198,167,94,0.25)",
            outerFill: "#FFFFFF",
            outerStroke: "#E0DED8",
            textPrimary: "#2C2A26",
            textSecondary: "#5C5A56",
            textMuted: "#8A8884",
            networkLabel: "#8A8884",
          },
    [isDark]
  );
}

// Resolve "auto" to "light" | "dark" via system preference
function useResolvedTheme(theme: EcosystemTheme): "light" | "dark" {
  const [resolved, setResolved] = useState<"light" | "dark">("dark");
  useEffect(() => {
    if (theme !== "auto") {
      setResolved(theme);
      return;
    }
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    setResolved(mq.matches ? "light" : "dark");
    const handler = () => setResolved(mq.matches ? "light" : "dark");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);
  return resolved as "light" | "dark";
}

export interface EcosystemDiagramAnimatedProps {
  /** "light" | "dark" | "auto" (follow system). Default "auto". */
  theme?: EcosystemTheme;
  /** Disable orbit and line animation (e.g. for static embed). */
  static?: boolean;
  /** Optional className for the wrapper. */
  className?: string;
  /** Enable click-to-expand for node details. */
  expandable?: boolean;
  /** Accessibility: diagram title. */
  title?: string;
}

export function EcosystemDiagramAnimated({
  theme = "auto",
  static: staticMode = false,
  className = "",
  expandable = false,
  title = "Surgical Intelligence Ecosystem diagram",
}: EcosystemDiagramAnimatedProps) {
  const reduceMotion = useReducedMotion();
  const noAnimation = staticMode || reduceMotion;
  const orbitAngle = useOrbitAngle(!!noAnimation);
  const resolvedTheme = useResolvedTheme(theme);
  const themeForColors: "light" | "dark" =
    resolvedTheme === "light" || resolvedTheme === "dark" ? resolvedTheme : "dark";
  const colors = useThemeColors(themeForColors);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const pos1 = useOrbitingPosition(orbitAngle, BASE_ANGLES[0], !!noAnimation);
  const pos2 = useOrbitingPosition(orbitAngle, BASE_ANGLES[1], !!noAnimation);
  const pos3 = useOrbitingPosition(orbitAngle, BASE_ANGLES[2], !!noAnimation);
  const positions = [pos1, pos2, pos3];

  return (
    <div
      className={`relative w-full max-w-[1000px] mx-auto ${className}`}
      style={{ aspectRatio: "1" }}
      role="img"
      aria-label={title}
    >
      <svg
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        className="w-full h-full select-none"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id="ecosys-gold-center" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C6A75E" />
            <stop offset="100%" stopColor="#A68B4B" />
          </linearGradient>
          <filter id="ecosys-center-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Moving gradient for lines: use for animated stroke */}
          <linearGradient id="ecosys-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor={colors.lineAnimated} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* Background */}
        <rect width={VIEW_SIZE} height={VIEW_SIZE} fill={colors.bg} />

        {/* Outer ring */}
        <circle
          cx={CX}
          cy={CY}
          r={420}
          fill="none"
          stroke={colors.ringStroke}
          strokeWidth={1.5}
          opacity={0.9}
        />
        <text
          x={CX}
          y={945}
          textAnchor="middle"
          fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
          fontSize={13}
          fontWeight={500}
          letterSpacing="0.2em"
          fill={colors.networkLabel}
        >
          GLOBAL HAIR INTELLIGENCE NETWORK
        </text>

        {/* Connector lines: from center edge to each orbiting node */}
        {positions.map((pos, i) => (
          <ConnectorLine
            key={OUTER_NODES[i].id}
            position={pos}
            baseAngle={BASE_ANGLES[i]}
            label={OUTER_NODES[i].label}
            animate={!noAnimation}
            lineStroke={colors.lineStroke}
            lineAnimated={colors.lineAnimated}
            textMuted={colors.textMuted}
          />
        ))}

        {/* Center node */}
        <CenterNode colors={colors} animate={!noAnimation} />

        {/* Outer nodes (orbiting) */}
        {positions.map((pos, i) => {
          const node = OUTER_NODES[i];
          const isExpanded = expandable && expandedId === node.id;
          const isHovered = hoverId === node.id;
          return (
            <OuterNodeGroup
              key={node.id}
              position={pos}
              baseAngle={BASE_ANGLES[i]}
              node={node}
              colors={colors}
              isExpanded={isExpanded}
              isHovered={isHovered}
              expandable={expandable}
              onHover={() => setHoverId(node.id)}
              onLeave={() => setHoverId(null)}
              onClick={() => expandable && setExpandedId((id) => (id === node.id ? null : node.id))}
            />
          );
        })}
      </svg>
    </div>
  );
}

// ----- Center node: pulse + glow -----
function CenterNode({
  colors,
  animate,
}: {
  colors: ReturnType<typeof useThemeColors>;
  animate: boolean;
}) {
  return (
    <g filter={animate ? "url(#ecosys-center-glow)" : undefined}>
      <motion.circle
        cx={CX}
        cy={CY}
        r={CENTER_R}
        fill={colors.centerFill}
        stroke={colors.centerStroke}
        strokeWidth={1.5}
        initial={false}
        animate={
          animate
            ? {
                scale: [1, 1.03, 1],
                opacity: [0.95, 1, 0.95],
              }
            : { scale: 1, opacity: 1 }
        }
        transition={
          animate
            ? { duration: 3, repeat: Infinity, ease: "easeInOut" as const }
            : { duration: 0 }
        }
        style={{
          filter: animate ? `drop-shadow(0 0 12px ${colors.centerGlow})` : undefined,
        }}
      />
      <text
        x={CX}
        y={485}
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontSize={18}
        fontWeight={600}
        fill={colors.textPrimary}
      >
        Follicle Intelligence™
      </text>
      <text
        x={CX}
        y={508}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize={12}
        fontWeight={500}
        fill={colors.textPrimary}
        opacity={0.9}
      >
        AI Analysis Engine
      </text>
      <text
        x={CX}
        y={532}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize={10}
        fill={colors.textPrimary}
        opacity={0.7}
      >
        Data · Pattern Recognition · Prediction
      </text>
    </g>
  );
}

// ----- Connector line with optional dash animation -----
function ConnectorLine({
  position,
  baseAngle,
  label,
  animate,
  lineStroke,
  lineAnimated,
  textMuted,
}: {
  position: MotionValue<{ x: number; y: number }>;
  baseAngle: number;
  label: string;
  animate: boolean;
  lineStroke: string;
  lineAnimated: string;
  textMuted: string;
}) {
  const ref = useRef<SVGLineElement>(null);
  const [end, setEnd] = useState(() => polarToCartesian(CX, CY, ORBIT_R, baseAngle));

  // Start point: center edge toward the moving end (so line doesn't cross center circle)
  const start = useMemo(() => {
    const dx = end.x - CX;
    const dy = end.y - CY;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    return { x: CX + ux * CENTER_R, y: CY + uy * CENTER_R };
  }, [end]);

  // Subscribe to position for line end
  const unsub = useRef<(() => void) | null>(null);
  useMemo(() => {
    unsub.current?.();
    unsub.current = position.on("change", (v) => setEnd(v));
    return () => {
      unsub.current?.();
    };
  }, [position]);

  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  return (
    <g>
      <line
        ref={ref}
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={lineStroke}
        strokeWidth={1.2}
      />
      {animate && (
        <motion.line
          x1={start.x}
          y1={start.y}
          x2={end.x}
          y2={end.y}
          stroke={lineAnimated}
          strokeWidth={1.5}
          strokeDasharray="8 24"
          initial={{ strokeDashoffset: 0 }}
          animate={{ strokeDashoffset: -32 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      )}
      <text
        x={midX}
        y={midY}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize={10}
        fill={textMuted}
        letterSpacing="0.12em"
      >
        {label}
      </text>
    </g>
  );
}

// ----- Outer node group (orbiting circle + text + tooltip) -----
function OuterNodeGroup({
  position,
  baseAngle,
  node,
  colors,
  isExpanded,
  isHovered,
  expandable,
  onHover,
  onLeave,
  onClick,
}: {
  position: MotionValue<{ x: number; y: number }>;
  baseAngle: number;
  node: OuterNodeData;
  colors: ReturnType<typeof useThemeColors>;
  isExpanded: boolean;
  isHovered: boolean;
  expandable: boolean;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const [coords, setCoords] = useState(() => polarToCartesian(CX, CY, ORBIT_R, baseAngle));
  const unsub = useRef<(() => void) | null>(null);
  useMemo(() => {
    unsub.current?.();
    unsub.current = position.on("change", setCoords);
    return () => unsub.current?.();
  }, [position]);

  return (
    <motion.g
      transform={`translate(${coords.x}, ${coords.y})`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{ cursor: expandable ? "pointer" : "default" }}
    >
      <motion.circle
        r={OUTER_NODE_R}
        fill={colors.outerFill}
        stroke={colors.outerStroke}
        strokeWidth={1.5}
        initial={false}
        animate={{
          scale: isHovered || isExpanded ? 1.08 : 1,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      />
      <text
        y={node.id === "hli" ? -18 : -5}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize={node.id === "hli" ? 14 : 16}
        fontWeight={600}
        fill={colors.textPrimary}
      >
        {node.id === "hli" ? (
          <>
            <tspan x={0} dy={0}>
              Hair Longevity
            </tspan>
            <tspan x={0} dy={17}>
              Institute™
            </tspan>
          </>
        ) : (
          node.title
        )}
      </text>
      <text y={node.id === "hli" ? 12 : 15} textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize={11} fontWeight={500} fill={colors.textSecondary}>
        {node.subtitle}
      </text>
      <text y={node.id === "hli" ? 32 : 35} textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize={9} fill={colors.textMuted}>
        {node.detail}
      </text>
      {/* Tooltip on hover */}
      {(isHovered || isExpanded) && (
        <motion.g
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{ pointerEvents: "none" }}
        >
          <rect
            x={-OUTER_NODE_R - 8}
            y={-OUTER_NODE_R - 50}
            width={(OUTER_NODE_R + 8) * 2}
            height={44}
            rx={8}
            fill={colors.bg}
            stroke={colors.outerStroke}
            strokeWidth={1}
          />
          <text y={-OUTER_NODE_R - 24} textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize={11} fill={colors.textPrimary}>
            {expandable && isExpanded ? "Click to collapse" : node.title}
          </text>
        </motion.g>
      )}
    </motion.g>
  );
}

export default EcosystemDiagramAnimated;
