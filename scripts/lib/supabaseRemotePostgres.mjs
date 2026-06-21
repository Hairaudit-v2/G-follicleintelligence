import pg from "pg";

/** Follicle Intelligence hosted project (ap-south-1). */
export const FI_HOSTED_PROJECT_REF = "iqqvzgxoimxchhcnbzxl";

const POOLER_REGIONS = [
  "ap-south-1",
  "ap-southeast-2",
  "ap-southeast-1",
  "ap-northeast-1",
  "us-east-1",
  "us-west-1",
  "eu-west-1",
  "eu-central-1",
  "sa-east-1",
];

async function tryConnect(label, connectionString) {
  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    return { client, label };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { client: null, label, error: msg.slice(0, 160) };
  }
}

export function buildConnectionAttempts(projectRef, password) {
  const encoded = encodeURIComponent(password);
  return [
    ["direct", `postgresql://postgres:${encoded}@db.${projectRef}.supabase.co:5432/postgres`],
    ...POOLER_REGIONS.flatMap((region) => [
      [`pooler-6543-${region}`, `postgresql://postgres.${projectRef}:${encoded}@aws-0-${region}.pooler.supabase.com:6543/postgres`],
      [`pooler-5432-${region}`, `postgresql://postgres.${projectRef}:${encoded}@aws-0-${region}.pooler.supabase.com:5432/postgres`],
      [`pooler-6543-aws1-${region}`, `postgresql://postgres.${projectRef}:${encoded}@aws-1-${region}.pooler.supabase.com:6543/postgres`],
      [`pooler-5432-aws1-${region}`, `postgresql://postgres.${projectRef}:${encoded}@aws-1-${region}.pooler.supabase.com:5432/postgres`],
    ]),
  ];
}

export async function connectHostedSupabasePostgres(options = {}) {
  const projectRef = options.projectRef ?? process.env.SUPABASE_PROJECT_REF?.trim() ?? FI_HOSTED_PROJECT_REF;
  const password = options.password ?? process.env.SUPABASE_DB_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      "SUPABASE_DB_PASSWORD is required (Supabase Dashboard → Project Settings → Database). " +
        "Add it to .env.local or export it in the shell."
    );
  }

  const attempts = buildConnectionAttempts(projectRef, password);
  const failures = [];

  for (const [label, connectionString] of attempts) {
    const result = await tryConnect(label, connectionString);
    if (result.client) {
      return { client: result.client, label, projectRef };
    }
    failures.push(`${label}: ${result.error ?? "unknown"}`);
  }

  throw new Error(
    `Could not connect to hosted Postgres for ${projectRef}. Tried ${attempts.length} endpoints. ` +
      `Last errors: ${failures.slice(-3).join(" | ")}`
  );
}
