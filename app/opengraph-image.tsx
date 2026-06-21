import { ImageResponse } from "next/og";

import { SITE_SEO_TITLE } from "@/lib/structured-data";

export const runtime = "edge";

export const alt =
  "Follicle Intelligence — The Operating System For The Future Of Hair Restoration";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(145deg, #0b1217 0%, #0f1a24 55%, #122433 100%)",
          color: "#f4f8fb",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#2aa8dc",
          }}
        >
          Follicle Intelligence
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 920 }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            The Operating System For The Future Of Hair Restoration
          </div>
          <div style={{ fontSize: 28, lineHeight: 1.45, color: "#b8c9d6" }}>
            Enterprise infrastructure for acquisition, clinical operations, surgery, audit,
            training, and longitudinal outcome intelligence.
          </div>
        </div>
        <div style={{ fontSize: 22, color: "#7fa8bc" }}>{SITE_SEO_TITLE.split("|")[0]?.trim()}</div>
      </div>
    ),
    { ...size }
  );
}