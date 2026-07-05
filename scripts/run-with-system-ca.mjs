/**
 * Run a command with Node's system CA store enabled (Node 22+ `--use-system-ca`).
 * Required on some Windows networks where TLS interception breaks default Node trust
 * (UNABLE_TO_VERIFY_LEAF_SIGNATURE) while browsers and Supabase MCP still work.
 *
 * Uses `node --use-system-ca` as argv (not NODE_OPTIONS) because Node disallows the
 * flag in NODE_OPTIONS on some builds.
 */
import { spawnSync } from "node:child_process";

const SYSTEM_CA_FLAG = "--use-system-ca";
const [command, ...args] = process.argv.slice(2);

/** Node 22+ only; older runtimes exit on unknown flags. */
function nodePrefixedArgs(extraArgs) {
  const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
  return major >= 22 ? [SYSTEM_CA_FLAG, ...extraArgs] : extraArgs;
}

if (!command) {
  console.error("Usage: node scripts/run-with-system-ca.mjs <command> [args...]");
  process.exit(1);
}

function resolveCommand(cmd) {
  if (cmd === "tsx") {
    return "tsx";
  }
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
