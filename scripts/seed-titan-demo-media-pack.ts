/**
 * Optional TITAN imaging media pack — uploads tiny placeholder JPEGs
 * for existing `titan-demo/synthetic/*.jpg` paths so ImagingOS galleries
 * are not empty during guided demos.
 *
 * Usage:
 *   npm run seed:titan-demo-media-pack
 *   npm run seed:titan-demo-media-pack -- --limit=48
 *
 * Requires Supabase service role. Skips paths that already have a non-empty object.
 */
import { loadRepoEnvFiles } from "./lib/loadRepoEnvFiles.mjs";
import { supabaseAdmin } from "../lib/supabaseAdmin";
import { ENTERPRISE_DEMO_TENANT_SLUG } from "../src/lib/enterprise-demo/enterpriseDemoConstants";
import { TITAN_DEMO_SYNTHETIC_IMAGE_PATH_PREFIX } from "../src/lib/enterprise-demo/enterpriseDemoGlobalCommandCentreValidationModel";

loadRepoEnvFiles();

/** Minimal valid 1×1 JPEG */
const PLACEHOLDER_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z",
  "base64"
);

const BUCKET = "patient-images";

function parseLimit(argv: string[]): number {
  for (const arg of argv) {
    if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
    }
  }
  return 48;
}

async function main(): Promise<void> {
  const limit = parseLimit(process.argv.slice(2));
  const sb = supabaseAdmin();

  const { data: tenant, error: tenantErr } = await sb
    .from("fi_tenants")
    .select("id")
    .eq("slug", ENTERPRISE_DEMO_TENANT_SLUG)
    .maybeSingle();
  if (tenantErr) throw new Error(tenantErr.message);
  if (!tenant) {
    console.error(`Tenant ${ENTERPRISE_DEMO_TENANT_SLUG} not found. Seed IHRG first.`);
    process.exit(1);
  }
  const tenantId = String((tenant as { id: string }).id);

  const { data: images, error: imgErr } = await sb
    .from("fi_patient_images")
    .select("id, storage_path, storage_bucket, file_size_bytes")
    .eq("tenant_id", tenantId)
    .like("storage_path", `${TITAN_DEMO_SYNTHETIC_IMAGE_PATH_PREFIX}%`)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (imgErr) throw new Error(imgErr.message);

  let uploaded = 0;
  let skipped = 0;
  let updated = 0;
  const warnings: string[] = [];

  for (const row of images ?? []) {
    const image = row as {
      id: string;
      storage_path: string;
      storage_bucket: string | null;
      file_size_bytes: number | null;
    };
    const path = image.storage_path;
    const bucket = image.storage_bucket?.trim() || BUCKET;

    const { data: listed, error: listErr } = await sb.storage.from(bucket).list(
      path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "",
      {
        search: path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path,
        limit: 1,
      }
    );
    if (listErr) {
      warnings.push(`${path}: list failed — ${listErr.message}`);
    }

    const already =
      Array.isArray(listed) &&
      listed.some((f) => f.name === (path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path));

    if (already && (image.file_size_bytes ?? 0) > 0) {
      skipped += 1;
      continue;
    }

    const { error: upErr } = await sb.storage.from(bucket).upload(path, PLACEHOLDER_JPEG, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (upErr) {
      warnings.push(`${path}: upload failed — ${upErr.message}`);
      continue;
    }
    uploaded += 1;

    const { error: sizeErr } = await sb
      .from("fi_patient_images")
      .update({
        file_size_bytes: PLACEHOLDER_JPEG.length,
        content_type: "image/jpeg",
        updated_at: new Date().toISOString(),
      })
      .eq("id", image.id);
    if (sizeErr) {
      warnings.push(`${path}: row update failed — ${sizeErr.message}`);
    } else {
      updated += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        tenantId,
        considered: (images ?? []).length,
        uploaded,
        skipped,
        rowsUpdated: updated,
        warnings,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
