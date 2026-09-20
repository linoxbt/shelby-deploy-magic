import { z } from "zod";

export const stages = [
  "queued",
  "preparing",
  "cloning",
  "installing",
  "building",
  "validating",
  "uploading",
  "publishing",
  "ready",
] as const;
export type Stage = (typeof stages)[number];
export const relativePath = z
  .string()
  .max(200)
  .refine(
    (value) =>
      value === "." ||
      (/^[A-Za-z0-9_./ -]+$/.test(value) &&
        !value.startsWith("/") &&
        !value.split("/").some((p) => !p || p === "." || p === "..")),
    "Use a relative path without traversal",
  );
export const buildConfigSchema = z
  .object({
    rootDirectory: relativePath.default("."),
    buildCommand: z.string().trim().min(1).max(500).optional(),
    outputDirectory: relativePath.optional(),
  })
  .strict();
export const sourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("github"),
      repository: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
      branch: z
        .string()
        .min(1)
        .max(200)
        .regex(/^[A-Za-z0-9_./-]+$/)
        .refine((v) => !v.startsWith("-") && !v.includes("..")),
      commit: z
        .string()
        .regex(/^[a-f0-9]{40}$/)
        .optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("upload"),
      files: z
        .array(
          z
            .object({
              path: relativePath.refine((p) => p !== "."),
              content: z
                .string()
                .max(3_000_000)
                .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/),
            })
            .strict(),
        )
        .min(1)
        .max(2000),
    })
    .strict(),
]);
export type BuildSource = z.infer<typeof sourceSchema>;
export type BuildConfig = z.infer<typeof buildConfigSchema>;
export function validateSource(source: BuildSource) {
  if (source.kind === "github") {
    if (source.repository.split("/").some((p) => p === "." || p === ".."))
      throw new Error("Invalid repository path");
    return;
  }
  const seen = new Set<string>();
  let bytes = 0;
  for (const f of source.files) {
    if (seen.has(f.path)) throw new Error(`Duplicate source file: ${f.path}`);
    if (
      f.path
        .split("/")
        .some((p) => [".git", "node_modules", ".env"].includes(p) || p.startsWith(".env."))
    )
      throw new Error(`Do not upload private or generated files: ${f.path}`);
    seen.add(f.path);
    bytes += Buffer.byteLength(f.content, "base64");
  }
  if (bytes > 2 * 1024 * 1024)
    throw new Error("Source upload exceeds 2 MiB. Use GitHub for larger projects.");
}
export const deploymentColumns =
  "id,project_id,status,stage,failed_stage,error_message,exit_code,started_at,finished_at,created_at,duration_ms,commit_sha,branch,build_command,build_output,framework,package_manager,content_hash,version_url,storage_backend,shelby_owner_address,shelby_manifest_url,shelby_uploaded_at,registry_tx_hash,payment_tx_hash,message,trigger,pipeline_version";
