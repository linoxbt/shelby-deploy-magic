import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { StringDecoder } from "node:string_decoder";

export class ProcessFailure extends Error {
  constructor(
    message: string,
    public exitCode: number | null = null,
    public timedOut = false,
  ) {
    super(message);
  }
}
export type LogSink = (stream: "stdout" | "stderr" | "system", line: string) => void;
export function processRun(
  command: string,
  args: string[],
  options: {
    input?: string;
    timeout?: number;
    captureLimit?: number;
    log?: LogSink;
    signal?: AbortSignal;
  } = {},
) {
  return new Promise<{ stdout: string; stderr: string; code: number }>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { PATH: process.env.PATH },
    });
    let stdout = "",
      stderr = "",
      captureBytes = 0,
      done = false,
      aborted = false;
    const decoders = { stdout: new StringDecoder("utf8"), stderr: new StringDecoder("utf8") };
    const pending = { stdout: "", stderr: "" };
    const fail = (error: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      child.kill("SIGKILL");
      reject(error);
    };
    const abort = () => {
      aborted = true;
      fail(new ProcessFailure("Worker lease lost or build cancelled", null));
    };
    const timer = setTimeout(
      () =>
        fail(
          new ProcessFailure(`Process timed out after ${options.timeout || 60000} ms`, 124, true),
        ),
      options.timeout || 60000,
    );
    for (const stream of ["stdout", "stderr"] as const)
      child[stream].on("data", (buffer: Buffer) => {
        try {
          if (!options.log || stream === "stderr") {
            captureBytes += buffer.length;
            if (captureBytes > (options.captureLimit || 2 * 1024 * 1024))
              throw new ProcessFailure("Process output exceeded its byte limit");
            if (stream === "stdout") stdout += buffer.toString("utf8");
            else stderr += buffer.toString("utf8");
          }
          if (options.log) {
            pending[stream] += decoders[stream].write(buffer);
            const lines = pending[stream].split(/\r?\n/);
            pending[stream] = lines.pop() || "";
            if (pending[stream].length > 65536 || lines.some((line) => line.length > 65536))
              throw new ProcessFailure("Log line exceeds 64 KiB");
            for (const line of lines) options.log(stream, line);
          }
        } catch (error) {
          fail(error as Error);
        }
      });
    child.stdin.on("error", () => {});
    child.on("error", fail);
    child.on("close", (code) => {
      if (done) return;
      try {
        for (const stream of ["stdout", "stderr"] as const) {
          const line = pending[stream] + decoders[stream].end();
          if (line) options.log?.(stream, line);
        }
      } catch (error) {
        fail(error as Error);
        return;
      }
      done = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      if (code !== 0 || aborted)
        reject(new ProcessFailure(`Process exited ${code}: ${stderr.slice(-3000)}`, code));
      else resolve({ stdout, stderr, code: 0 });
    });
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) {
      abort();
      return;
    }
    child.stdin.end(options.input);
  });
}

