/** Scripts run outside Next.js — import schema directly (not server.ts, which uses `server-only`). */
import { assertValidEnv } from "../src/lib/env/schema";

assertValidEnv();
console.log("FI OS environment validation passed.");
