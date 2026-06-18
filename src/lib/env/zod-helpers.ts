import { z } from "zod";

export const AFFIRMATIVE = new Set(["1", "true", "yes", "on"]);

export function isAffirmative(raw: string | undefined): boolean {
  if (raw === undefined || raw === "") return false;
  return AFFIRMATIVE.has(raw.trim().toLowerCase());
}

export function isPresent(raw: string | undefined): boolean {
  return raw !== undefined && raw.trim() !== "";
}

/** Treat empty strings as unset (common in .env files). */
export function emptyToUndefined(val: unknown): unknown {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "string" && val.trim() === "") return undefined;
  return val;
}

export const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());

export const httpUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine((s) => {
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Must be a valid http(s) URL.");

export const optionalHttpUrl = z.preprocess(
  emptyToUndefined,
  httpUrlSchema.optional()
);

export function shouldSkipEnvValidation(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.SKIP_ENV_VALIDATION?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function nodeEnv(env: NodeJS.ProcessEnv = process.env): string {
  return env.NODE_ENV?.trim() || "development";
}

export function isProductionEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return nodeEnv(env) === "production";
}

export type EnvIssue = { variable: string; message: string };

export function formatEnvValidationError(issues: EnvIssue[]): string {
  const lines = issues.map((i) => `  - ${i.variable}: ${i.message}`);
  return ["Invalid environment variables:", ...lines].join("\n");
}

/** Map Zod issues to variable names (fiEnv legacy) without leaking values. */
export function zodIssuesToVariableNames(error: z.ZodError): string[] {
  const names = error.issues.map((issue) => {
    const head = issue.path[0];
    return typeof head === "string" ? head : "environment";
  });
  return [...new Set(names)].sort();
}
