import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { getSupabaseAdmin, projectUrl } from "../../api/_lib/supabase";
import { decryptWalletSecret } from "../../api/_lib/wallet";
import { githubAccess } from "../../api/_lib/build-queue";
import {
  buildConfigSchema,
  sourceSchema,
  validateSource,
  type Stage,
} from "../../api/_lib/build-contract";
import { detect } from "./detect";
import { Sandbox, ProcessFailure, sweepExpiredSandboxes, type LogSink } from "./sandbox";
import { artifactManifest, uploadRelease } from "./storage";
import { registerRelease } from "./registry";
import { releaseUrl } from "../../api/_lib/routing";

export function redact(text: string, secrets: string[]) {
  let result = text
    // eslint-disable-next-line no-control-regex
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  for (const secret of secrets.filter(Boolean).sort((a, b) => b.length - a.length))
    result = result.split(secret).join("[REDACTED]");
  return result;
}
export async function executeJob(job: any, db = getSupabaseAdmin()) {
  const controller = new AbortController();
  const sandbox = new Sandbox(undefined, controller.signal);
  let stage: Stage = "preparing",
    bytes = 0,
    lineCount = 0,
    tail = "",
    leaseError: Error | undefined;
  const secrets: string[] = [];
  let pending: Array<{ stream: string; line: string; stage: string }> = [];
  let chain = Promise.resolve();
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await db.rpc(name, args);
    if (error) throw new Error(error.message);
    return data;
  };
  const update = (next?: Stage, patch: Record<string, unknown> = {}) => {
    const logs = pending;
    pending = [];
    chain = chain.then(async () => {
      await rpc("shelby_update_job", {
        p_id: job.deployment_id,
        p_lease: job.lease_token,
        p_stage: next || null,
        p_patch: patch,
        p_logs: logs,
      });
    });
    return chain;
  };
  const log: LogSink = (stream, line) => {
    const clean = redact(line, secrets);
    bytes += Buffer.byteLength(clean) + 1;
    lineCount++;
    if (bytes > 2 * 1024 * 1024 || lineCount > 20000)
      throw new ProcessFailure("Build log limit of 2 MiB exceeded; build stopped");
    pending.push({ stream, line: clean, stage });
    if (stream === "stderr") tail = (tail + "\n" + clean).slice(-3500);
  };
  const advance = async (next: Stage, patch: Record<string, unknown> = {}) => {
    controller.signal.throwIfAborted();
    await update(next, patch);
    stage = next;
    log("system", `Stage: ${next}`);
  };
  const timer = setTimeout(
    () => controller.abort(new Error("Deployment exceeded the 20-minute deadline")),
    20 * 60 * 1000,
  );
  const heartbeat = setInterval(() => {
    update().catch((error) => {
      leaseError = error;
      controller.abort(error);
    });
  }, 2000);
  try {
    const config = buildConfigSchema.parse(job.config),
      source = sourceSchema.parse(job.source);
    validateSource(source);
    const { data: project, error } = await db
      .from("shelby_projects")
      .select("*")
      .eq("id", job.project_id)
      .single();
    if (error) throw error;
    if (!process.env.SHELBY_API_KEY || !process.env.SHELBY_PRIVATE_KEY)
      throw new Error(
        "Shelby credentials are required. Deployments cannot fall back to another storage backend.",
      );
    for (const [key, value] of Object.entries(process.env))
      if (/SECRET|PRIVATE_KEY|TOKEN|SERVICE_ROLE|API_KEY/.test(key) && value) secrets.push(value);
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(job.env_encrypted || {})) {
      if (
        !/^[A-Z_][A-Z0-9_]*$/.test(key) ||
        /^(PATH|HOME|NODE_OPTIONS|LD_.*|DYLD_.*|BASH_ENV|ENV|SHELL|GIT_.*|.*PROXY|npm_config_.*)$/i.test(
          key,
        )
      )
        throw new Error(`Reserved build environment variable: ${key}`);
      env[key] = decryptWalletSecret(String(value));
      secrets.push(env[key]);
    }
    await sandbox.prepare();
    log("system", "Prepared gVisor sandbox: 2 CPUs, 3 GiB memory, 2 GiB workspace, 256 processes");
    await advance("cloning");
    if (source.kind === "github") {
      if (!source.commit) throw new Error("Queue entry must pin a Git commit before cloning");
      const { token } = await githubAccess(project.owner_id, source.repository);
      secrets.push(token);
      const gitEnv: Record<string, string> = {
        GIT_CONFIG_COUNT: token ? "3" : "2",
        GIT_CONFIG_KEY_0: "core.hooksPath",
        GIT_CONFIG_VALUE_0: "/dev/null",
        GIT_CONFIG_KEY_1: "protocol.file.allow",
        GIT_CONFIG_VALUE_1: "never",
      };
      if (token) {
        gitEnv.GIT_CONFIG_KEY_2 = `http.https://github.com/${source.repository}.git.extraheader`;
        gitEnv.GIT_CONFIG_VALUE_2 = `Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`;
        secrets.push(gitEnv.GIT_CONFIG_VALUE_2);
      }
      await sandbox.run(
        [
          "sh",
          "-eu",
          "-c",
          'mkdir -p source home; git init source; cd source; git remote add origin "$1"; git fetch --depth=1 origin "$2"; git checkout --detach FETCH_HEAD; git rev-parse HEAD > /workspace/commit',
          "clone",
          `https://github.com/${source.repository}.git`,
          source.commit,
        ],
        { network: true, env: gitEnv, log, timeout: 180000 },
      );
    } else {
      await sandbox.inspect({ mode: "source", files: source.files });
      log("system", `Prepared ${source.files.length} submitted source files`);
    }
    const info = await sandbox.inspect({ mode: "detect", rootDirectory: config.rootDirectory });
    if (source.kind === "github" && info.commit !== source.commit)
      throw new Error("Cloned commit does not match the queued revision");
    const detected = detect(info, config);
    await advance("installing", {
      framework: detected.framework,
      package_manager: detected.packageManager,
      build_command: detected.buildCommand,
      commit_sha: info.commit,
    });
    log("system", `Detected ${detected.framework}; package manager ${detected.packageManager}`);
    if (detected.declaredPackageManager) {
      const actual = (
        await sandbox.run([detected.packageManager, "--version"], { root: config.rootDirectory })
      ).stdout.trim();
      const expected = detected.declaredPackageManager
        .slice(detected.packageManager.length + 1)
        .split("+")[0];
      if (actual !== expected)
        throw new Error(
          `Requested ${detected.declaredPackageManager}, but worker image provides ${detected.packageManager}@${actual}. Use a worker image with the requested version or update packageManager and its lockfile.`,
        );
    }
    await sandbox.run(detected.install, {
      network: true,
      root: config.rootDirectory,
      log,
      timeout: 600000,
    });
    await advance("building");
    if (detected.typecheck) {
      if (!detected.hasTypeScript)
        throw new Error("tsconfig.json exists but TypeScript is missing from dependencies");
      log("system", "Running TypeScript compilation check");
      await sandbox.run(
        [
          "sh",
          "-eu",
          "-c",
          "test -x node_modules/.bin/tsc; node_modules/.bin/tsc --build --pretty false",
        ],
        { root: config.rootDirectory, env, log, timeout: 180000 },
      );
    }
    log("system", `Build command: ${detected.buildCommand}`);
    await sandbox.run(["sh", "-eu", "-c", detected.buildCommand], {
      root: config.rootDirectory,
      env,
      log,
      timeout: 600000,
    });
    await advance("validating");
    const artifacts = await sandbox.inspect({
      mode: "artifacts",
      rootDirectory: config.rootDirectory,
      outputDirectory: config.outputDirectory,
      candidates: detected.candidates,
    });
    await update(undefined, { build_output: artifacts.outputDirectory });
    log(
      "system",
      `Validated ${artifacts.files.length} files (${artifacts.bytes} bytes) in ${artifacts.outputDirectory}`,
    );
    // Nothing from the repository is alive while the worker handles credentials.
    await sandbox.cleanup();
    await advance("uploading");
    const storage = await uploadRelease(
      project.id,
      job.deployment_id,
      artifacts.files,
      {
        framework: detected.framework,
        commit: info.commit,
        branch: source.kind === "github" ? source.branch : null,
        buildCommand: detected.buildCommand,
        outputDirectory: artifacts.outputDirectory,
      },
      (line) => log("system", line),
      controller.signal,
    );
    if (storage.hash !== artifactManifest(artifacts.files).hash)
      throw new Error("Artifact hash changed during storage");
    await advance("publishing");
    log("system", "Confirming deployment fee and registering artifact hash on Aptos");
    await registerRelease(db, project, storage.hash, (patch) => update(undefined, patch));
    controller.signal.throwIfAborted();
    log("system", "Shelby assets and manifest verified; requesting atomic promotion");
    await update();
    clearInterval(heartbeat);
    await chain;
    const promoted = await rpc("shelby_publish", {
      p_id: job.deployment_id,
      p_lease: job.lease_token,
      p_release: { ...storage, versionUrl: releaseUrl(job.deployment_id) },
    });
    return { id: job.deployment_id, status: "ready", promoted };
  } catch (error) {
    clearInterval(heartbeat);
    const message = redact(
      `${stage}: ${error instanceof Error ? error.message : String(error)}${tail ? "\nLast stderr:" + tail : ""}`,
      secrets,
    ).slice(0, 8000);
    await chain.catch(() => {});
    if (!leaseError) {
      await rpc("shelby_update_job", {
        p_id: job.deployment_id,
        p_lease: job.lease_token,
        p_logs: pending,
      }).catch(() => {});
      await rpc("shelby_fail", {
        p_id: job.deployment_id,
        p_lease: job.lease_token,
        p_error: message,
        p_exit: error instanceof ProcessFailure ? error.exitCode : null,
      }).catch((e) => console.error("Could not persist build failure:", e.message));
    }
    return { id: job.deployment_id, status: "failed", stage, error: message };
  } finally {
    clearInterval(heartbeat);
    clearTimeout(timer);
    controller.abort();
    await sandbox.cleanup();
  }
}

async function main() {
  await sweepExpiredSandboxes();
  const janitor = setInterval(() => {
    void sweepExpiredSandboxes().catch((e) => console.error("Janitor failed:", e.message));
  }, 60000);
  const db = getSupabaseAdmin(),
    workerId = `worker-${randomUUID()}`;
  let stopping = false;
  process.on("SIGTERM", () => {
    stopping = true;
  });
  process.on("SIGINT", () => {
    stopping = true;
  });
  while (!stopping) {
    try {
      const { data, error } = await db.rpc("shelby_claim", { p_worker: workerId });
      if (error) throw error;
      if (data?.[0]) {
        const result = await executeJob(data[0], db);
        console.log(JSON.stringify({ id: result.id, status: result.status }));
      } else await new Promise((r) => setTimeout(r, 2000));
    } catch (error) {
      console.error("Worker queue error:", error instanceof Error ? error.message : String(error));
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  clearInterval(janitor);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
