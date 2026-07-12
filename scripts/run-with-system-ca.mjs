/**
 * Run a command with OS-trusted TLS for Node scripts (Supabase, staging probes).
 *
 * On Windows networks with HTTPS interception, default Node trust may fail with
 * UNABLE_TO_VERIFY_LEAF_SIGNATURE while browsers still work. This wrapper:
 *
 * 1. Exports LocalMachine\\Root CAs to a temp PEM when NODE_EXTRA_CA_CERTS is unset (Windows).
 * 2. Passes --use-system-ca on Node 23+ when supported.
 *
 * Does NOT disable TLS verification. Do not set NODE_TLS_REJECT_UNAUTHORIZED=0.
 */
import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [command, ...args] = process.argv.slice(2);

function nodeMajor() {
  return Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
}

function nodeSupportsSystemCaFlag() {
  const major = nodeMajor();
  if (major < 23) return false;
  const help = spawnSync(process.execPath, ["--help"], { encoding: "utf8" });
  return /use-system-ca/.test(help.stdout ?? "");
}

function ensureWindowsExtraCa() {
  if (process.env.NODE_EXTRA_CA_CERTS?.trim()) return;
  if (process.platform !== "win32") return;

  const target = join(tmpdir(), "fi-node-extra-ca.pem");
  const maxAgeMs = 24 * 60 * 60 * 1000;
  if (existsSync(target)) {
    try {
      const age = Date.now() - statSync(target).mtimeMs;
      if (age < maxAgeMs) {
        process.env.NODE_EXTRA_CA_CERTS = target;
        return;
      }
    } catch {
      /* regenerate */
    }
  }

  const escaped = target.replace(/'/g, "''");
  const ps = [
    "$certs = Get-ChildItem Cert:\\LocalMachine\\Root",
    "$lines = foreach ($c in $certs) {",
    "  '-----BEGIN CERTIFICATE-----'",
    "  [Convert]::ToBase64String($c.RawData, 'InsertLineBreaks')",
    "  '-----END CERTIFICATE-----'",
    "}",
    `$lines | Set-Content -Encoding ascii '${escaped}'`,
  ].join("; ");

  const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.status === 0 && existsSync(target)) {
    process.env.NODE_EXTRA_CA_CERTS = target;
  }
}

function nodePrefixedArgs(extraArgs) {
  ensureWindowsExtraCa();
  return nodeSupportsSystemCaFlag() ? ["--use-system-ca", ...extraArgs] : extraArgs;
}

if (!command) {
  console.error("Usage: node scripts/run-with-system-ca.mjs <command> [args...]");
  process.exit(1);
}

function resolveCommand(cmd) {
  if (cmd === "tsx") return "tsx";
  return cmd;
}

const resolved = resolveCommand(command);
const result =
  resolved === "tsx"
    ? spawnSync(process.execPath, nodePrefixedArgs(["--import", "tsx", ...args]), {
        stdio: "inherit",
        shell: false,
        env: process.env,
      })
    : resolved === command && (command === "node" || command.endsWith("node.exe"))
      ? spawnSync(command, nodePrefixedArgs(args), { stdio: "inherit", shell: false, env: process.env })
      : spawnSync(process.execPath, nodePrefixedArgs([resolved, ...args]), {
          stdio: "inherit",
          shell: false,
          env: process.env,
        });

process.exit(result.status ?? 1);
