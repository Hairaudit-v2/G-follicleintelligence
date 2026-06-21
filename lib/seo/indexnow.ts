import { SITE_URL } from "@/lib/seo/constants";
import { getSitemapPaths } from "@/lib/seo/sitemap-pages";

const INDEXNOW_KEY_PATTERN = /^[a-zA-Z0-9-]{8,128}$/;

const INDEXNOW_ENDPOINTS = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
] as const;

export function getIndexNowKey(): string | null {
  const key = process.env.INDEXNOW_KEY?.trim().replace(/\s+/g, "");
  if (!key || !INDEXNOW_KEY_PATTERN.test(key)) return null;
  return key;
}

export function getIndexNowKeyFileName(): string | null {
  const key = getIndexNowKey();
  return key ? `${key}.txt` : null;
}

export function isIndexNowKeyFileRequest(fileName: string): boolean {
  const expected = getIndexNowKeyFileName();
  return Boolean(expected && fileName === expected);
}

export function buildIndexNowPayload(urlPaths: readonly string[] = getSitemapPaths()): {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
} | null {
  const key = getIndexNowKey();
  if (!key) return null;

  const host = new URL(SITE_URL).host;
  const keyLocation = `${SITE_URL.replace(/\/$/, "")}/${key}.txt`;
  const urlList = urlPaths.map((path) =>
    path === "/" ? SITE_URL : `${SITE_URL.replace(/\/$/, "")}${path}`
  );

  return { host, key, keyLocation, urlList };
}

export type IndexNowPingResult = {
  endpoint: string;
  status: number;
  ok: boolean;
};

/**
 * Notify IndexNow participants (Bing, Yandex, etc.) that sitemap URLs changed.
 */
export async function pingIndexNow(
  urlPaths: readonly string[] = getSitemapPaths()
): Promise<{ submitted: number; results: IndexNowPingResult[] }> {
  const payload = buildIndexNowPayload(urlPaths);
  if (!payload) {
    return { submitted: 0, results: [] };
  }

  const body = JSON.stringify(payload);
  const results: IndexNowPingResult[] = [];

  for (const endpoint of INDEXNOW_ENDPOINTS) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body,
    });
    results.push({
      endpoint,
      status: res.status,
      ok: res.ok || res.status === 202,
    });
  }

  return { submitted: payload.urlList.length, results };
}