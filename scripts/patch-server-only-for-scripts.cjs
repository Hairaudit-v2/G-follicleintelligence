/**
 * Preload: replace `server-only` with a no-op so tsx CLI scripts can import Next "server" modules.
 * Restores the original file on exit. Do not run concurrent HubSpot commit scripts.
 */
const fs = require("fs");
const path = require("path");

const target = path.join(__dirname, "..", "node_modules", "server-only", "index.js");

let original = null;
try {
  original = fs.readFileSync(target, "utf8");
} catch {
  process.stderr.write("patch-server-only-for-scripts: could not read server-only package.\n");
  process.exit(1);
}

const noop = "'use strict';\nmodule.exports = {};\n";

if (!original.includes("This module cannot be imported")) {
  if (original === noop) {
    // Already patched from a prior run that did not restore — safe to continue.
    process.on("exit", () => {});
    return;
  }
  process.stderr.write("patch-server-only-for-scripts: server-only/index.js already patched or unexpected; aborting.\n");
  process.exit(1);
}

function restore() {
  if (original == null) return;
  try {
    fs.writeFileSync(target, original, "utf8");
  } catch {
    process.stderr.write("patch-server-only-for-scripts: failed to restore server-only; repair manually.\n");
  }
  original = null;
}

fs.writeFileSync(target, noop, "utf8");

process.on("exit", restore);
process.on("SIGINT", () => {
  restore();
  process.exit(130);
});
process.on("SIGTERM", () => {
  restore();
  process.exit(143);
});
