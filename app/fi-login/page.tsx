import { redirect } from "next/navigation";

function pickString(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}

export default async function FiLoginAliasPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  const keys = ["next", "error", "notice"] as const;
  for (const k of keys) {
    const v = pickString(sp[k]);
    if (v) q.set(k, v);
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  redirect(`/follicle-intelligence/login${suffix}`);
}
