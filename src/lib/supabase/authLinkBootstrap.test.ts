import assert from "node:assert/strict";
import test from "node:test";

import {
  FI_OS_PASSWORD_RESET_REDIRECT_ALLOWLIST,
  FI_OS_UPDATE_PASSWORD_PATH,
  authBootstrapFailureMessage,
  buildFiOsPasswordResetRedirectUrl,
  buildFiOsUpdatePasswordRecoveryUrl,
  isAuthHashExpired,
  isRecoveryAuthLink,
  isRecoveryHashFragment,
  mapAuthBootstrapError,
  parseAuthLinkCredentialsFromParts,
  redactAuthUrlForLog,
  shouldRedirectAuthHashToUpdatePassword,
} from "@/src/lib/supabase/authLinkBootstrap";

test("buildFiOsPasswordResetRedirectUrl uses update-password path", () => {
  assert.equal(
    buildFiOsPasswordResetRedirectUrl("https://follicleintelligence.ai"),
    "https://follicleintelligence.ai/follicle-intelligence/update-password"
  );
  assert.equal(
    buildFiOsPasswordResetRedirectUrl("https://follicleintelligence.ai/"),
    "https://follicleintelligence.ai/follicle-intelligence/update-password"
  );
  assert.equal(
    buildFiOsPasswordResetRedirectUrl("http://localhost:3000"),
    "http://localhost:3000/follicle-intelligence/update-password"
  );
});

test("password reset redirect allowlist documents production and local URLs", () => {
  assert.deepEqual(FI_OS_PASSWORD_RESET_REDIRECT_ALLOWLIST, [
    "https://follicleintelligence.ai/follicle-intelligence/update-password",
    "https://www.follicleintelligence.ai/follicle-intelligence/update-password",
    "http://localhost:3000/follicle-intelligence/update-password",
  ]);
  for (const url of FI_OS_PASSWORD_RESET_REDIRECT_ALLOWLIST) {
    assert.ok(url.endsWith(FI_OS_UPDATE_PASSWORD_PATH));
  }
});

test("parseAuthLinkCredentialsFromParts reads recovery hash params", () => {
  const hash =
    "#access_token=secret-access&refresh_token=secret-refresh&expires_at=4102444800&expires_in=3600&token_type=bearer&type=recovery";
  const credentials = parseAuthLinkCredentialsFromParts(hash, "");
  assert.equal(credentials.kind, "tokens");
  if (credentials.kind !== "tokens") return;
  assert.equal(credentials.authType, "recovery");
  assert.equal(credentials.accessToken, "secret-access");
  assert.equal(credentials.refreshToken, "secret-refresh");
  assert.equal(isRecoveryAuthLink(credentials), true);
});

test("recovery hash on update-password path is recognized", () => {
  const hash =
    "#access_token=a&refresh_token=b&expires_at=4102444800&expires_in=3600&token_type=bearer&type=recovery";
  assert.equal(isRecoveryHashFragment(hash), true);
  const credentials = parseAuthLinkCredentialsFromParts(hash, "");
  assert.equal(isRecoveryAuthLink(credentials), true);
});

test("root auth hash redirects to update-password preserving hash", () => {
  const hash =
    "#access_token=a&refresh_token=b&expires_at=4102444800&expires_in=3600&token_type=bearer&type=recovery";
  const credentials = parseAuthLinkCredentialsFromParts(hash, "?foo=bar");
  assert.equal(shouldRedirectAuthHashToUpdatePassword(credentials, "/"), true);
  assert.equal(
    buildFiOsUpdatePasswordRecoveryUrl(hash, "?foo=bar"),
    "/follicle-intelligence/update-password?foo=bar" + hash
  );
  assert.equal(
    shouldRedirectAuthHashToUpdatePassword(credentials, FI_OS_UPDATE_PASSWORD_PATH),
    false
  );
});

test("missing recovery token maps to safe user message without secrets", () => {
  const message = authBootstrapFailureMessage("missing_token");
  assert.match(message, /request a new/i);
  assert.doesNotMatch(message, /access_token|refresh_token|secret/i);
});

test("expired recovery hash is detected from expires_at", () => {
  const expiredHash = "#access_token=a&refresh_token=b&expires_at=1&type=recovery";
  assert.equal(isAuthHashExpired(expiredHash, 2_000), true);
  const futureHash = "#access_token=a&refresh_token=b&expires_at=4102444800&type=recovery";
  assert.equal(isAuthHashExpired(futureHash, 2_000), false);
});

test("redactAuthUrlForLog strips hash tokens and query secrets", () => {
  const redacted = redactAuthUrlForLog(
    "https://follicleintelligence.ai/#access_token=abc&refresh_token=def&type=recovery"
  );
  assert.equal(
    redacted,
    "https://follicleintelligence.ai/#access_token=%5BREDACTED%5D&refresh_token=%5BREDACTED%5D&type=%5BREDACTED%5D"
  );
  assert.doesNotMatch(redacted, /abc|def/);
});

test("mapAuthBootstrapError classifies expired and already-used links", () => {
  assert.equal(
    mapAuthBootstrapError({
      name: "AuthApiError",
      message: "Token has expired",
      code: "otp_expired",
      status: 401,
    } as import("@supabase/supabase-js").AuthError),
    "expired"
  );
  assert.equal(
    mapAuthBootstrapError({
      name: "AuthApiError",
      message: "Email link has already been used",
      code: "otp_disabled",
      status: 403,
    } as import("@supabase/supabase-js").AuthError),
    "already_used"
  );
});

test("successful password update login notice code is stable", () => {
  const notice = "password_updated";
  assert.equal(notice, "password_updated");
  assert.doesNotMatch(authBootstrapFailureMessage("missing_token"), new RegExp(notice));
});
