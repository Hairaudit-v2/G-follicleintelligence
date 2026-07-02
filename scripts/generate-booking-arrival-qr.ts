#!/usr/bin/env tsx
/**
 * Dev-only: generate a D6 same-day booking arrival URL and optional QR PNG.
 *
 * Uses createBookingArrivalToken (FI_ARRIVAL_TOKEN_SECRET / configured fallback).
 * Does not load bookings or print PHI.
 *
 *   pnpm qr:arrival -- --tenant <uuid> --booking <uuid> --base-url https://app.example.com
 *   pnpm qr:arrival -- --tenant <uuid> --booking <uuid> --base-url https://app.example.com --out ./arrival-qr.png
 */
import { resolve } from "node:path";

import QRCode from "qrcode";

import {
  buildBookingArrivalPublicUrl,
  createBookingArrivalToken,
} from "../src/lib/fiOs/todaySignal/bookingArrivalIntent.server";
import { resolveBookingArrivalTokenSecret } from "../src/lib/fiOs/todaySignal/bookingArrivalIntentCore";
import { loadRepoEnvFiles } from "./lib/loadRepoEnvFiles.mjs";

loadRepoEnvFiles();

type CliArgs = {
  tenant: string;
  booking: string;
  baseUrl: string;
  out: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function usage(): string {
  return [
    "Usage:",
    "  pnpm qr:arrival -- --tenant <tenantId> --booking <bookingId> --base-url <https://domain.com> [--out <png-path>]",
    "",
    "Options:",
    "  --tenant     FI tenant UUID (required)",
    "  --booking    Booking UUID (required)",
    "  --base-url   Public site origin, e.g. https://app.example.com (required)",
    "  --out        Optional path for QR PNG output",
  ].join("\n");
}

function parseArgs(argv: string[]): CliArgs {
  let tenant = "";
  let booking = "";
  let baseUrl = "";
  let out: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--tenant" && argv[i + 1]) {
      tenant = argv[++i].trim();
      continue;
    }
    if (arg.startsWith("--tenant=")) {
      tenant = arg.slice("--tenant=".length).trim();
      continue;
    }
    if (arg === "--booking" && argv[i + 1]) {
      booking = argv[++i].trim();
      continue;
    }
    if (arg.startsWith("--booking=")) {
      booking = arg.slice("--booking=".length).trim();
      continue;
    }
    if (arg === "--base-url" && argv[i + 1]) {
      baseUrl = argv[++i].trim();
      continue;
    }
    if (arg.startsWith("--base-url=")) {
      baseUrl = arg.slice("--base-url=".length).trim();
      continue;
    }
    if (arg === "--out" && argv[i + 1]) {
      out = argv[++i].trim();
      continue;
    }
    if (arg.startsWith("--out=")) {
      out = arg.slice("--out=".length).trim();
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    }
  }

  return { tenant, booking, baseUrl, out };
}

function assertRequiredUuid(value: string, label: string): void {
  if (!value) {
    throw new Error(`Missing required --${label}.`);
  }
  if (!UUID_RE.test(value)) {
    throw new Error(`Invalid --${label}: expected a UUID.`);
  }
}

function assertBaseUrl(value: string): void {
  if (!value) {
    throw new Error("Missing required --base-url.");
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid --base-url: must be an absolute URL (e.g. https://app.example.com).");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Invalid --base-url: only http and https are supported.");
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertRequiredUuid(args.tenant, "tenant");
  assertRequiredUuid(args.booking, "booking");
  assertBaseUrl(args.baseUrl);

  if (!resolveBookingArrivalTokenSecret()) {
    throw new Error(
      "Arrival token secret is not configured. Set FI_ARRIVAL_TOKEN_SECRET or FI_EXTERNAL_CONNECTOR_MASTER_KEY in .env.local."
    );
  }

  const created = await createBookingArrivalToken(args.tenant, args.booking);
  if (!created) {
    throw new Error("Failed to create arrival token.");
  }

  const arrivalUrl = buildBookingArrivalPublicUrl(created.token, args.baseUrl);

  console.log(`Arrival URL: ${arrivalUrl}`);
  console.log(`Booking ID: ${args.booking}`);
  console.log(`Expiry: ${created.expiresAt}`);

  if (args.out) {
    const outPath = resolve(process.cwd(), args.out);
    await QRCode.toFile(outPath, arrivalUrl, { type: "png", margin: 1, width: 512 });
    console.log(`QR PNG: ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
