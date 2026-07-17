import { chromium } from "playwright";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(ROOT, "docs/marketing/screenshots/fi-web-refresh-1i");
fs.mkdirSync(out, { recursive: true });

const base = process.env.FI_VERIFY_BASE || "http://127.0.0.1:3002";

const pages = [
  { name: "home", url: "/", sel: "#product-showcase" },
  { name: "vision", url: "/vision", sel: "#vision-product-proof" },
  { name: "leadflow", url: "/platform/leadflow", sel: "#leadflow-product" },
  { name: "clinic-owners", url: "/clinic-owners", sel: "#owner-workflows" },
  { name: "platform", url: "/platform", sel: "#platform-product-showcase" },
];

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

async function alive() {
  return await new Promise((resolve) => {
    try {
      const url = new URL("/vision", base);
      const lib = url.protocol === "https:" ? https : http;
      const req = lib.get(url, { timeout: 15000 }, (res) => {
        res.resume();
        console.log("alive status", res.statusCode);
        resolve((res.statusCode ?? 500) < 500);
      });
      req.on("error", (err) => {
        console.log("alive error", err.message);
        resolve(false);
      });
      req.on("timeout", () => {
        req.destroy();
        console.log("alive timeout");
        resolve(false);
      });
    } catch (err) {
      console.log("alive throw", err);
      resolve(false);
    }
  });
}

console.log("Checking", base);
const browser = await chromium.launch();
if (!(await alive())) {
  console.error("NO_SERVER", base);
  await browser.close();
  process.exit(2);
}

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
  });
  const page = await context.newPage();
  for (const p of pages) {
    await page.goto(base + p.url, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(800);
    const loc = page.locator(p.sel).first();
    if ((await loc.count()) > 0) {
      await loc.scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      const file = path.join(out, `${p.name}-${vp.name}.png`);
      await loc.screenshot({ path: file });
      console.log("shot", p.name, vp.name);
    } else {
      const file = path.join(out, `${p.name}-${vp.name}-full.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log("missing-sel", p.name, vp.name);
    }
  }
  await context.close();
}

await browser.close();
console.log("DONE");
