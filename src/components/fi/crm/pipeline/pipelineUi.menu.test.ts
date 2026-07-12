/**
 * Pipeline More-menu dismissal contract (static source checks).
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const UI = readFileSync(join("src/components/fi/crm/pipeline/pipelineUi.tsx"), "utf8");
const WS = readFileSync(join("src/components/fi/crm/pipeline/PipelineWorkspace.tsx"), "utf8");

test("1. More menu uses accessible DropdownMenu primitive", () => {
  assert.match(UI, /DropdownMenu/);
  assert.match(UI, /DropdownMenuTrigger/);
  assert.match(UI, /DropdownMenuContent/);
  assert.match(UI, /DropdownMenuItem/);
});

test("2. menu open state is controlled with onOpenChange", () => {
  assert.match(UI, /open=\{menuOpen\}/);
  assert.match(UI, /onOpenChange=\{/);
  assert.match(UI, /openMenuLeadId/);
});

test("3. only one card menu open via openMenuLeadId", () => {
  assert.match(UI, /setOpenMenuLeadId/);
  assert.match(UI, /openMenuLeadId === card\.leadId/);
});

test("4. selecting an action closes the menu", () => {
  assert.match(UI, /onSelect=\{\(\) => \{[\s\S]*setMenuOpen\(false\)/);
});

test("5. trigger has accessible name More actions", () => {
  assert.match(UI, /aria-label="More actions"/);
});

test("6. presentation refresh / view change closes menu via presentationKey", () => {
  assert.match(UI, /presentationKey/);
  assert.match(UI, /setOpenMenuLeadId\(null\)/);
  assert.match(WS, /presentationKey=\{`\$\{presentation\.generatedAt\}:\$\{view\}`\}/);
});

test("7. does not use setOpen\(true\) only toggle without close path", () => {
  // Custom menu without DropdownMenu would use setMenuOpen\(true\) blindly — ensure we use onOpenChange
  assert.match(UI, /onOpenChange=\{\(open\) =>/);
});

test("8. move-stage menu still has cancel dismiss path", () => {
  assert.match(UI, /setMoveOpen\(false\)/);
});
