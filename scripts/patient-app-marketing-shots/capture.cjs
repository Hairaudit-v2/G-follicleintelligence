/**
 * FI-PATIENT-APP-2A — Capture public-safe Patient App marketing screenshots.
 * Uses synthetic demonstration UI only (Alex Morgan / FI Demonstration Clinic).
 * Does NOT capture from Evolved or other production clinic tenants.
 */
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function main() {
  const { chromium } = require("playwright");
  const sharp = require("sharp");

  const root = path.resolve(__dirname);
  const htmlPath = path.join(root, "public-safe-screens.html");
  const rawDir = path.resolve(
    __dirname,
    "../../docs/marketing/screenshots/fi-patient-app-2a"
  );
  const webpDir = path.resolve(__dirname, "../../public/os-images/patient-app");

  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(webpDir, { recursive: true });

  const shots = [
    {
      id: "home-next-step",
      file: "patient-app-home-next-step",
      selector: "#shot-home-next-step",
    },
    {
      id: "action-centre",
      file: "patient-app-action-centre",
      selector: "#shot-action-centre",
    },
    {
      id: "journey-timeline",
      file: "patient-app-journey-timeline",
      selector: "#shot-journey-timeline",
    },
    { id: "quote", file: "patient-app-quote", selector: "#shot-quote" },
    {
      id: "pathology",
      file: "patient-app-pathology",
      selector: "#shot-pathology",
    },
  ];

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 2,
  });

  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });

  const inventory = [];

  for (const shot of shots) {
    const el = page.locator(shot.selector);
    await el.waitFor({ state: "visible" });
    const pngPath = path.join(rawDir, `${shot.file}.png`);
    await el.screenshot({ path: pngPath, type: "png" });

    const meta = await sharp(pngPath).metadata();
    const webpPath = path.join(webpDir, `${shot.file}.webp`);
    await sharp(pngPath)
      .webp({ quality: 88 })
      .toFile(webpPath);

    inventory.push({
      id: shot.id,
      png: path.relative(path.resolve(__dirname, "../.."), pngPath).replace(/\\/g, "/"),
      webp: `/os-images/patient-app/${shot.file}.webp`,
      width: meta.width,
      height: meta.height,
      identity: {
        patient: "Alex Morgan",
        clinic: "FI Demonstration Clinic",
        account: "demo.patient@follicleintelligence.ai",
      },
      source: "public-safe demonstration fixture (Phase 1 UI mirror)",
      productionTenantUsed: false,
    });
  }

  await browser.close();

  const manifestPath = path.join(rawDir, "screenshot-inventory.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        ticket: "FI-PATIENT-APP-2A",
        capturedAt: new Date().toISOString(),
        note:
          "Public-safe synthetic screens only. Live Evolved / Gateway Demo tenant was intentionally not used for marketing imagery.",
        shots: inventory,
      },
      null,
      2
    )
  );

  console.log(JSON.stringify({ ok: true, count: inventory.length, manifestPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
