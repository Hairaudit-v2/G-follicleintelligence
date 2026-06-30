import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  GUIDED_CAPTURE_UPLOAD_MESSAGES,
  postGuidedCaptureImage,
  resolveGuidedCaptureUploadException,
  resolveGuidedCaptureUploadFailure,
} from "./imagingGuidedCaptureUpload.client";

describe("resolveGuidedCaptureUploadException", () => {
  it("maps AbortError to timeout message", () => {
    assert.equal(
      resolveGuidedCaptureUploadException(new DOMException("Aborted", "AbortError")),
      GUIDED_CAPTURE_UPLOAD_MESSAGES.timeout
    );
    assert.equal(
      resolveGuidedCaptureUploadException(Object.assign(new Error("Aborted"), { name: "AbortError" })),
      GUIDED_CAPTURE_UPLOAD_MESSAGES.timeout
    );
  });

  it("maps fetch throws to network message", () => {
    assert.equal(
      resolveGuidedCaptureUploadException(new TypeError("Failed to fetch")),
      GUIDED_CAPTURE_UPLOAD_MESSAGES.network
    );
  });
});

describe("resolveGuidedCaptureUploadFailure", () => {
  it("returns null for successful responses", () => {
    assert.equal(
      resolveGuidedCaptureUploadFailure(new Response(null, { status: 200 }), { ok: true }),
      null
    );
  });

  it("maps 500 responses to server failure message", () => {
    assert.equal(
      resolveGuidedCaptureUploadFailure(new Response(null, { status: 500 }), { ok: false }),
      GUIDED_CAPTURE_UPLOAD_MESSAGES.server
    );
  });

  it("prefers server-provided 4xx error text when present", () => {
    assert.equal(
      resolveGuidedCaptureUploadFailure(new Response(null, { status: 400 }), {
        ok: false,
        error: "Missing or empty file.",
      }),
      "Missing or empty file."
    );
  });
});

describe("postGuidedCaptureImage", () => {
  it("survives invalid JSON responses", async () => {
    const fetchImpl = async () =>
      new Response("not-json", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });

    const { response, json } = await postGuidedCaptureImage(
      "https://example.test/upload",
      new FormData(),
      { fetchImpl }
    );

    assert.equal(response.ok, true);
    assert.deepEqual(json, {});
  });

  it("propagates network failures", async () => {
    const fetchImpl = async () => {
      throw new TypeError("Failed to fetch");
    };

    await assert.rejects(
      () => postGuidedCaptureImage("https://example.test/upload", new FormData(), { fetchImpl }),
      /Failed to fetch/
    );
  });

  it("aborts slow uploads", async () => {
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });

    await assert.rejects(
      () =>
        postGuidedCaptureImage("https://example.test/upload", new FormData(), {
          fetchImpl,
          timeoutMs: 5,
        }),
      (error: unknown) => error instanceof DOMException && error.name === "AbortError"
    );
  });
});