export class Sandbox {
  readonly id = `shelby-${randomUUID()}`;
  readonly volume = `${this.id}-work`;
  readonly network = `${this.id}-net`;
  readonly proxy = `${this.id}-egress`;
  readonly keeper = `${this.id}-keeper`;
  readonly expires = String(Date.now() + 30 * 60 * 1000);
  private containers = new Set<string>();
  private proxyAddress = "";
  constructor(
    readonly image = process.env.SHELBY_BUILD_IMAGE || "shelby-build:1",
    readonly signal?: AbortSignal,
  ) {}
  async prepare() {
    const runtime = JSON.parse(
      (await processRun("docker", ["info", "--format", "{{json .Runtimes}}"])).stdout,
    );
    if (!runtime.runsc)
      throw new Error("gVisor runtime runsc is required; no weaker runtime fallback is allowed");
    await processRun("docker", ["image", "inspect", this.image]);
    await processRun("docker", [
      "volume",
      "create",
      "--label",
      "shelby.build=true",
      "--label",
      `shelby.expires=${this.expires}`,
      "--driver",
      "local",
      "--opt",
      "type=tmpfs",
      "--opt",
      "device=tmpfs",
      "--opt",
      "o=size=2g,uid=1000,gid=1000,mode=0700,exec,nosuid",
      this.volume,
    ]);
    // Keep the tmpfs volume mounted between short-lived stage containers.
    await processRun("docker", [
      "run",
      "-d",
      "--name",
      this.keeper,
      "--label",
      "shelby.build=true",
      "--label",
      `shelby.expires=${this.expires}`,
      "--runtime",
      "runsc",
      "--network",
      "none",
      "--read-only",
      "--user",
      "1000:1000",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--memory",
      "256m",
      "--memory-swap",
      "256m",
      "--cpus",
      "0.25",
      "--pids-limit",
      "128",
      "--mount",
      `type=volume,src=${this.volume},dst=/workspace,volume-nocopy`,
      this.image,
      "node",
      "-e",
      "setTimeout(()=>{},1800000)",
    ]);
    await processRun("docker", [
      "network",
      "create",
      "--internal",
      "--label",
      "shelby.build=true",
      "--label",
      `shelby.expires=${this.expires}`,
      this.network,
    ]);
    await processRun("docker", [
      "create",
      "--name",
      this.proxy,
      "--label",
      "shelby.build=true",
      "--label",
      `shelby.expires=${this.expires}`,
      "--runtime",
      "runc",
      "--network",
      this.network,
      "--network-alias",
      "egress",
      "--read-only",
      "--user",
      "1000:1000",
      "--cap-drop",
      "ALL",
      "--security-opt",
      "no-new-privileges",
      "--memory",
      "128m",
      "--memory-swap",
      "128m",
      "--cpus",
      "0.25",
      "--pids-limit",
      "64",
      this.image,
      "node",
      "/opt/shelby/egress.mjs",
    ]);
    await processRun("docker", ["network", "connect", "bridge", this.proxy]);
    await processRun("docker", ["start", this.proxy]);
    const proxyInfo = JSON.parse((await processRun("docker", ["inspect", this.proxy])).stdout)[0];
    this.proxyAddress = proxyInfo.NetworkSettings.Networks[this.network].IPAddress;
    if (!this.proxyAddress) throw new Error("Egress proxy has no internal address");
  }
  async run(
    args: string[],
    options: {
      network?: boolean;
      root?: string;
      env?: Record<string, string>;
      input?: string;
      timeout?: number;
      captureLimit?: number;
      log?: LogSink;
      readOnly?: boolean;
    } = {},
  ) {
    const name = `${this.id}-${randomUUID().slice(0, 8)}`;
    this.containers.add(name);
    const env = {
      HOME: "/workspace/home",
      CI: "true",
      NO_COLOR: "1",
      npm_config_cache: "/workspace/cache",
      GIT_TERMINAL_PROMPT: "0",
      ...options.env,
      ...(options.network
        ? {
            HTTPS_PROXY: `http://${this.proxyAddress}:3128`,
            HTTP_PROXY: `http://${this.proxyAddress}:3128`,
            https_proxy: `http://${this.proxyAddress}:3128`,
            http_proxy: `http://${this.proxyAddress}:3128`,
            npm_config_proxy: `http://${this.proxyAddress}:3128`,
            npm_config_https_proxy: `http://${this.proxyAddress}:3128`,
          }
        : {}),
    };
    // Environment arrives over stdin, never Docker inspect/argv. The bootstrap is
    // fixed code in the read-only image's Node runtime, not imported from source.
    const bootstrap = `const fs=require('node:fs'),cp=require('node:child_process');const p=JSON.parse(fs.readFileSync(0,'utf8'));const child=cp.spawn(p.args[0],p.args.slice(1),{cwd:p.cwd,env:{PATH:process.env.PATH,...p.env},stdio:['pipe',1,2]});child.stdin.on('error',()=>{});child.stdin.end(p.input||'');child.on('error',e=>{console.error(e.message);process.exitCode=1});child.on('exit',(code,signal)=>{process.exitCode=code===null?137:code});`;
    try {
      return await processRun(
        "docker",
        [
          "run",
          "--rm",
          "-i",
          "--name",
          name,
          "--label",
          "shelby.build=true",
          "--label",
          `shelby.expires=${this.expires}`,
          "--runtime",
          "runsc",
          "--network",
          options.network ? this.network : "none",
          "--memory",
          "3g",
          "--memory-swap",
          "3g",
          "--cpus",
          "2",
          "--pids-limit",
          "256",
          "--cap-drop",
          "ALL",
          "--security-opt",
          "no-new-privileges",
          "--read-only",
          "--user",
          "1000:1000",
          "--ulimit",
          "nofile=1024:1024",
          "--tmpfs",
          "/tmp:rw,noexec,nosuid,mode=1777,size=128m",
          "--mount",
          `type=volume,src=${this.volume},dst=/workspace,volume-nocopy${options.readOnly ? ",readonly" : ""}`,
          this.image,
          "node",
          "-e",
          bootstrap,
        ],
        {
          input: JSON.stringify({
            args,
            env,
            cwd: options.root ? `/workspace/source/${options.root}` : "/workspace",
            input: options.input,
          }),
          timeout: options.timeout || 600000,
          captureLimit: options.captureLimit,
          log: options.log,
          signal: this.signal,
        },
      );
    } finally {
      await processRun("docker", ["rm", "-f", name]).catch(() => {});
      this.containers.delete(name);
    }
  }
  async inspect(input: Record<string, unknown>) {
    const result = await this.run(["node", "/opt/shelby/inspect.mjs"], {
      input: JSON.stringify(input),
      readOnly: input.mode !== "source",
      captureLimit: 145 * 1024 * 1024,
      timeout: 90000,
    });
    return result.stdout ? JSON.parse(result.stdout) : null;
  }
  async cleanup() {
    for (const name of [...this.containers, this.proxy, this.keeper])
      await processRun("docker", ["rm", "-f", name]).catch(() => {});
    await processRun("docker", ["network", "rm", this.network]).catch(() => {});
    await processRun("docker", ["volume", "rm", this.volume]).catch(() => {});
  }
}

// Dedicated worker hosts only. A crashed worker cannot clean its own resources;
// the next worker and a periodic janitor remove expired, explicitly tagged jobs.
export async function sweepExpiredSandboxes(now = Date.now()) {
  for (const kind of ["container", "network", "volume"]) {
    const listed = await processRun("docker", [
      kind,
      "ls",
      "--filter",
      "label=shelby.build=true",
      "--format",
      kind === "volume" ? "{{.Name}}" : "{{.ID}}",
    ]);
    for (const id of listed.stdout.trim().split("\n").filter(Boolean)) {
      const inspected = JSON.parse((await processRun("docker", [kind, "inspect", id])).stdout)[0];
      const labels = inspected.Config?.Labels || inspected.Labels || {};
      const expires = Number(labels["shelby.expires"]);
      if (
        labels["shelby.build"] === "true" &&
        Number.isFinite(expires) &&
        expires > 0 &&
        expires < now
      ) {
        await processRun("docker", [kind, "rm", ...(kind === "container" ? ["-f"] : []), id]).catch(
          (error) => console.error("Sandbox cleanup failed:", error.message),
        );
      }
    }
  }
}
