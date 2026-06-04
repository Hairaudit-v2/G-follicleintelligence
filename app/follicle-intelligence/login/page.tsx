import type { Metadata } from "next";

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

export default function FollicleIntelligenceOsLoginPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const errorCode = pickString(searchParams.error);
  const noticeCode = pickString(searchParams.notice);
  const safeNextPath = sanitizeNextPath(pickString(searchParams.next));

  return <FiOsLoginScreen errorCode={errorCode} noticeCode={noticeCode} safeNextPath={safeNextPath} />;
}
