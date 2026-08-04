import type { Metadata } from "next";

import { FiOsLoginMagicLinkHandler } from "@/src/components/fi/os/FiOsLoginMagicLinkHandler";
import { FiOsLoginScreen } from "@/src/components/fi/os/FiOsLoginScreen";

export const metadata: Metadata = {
  title: "Sign in | Follicle Intelligence OS",
  robots: { index: false, follow: false },
};

function pickString(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

function sanitizeNextPath(raw: string | undefined): string {
  const s = (raw ?? "").trim();
  if (!s.startsWith("/") || s.startsWith("//")) return "";
  return s;
}

export default async function FollicleIntelligenceOsLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const errorCode = pickString(sp.error);
  const noticeCode = pickString(sp.notice);
  const safeNextPath = sanitizeNextPath(pickString(sp.next));

  return (
    <>
      <FiOsLoginMagicLinkHandler safeNextPath={safeNextPath || "/fi-admin"} />
      <FiOsLoginScreen errorCode={errorCode} noticeCode={noticeCode} safeNextPath={safeNextPath} />
    </>
  );
}
