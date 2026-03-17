"use client";

import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationFrame,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

const VIEW_SIZE = 1000;
const CX = 500;
const CY = 500;
const CENTER_R = 100;
const ORBIT_R = 320;
const OUTER_NODE_R = 88;

// Base angles (degrees): top = IIOHR, bottom-right = HairAudit, bottom-left = HLI
const BASE_ANGLES = [270, 30, 150];

export type GlobalNetworkTheme = "light" | "dark" | "auto";
export type GlobalNetworkVariant = "hli" | "hairaudit" | "fi" | "iiohr";
export type GlobalNetworkNodeId = "hli" | "hairaudit" | "fi" | "iiohr";

export interface OuterNodeData {
  id: GlobalNetworkNodeId;
  title: string;
  subtitle: string;
  detail: string;
  label: string;
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

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function useOrbitAngle(reduceMotion: boolean) {
  const angle = useMotionValue(0);
  useAnimationFrame((_, delta) => {
    if (reduceMotion) return;
    angle.set(angle.get() + (delta / 1000) * 6);
  });
  return angle;
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

type ThemeColors = ReturnType<typeof getThemeColors>;

function getThemeColors(resolvedTheme: "light" | "dark") {
  const isDark = resolvedTheme === "dark";
  return isDark
    ? {
        bg: "#0F1B2D",
        ringStroke: "rgba(255,255,255,0.06)",
        lineStroke: "rgba(255,255,255,0.12)",
        lineAnimated: "rgba(198,167,94,0.5)",
        centerFill: "url(#ghin-gold-center)",
        centerStroke: "#B8984A",
        centerGlow: "rgba(198,167,94,0.35)",
        outerFill: "rgba(255,255,255,0.04)",
        outerStroke: "rgba(255,255,255,0.12)",
        outerHighlightStroke: "rgba(198,167,94,0.6)",
        textPrimary: "#D9D9D6",
        textSecondary: "rgba(255,255,255,0.7)",
        textMuted: "rgba(255,255,255,0.5)",
        networkLabel: "rgba(255,255,255,0.4)",
      }
    : {
        bg: "#F9F9F7",
        ringStroke: "#B8B4AC",
        lineStroke: "#7A7872",
        lineAnimated: "rgba(139,115,64,0.85)",
        centerFill: "url(#ghin-gold-center)",
        centerStroke: "#8B7340",
        centerGlow: "rgba(166,139,75,0.35)",
        outerFill: "#FFFFFF",
        outerStroke: "#9A9892",
        outerHighlightStroke: "rgba(139,115,64,0.9)",
        textPrimary: "#1A1917",
        textSecondary: "#3D3B38",
        textMuted: "#5C5A56",
        networkLabel: "#5C5A56",
      };
}

function useResolvedTheme(theme: GlobalNetworkTheme): "light" | "dark" {
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
  return resolved;
}

export interface GlobalHairIntelligenceNetworkProps {
  theme?: GlobalNetworkTheme;
  variant?: GlobalNetworkVariant;
  highlightNode?: GlobalNetworkNodeId;
  static?: boolean;
  interactive?: boolean;
  expandable?: boolean;
  showBackground?: boolean;
  className?: string;
  title?: string;
  nodeLinks?: Partial<Record<GlobalNetworkNodeId, string>>;
  /** "hero" = square, larger; "compact" = smaller text, fits in narrow sections */
  size?: "hero" | "compact";
}

const DEFAULT_TITLE = "Global Hair Intelligence Network";

export function GlobalHairIntelligenceNetwork({
  theme = "auto",
  variant = "hli",
  highlightNode: highlightNodeProp,
  static: staticMode = false,
  interactive = true,
  expandable = false,
  showBackground = false,
  className = "",
  title = DEFAULT_TITLE,
  nodeLinks,
  size = "hero",
}: GlobalHairIntelligenceNetworkProps) {
  const reduceMotion = useReducedMotion();
  const noAnimation = staticMode || !!reduceMotion;
  const orbitAngle = useOrbitAngle(!!noAnimation);
  const resolvedTheme = useResolvedTheme(theme);
  const colors = useMemo(() => getThemeColors(resolvedTheme), [resolvedTheme]);

  const highlightNode = highlightNodeProp ?? variant;
  const [expandedId, setExpandedId] = useState<GlobalNetworkNodeId | null>(null);
  const [hoverId, setHoverId] = useState<GlobalNetworkNodeId | null>(null);

  const pos1 = useOrbitingPosition(orbitAngle, BASE_ANGLES[0], !!noAnimation);
  const pos2 = useOrbitingPosition(orbitAngle, BASE_ANGLES[1], !!noAnimation);
  const pos3 = useOrbitingPosition(orbitAngle, BASE_ANGLES[2], !!noAnimation);
  const positions = useMemo(() => [pos1, pos2, pos3], [pos1, pos2, pos3]);

  const defsId = useRef(`ghin-${Math.random().toString(36).slice(2, 9)}`).current;

  return (
    <div
      className={`relative mx-auto w-full max-w-[1000px] min-h-[520px] overflow-visible md:min-h-[640px] lg:min-h-[720px] ${className}`}
      style={{ aspectRatio: "1" }}
      role="img"
      aria-label={title}
    >
      <svg
        viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full select-none"
        style={{ overflow: "visible" }}
      >
        <defs>
          <linearGradient id={`${defsId}-gold`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C6A75E" />
            <stop offset="100%" stopColor="#A68B4B" />
          </linearGradient>
          <filter id={`${defsId}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {showBackground && (
          <rect width={VIEW_SIZE} height={VIEW_SIZE} fill={colors.bg} />
        )}

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
          fontSize={size === "compact" ? 11 : 13}
          fontWeight={500}
          letterSpacing="0.2em"
          fill={colors.networkLabel}
        >
          GLOBAL HAIR INTELLIGENCE NETWORK
        </text>

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

        <CenterNode
          colors={colors}
          animate={!noAnimation}
          isHighlight={highlightNode === "fi"}
          defsId={defsId}
          size={size}
          hasLink={Boolean(nodeLinks?.fi)}
          onClick={nodeLinks?.fi ? () => window.open(nodeLinks!.fi) : undefined}
          onMouseEnter={interactive ? () => setHoverId("fi") : undefined}
          onMouseLeave={interactive ? () => setHoverId(null) : undefined}
        />

        {positions.map((pos, i) => {
          const node = OUTER_NODES[i];
          const isExpanded = expandable && expandedId === node.id;
          const isHovered = hoverId === node.id;
          const isHighlight = highlightNode === node.id;
          const href = nodeLinks?.[node.id];
          return (
            <OuterNodeGroup
              key={node.id}
              position={pos}
              baseAngle={BASE_ANGLES[i]}
              node={node}
              colors={colors}
              isExpanded={isExpanded}
              isHovered={isHovered}
              isHighlight={isHighlight}
              expandable={expandable}
              interactive={interactive}
              size={size}
              href={href}
              onHover={() => setHoverId(node.id)}
              onLeave={() => setHoverId(null)}
              onClick={() => {
                if (href) window.open(href);
                else if (expandable) setExpandedId((id) => (id === node.id ? null : node.id));
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

// —— Center node (Follicle Intelligence) ——
function CenterNode({
  colors,
  animate,
  isHighlight,
  defsId,
  size,
  hasLink,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: {
  colors: ThemeColors;
  animate: boolean;
  isHighlight: boolean;
  defsId: string;
  size: "hero" | "compact";
  hasLink: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const fontSizeTitle = size === "compact" ? 16 : 18;
  const fontSizeSub = size === "compact" ? 10 : 12;
  const fontSizeDetail = size === "compact" ? 9 : 10;

  return (
    <g
      filter={animate ? `url(#${defsId}-glow)` : undefined}
      style={{ cursor: hasLink ? "pointer" : "default" }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <motion.circle
        cx={CX}
        cy={CY}
        r={CENTER_R}
        fill={`url(#${defsId}-gold)`}
        stroke={isHighlight ? colors.outerHighlightStroke : colors.centerStroke}
        strokeWidth={isHighlight ? 2.5 : 1.5}
        initial={false}
        animate={
          animate
            ? { scale: [1, 1.03, 1], opacity: [0.95, 1, 0.95] }
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
        fontSize={fontSizeTitle}
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
        fontSize={fontSizeSub}
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
        fontSize={fontSizeDetail}
        fill={colors.textPrimary}
        opacity={0.7}
      >
        Data · Pattern Recognition · Prediction
      </text>
    </g>
  );
}

// —— Connector line: subscribe to position via useEffect ——
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
  const [end, setEnd] = useState(() => polarToCartesian(CX, CY, ORBIT_R, baseAngle));

  useEffect(() => {
    const unsubscribe = position.on("change", setEnd);
    return () => unsubscribe();
  }, [position]);

  const start = useMemo(() => {
    const dx = end.x - CX;
    const dy = end.y - CY;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    return { x: CX + ux * CENTER_R, y: CY + uy * CENTER_R };
  }, [end]);

  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  return (
    <g>
      <line
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

// —— Outer node group: subscribe to position via useEffect ——
function OuterNodeGroup({
  position,
  baseAngle,
  node,
  colors,
  isExpanded,
  isHovered,
  isHighlight,
  expandable,
  interactive,
  size,
  href,
  onHover,
  onLeave,
  onClick,
}: {
  position: MotionValue<{ x: number; y: number }>;
  baseAngle: number;
  node: OuterNodeData;
  colors: ThemeColors;
  isExpanded: boolean;
  isHovered: boolean;
  isHighlight: boolean;
  expandable: boolean;
  interactive: boolean;
  size: "hero" | "compact";
  href?: string;
  onHover: () => void;
  onLeave: () => void;
  onClick: () => void;
}) {
  const [coords, setCoords] = useState(() => polarToCartesian(CX, CY, ORBIT_R, baseAngle));

  useEffect(() => {
    const unsubscribe = position.on("change", setCoords);
    return () => unsubscribe();
  }, [position]);

  const isInteractive = interactive || expandable || Boolean(href);
  const scale = isHovered || isExpanded || isHighlight ? 1.08 : 1;
  const stroke = isHighlight ? colors.outerHighlightStroke : colors.outerStroke;
  const strokeWidth = isHighlight ? 2.5 : 1.5;

  const fontSizeTitle = size === "compact" ? (node.id === "hli" ? 12 : 14) : node.id === "hli" ? 14 : 16;
  const fontSizeSub = size === "compact" ? 10 : 11;
  const fontSizeDetail = size === "compact" ? 8 : 9;

  const content = (
    <motion.g
      transform={`translate(${coords.x}, ${coords.y})`}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={onClick}
      style={{ cursor: isInteractive ? "pointer" : "default" }}
    >
      <motion.circle
        r={OUTER_NODE_R}
        fill={colors.outerFill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        initial={false}
        animate={{ scale }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      />
      <text
        y={node.id === "hli" ? -18 : -5}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize={fontSizeTitle}
        fontWeight={600}
        fill={colors.textPrimary}
      >
        {node.id === "hli" ? (
          <>
            <tspan x={0} dy={0}>Hair Longevity</tspan>
            <tspan x={0} dy={17}>Institute™</tspan>
          </>
        ) : (
          node.title
        )}
      </text>
      <text
        y={node.id === "hli" ? 12 : 15}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize={fontSizeSub}
        fontWeight={500}
        fill={colors.textSecondary}
      >
        {node.subtitle}
      </text>
      <text
        y={node.id === "hli" ? 32 : 35}
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fontSize={fontSizeDetail}
        fill={colors.textMuted}
      >
        {node.detail}
      </text>
      {(isHovered || isExpanded) && (
        <motion.g
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
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
          <text
            y={-OUTER_NODE_R - 24}
            textAnchor="middle"
            fontFamily="system-ui, sans-serif"
            fontSize={11}
            fill={colors.textPrimary}
          >
            {expandable && isExpanded ? "Click to collapse" : node.title}
          </text>
        </motion.g>
      )}
    </motion.g>
  );

  return content;
}

export default GlobalHairIntelligenceNetwork;
