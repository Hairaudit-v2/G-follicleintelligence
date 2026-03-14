/**
 * Copy check test.
 * Run: npx tsx scripts/copy-check.ts
 * Or via API: curl -X POST http://localhost:3000/api/fi/copy-check -H "Content-Type: application/json" -d '{"text":"This will regrow your hair."}'
 */
import { validateClaimSafety } from "../src/lib/fi/copy/claimSafety";

const cases: Array<{ text: string; expectPass: boolean }> = [
  { text: "This may suggest elevated risk.", expectPass: true },
  { text: "Findings are consistent with the data.", expectPass: true },
  { text: "This will regrow your hair.", expectPass: false },
  { text: "Our treatment cures hair loss.", expectPass: false },
  { text: "Guaranteed results in 3 months.", expectPass: false },
];

let passed = 0;
let failed = 0;

for (const { text, expectPass } of cases) {
  const r = validateClaimSafety(text);
  const ok = r.ok === expectPass;
  if (ok) {
    passed++;
    console.log(`✓ "${text.slice(0, 50)}${text.length > 50 ? "..." : ""}"`);
  } else {
    failed++;
    console.log(`✗ "${text.slice(0, 50)}..." expected pass=${expectPass}, got ok=${r.ok}`);
    if (!r.ok && "violations" in r) console.log("  violations:", r.violations);
  }
}

console.log(`\nCopy check: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
