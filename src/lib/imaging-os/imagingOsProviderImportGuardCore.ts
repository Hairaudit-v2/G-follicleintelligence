/**
 * FI-IMAGING-AI-PROVIDER-IMPORT-GUARD-1 — detect provider SDK imports in ImagingOS foundation modules.
 * Scans import `from` specifiers only (not provider vocabulary strings like openai_vision).
 */

const SINGLE_LINE_IMPORT_FROM =
  /^\s*(?:import|export)\s+(?:type\s+)?[\s\S]*?\sfrom\s+["']([^"']+)["']/;
const MULTILINE_IMPORT_FROM = /^\s*\}\s*from\s+["']([^"']+)["']/;

/** npm / SDK module paths that must stay behind provider adapter boundaries. */
const FORBIDDEN_PROVIDER_MODULE_PATH =
  /(?:^|\/)(?:openai)(?:\/|$)|anthropic|claude|gemini|@google\/generative-ai|openAiHairImageClassifier|classifyHairRestorationImageWithOpenAi/i;

/** Server/provider adapter files permitted to import live provider configuration helpers. */
export const IMAGING_OS_PROVIDER_ADAPTER_MODULES = [
  "liveAi.ts",
  "aiVision.ts",
  "liveImagingSignalProviders.server.ts",
  "clinicalImageAnalysisProvider.server.ts",
  "imagingAiAnalysisJobWorker.server.ts",
  "graftTrayCountOpenAiProvider.server.ts",
] as const;

export type ImagingOsProviderAdapterModule = (typeof IMAGING_OS_PROVIDER_ADAPTER_MODULES)[number];

export type ImagingOsProviderImportViolation = {
  file: string;
  line: number;
  specifier: string;
};

function normalizePosixPath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function isForbiddenProviderModuleSpecifier(specifier: string): boolean {
  const normalized = normalizePosixPath(specifier.trim());
  return FORBIDDEN_PROVIDER_MODULE_PATH.test(normalized);
}

export function isImagingOsProviderAdapterModule(fileName: string): boolean {
  return (IMAGING_OS_PROVIDER_ADAPTER_MODULES as readonly string[]).includes(fileName);
}

export function findForbiddenProviderImportsInSource(
  source: string,
  filePath = "inline-fixture.ts"
): ImagingOsProviderImportViolation[] {
  const violations: ImagingOsProviderImportViolation[] = [];
  const lines = source.split("\n");

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? "";
    const match = line.match(SINGLE_LINE_IMPORT_FROM) ?? line.match(MULTILINE_IMPORT_FROM);
    if (!match) continue;
    const specifier = match[1];
    if (!isForbiddenProviderModuleSpecifier(specifier)) continue;
    violations.push({
      file: normalizePosixPath(filePath),
      line: index + 1,
      specifier,
    });
  }

  return violations;
}

export function scanImagingOsFoundationProviderImports(input: {
  imagingOsDir: string;
  readFile: (absolutePath: string) => string;
  listFiles: (imagingOsDir: string) => string[];
}): ImagingOsProviderImportViolation[] {
  const violations: ImagingOsProviderImportViolation[] = [];

  for (const file of input.listFiles(input.imagingOsDir)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    if (isImagingOsProviderAdapterModule(file)) continue;

    const source = input.readFile(`${input.imagingOsDir}/${file}`);
    for (const violation of findForbiddenProviderImportsInSource(source, `src/lib/imaging-os/${file}`)) {
      violations.push(violation);
    }
  }

  return violations;
}