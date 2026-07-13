import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetBodyScrollLockForTests,
  forceUnlockBodyScroll,
  getBodyScrollLockCount,
  lockBodyScroll,
} from "./bodyScrollLock";

function installBodyMock() {
  const style: Record<string, string> = {
    overflow: "",
    paddingRight: "",
  };
  const body = { style } as unknown as HTMLElement;
  const doc = {
    body,
    documentElement: { clientWidth: 1000 },
  } as unknown as Document;

  const g = globalThis as unknown as {
    document?: Document;
    window?: Window & typeof globalThis;
  };
  const prevDoc = g.document;
  const prevWin = g.window;

  g.document = doc;
  g.window = {
    innerWidth: 1000,
    getComputedStyle: () => ({ paddingRight: "0px" }) as CSSStyleDeclaration,
  } as unknown as Window & typeof globalThis;

  return {
    style,
    restore() {
      if (prevDoc === undefined) delete g.document;
      else g.document = prevDoc;
      if (prevWin === undefined) delete g.window;
      else g.window = prevWin;
    },
  };
}

test("nested locks only restore overflow after last unlock", () => {
  __resetBodyScrollLockForTests();
  const mock = installBodyMock();
  try {
    mock.style.overflow = "";
    const unlockA = lockBodyScroll();
    assert.equal(mock.style.overflow, "hidden");
    assert.equal(getBodyScrollLockCount(), 1);

    const unlockB = lockBodyScroll();
    assert.equal(mock.style.overflow, "hidden");
    assert.equal(getBodyScrollLockCount(), 2);

    // Releasing the first lock must not restore overflow while B is still held.
    unlockA();
    assert.equal(mock.style.overflow, "hidden");
    assert.equal(getBodyScrollLockCount(), 1);

    unlockB();
    assert.equal(mock.style.overflow, "");
    assert.equal(getBodyScrollLockCount(), 0);
  } finally {
    forceUnlockBodyScroll();
    __resetBodyScrollLockForTests();
    mock.restore();
  }
});

test("unlock is idempotent", () => {
  __resetBodyScrollLockForTests();
  const mock = installBodyMock();
  try {
    const unlock = lockBodyScroll();
    unlock();
    unlock();
    assert.equal(getBodyScrollLockCount(), 0);
    assert.equal(mock.style.overflow, "");
  } finally {
    forceUnlockBodyScroll();
    __resetBodyScrollLockForTests();
    mock.restore();
  }
});

test("preserves pre-existing overflow when fully unlocked", () => {
  __resetBodyScrollLockForTests();
  const mock = installBodyMock();
  try {
    mock.style.overflow = "auto";
    const unlock = lockBodyScroll();
    assert.equal(mock.style.overflow, "hidden");
    unlock();
    assert.equal(mock.style.overflow, "auto");
  } finally {
    forceUnlockBodyScroll();
    __resetBodyScrollLockForTests();
    mock.restore();
  }
});

test("stacked reverse release order still unlocks cleanly", () => {
  __resetBodyScrollLockForTests();
  const mock = installBodyMock();
  try {
    const unlockA = lockBodyScroll();
    const unlockB = lockBodyScroll();
    const unlockC = lockBodyScroll();

    // Classic bug path: close middle, then outer, then last — must end unlocked.
    unlockB();
    assert.equal(mock.style.overflow, "hidden");
    unlockA();
    assert.equal(mock.style.overflow, "hidden");
    unlockC();
    assert.equal(mock.style.overflow, "");
    assert.equal(getBodyScrollLockCount(), 0);
  } finally {
    forceUnlockBodyScroll();
    __resetBodyScrollLockForTests();
    mock.restore();
  }
});
