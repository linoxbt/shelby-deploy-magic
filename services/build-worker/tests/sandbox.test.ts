import test from "node:test";
import assert from "node:assert/strict";
import { Sandbox, ProcessFailure, processRun } from "../sandbox";
import { detect } from "../detect";
const encode = (path: string, content: string) => ({
  path,
  content: Buffer.from(content).toString("base64"),
});
test(
  "gVisor: real installation/build, validation, errors and isolation",
  { timeout: 240000 },
  async (t) => {
    const sandbox = new Sandbox();
    try {
      await sandbox.prepare();
      await sandbox.inspect({
        mode: "source",
        files: [
          encode(
            "package.json",
            JSON.stringify({
              scripts: { build: "node build.mjs" },
              dependencies: { "is-number": "7.0.0", typescript: "5.8.3" },
            }),
          ),
          encode(
            "build.mjs",
            `import fs from 'node:fs';import number from 'is-number';if(!number(3))throw Error('dependency failed');fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/index.html','<!doctype html><html><body><script src="/app.js"></script></body></html>');fs.writeFileSync('dist/app.js','console.log("built")');`,
          ),
        ],
      });
      const info = await sandbox.inspect({ mode: "detect", rootDirectory: "." }),
        plan = detect(info, { rootDirectory: "." });
      const logs: string[] = [];
      await sandbox.run(plan.install, {
        network: true,
        root: ".",
        log: (stream, line) => logs.push(`${stream}:${line}`),
        timeout: 120000,
      });
      assert.ok(logs.length > 0);
      await sandbox.run(["npm", "run", "build"], { root: ".", timeout: 30000 });
      const output = await sandbox.inspect({
        mode: "artifacts",
        rootDirectory: ".",
        candidates: plan.candidates,
      });
      assert.deepEqual(
        output.files.map((f: any) => f.path),
        ["/app.js", "/index.html"],
      );
      await t.test("nonzero exit and stderr survive", async () => {
        await assert.rejects(
          sandbox.run(["node", "-e", 'console.error("fixture build error");process.exit(42)']),
          (e) =>
            e instanceof ProcessFailure &&
            e.exitCode === 42 &&
            e.message.includes("fixture build error"),
        );
      });
      await t.test("TypeScript diagnostic output is preserved", async () => {
        await sandbox.run(
          ["node", "-e", "require('fs').writeFileSync('bad.ts','const n: number = \"wrong\";')"],
          { root: "." },
        );
        const lines: string[] = [];
        await assert.rejects(
          sandbox.run(["node_modules/.bin/tsc", "--noEmit", "bad.ts"], {
            root: ".",
            log: (_stream, line) => lines.push(line),
          }),
          (e) => e instanceof ProcessFailure && e.exitCode === 2,
        );
        assert.ok(lines.some((line) => line.includes("TS2322")));
      });
      await t.test("syntax and unresolved module failures are not hidden", async () => {
        await assert.rejects(sandbox.run(["node", "-e", "const broken = ;"]), /SyntaxError/);
        await assert.rejects(
          sandbox.run(["node", "-e", "require('missing-fixture-dependency')"], { root: "." }),
          /MODULE_NOT_FOUND/,
        );
      });
      await t.test("dependency installation failures retain exit status", async () => {
        await assert.rejects(
          sandbox.run(["npm", "install", "is-number@0.0.0-nonexistent", "--fetch-retries=0"], {
            network: true,
            root: ".",
            timeout: 30000,
          }),
          (e) => e instanceof ProcessFailure && e.exitCode !== 0 && e.message.includes("ETARGET"),
        );
      });
      await t.test("only supplied project environment reaches a build", async () => {
        const result = await sandbox.run(
          [
            "node",
            "-e",
            "console.log(process.env.PROJECT_FIXTURE);if(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SHELBY_PRIVATE_KEY)process.exit(2)",
          ],
          { env: { PROJECT_FIXTURE: "own-project" } },
        );
        assert.equal(result.stdout.trim(), "own-project");
      });
      await t.test("GitHub source can be fetched through the isolated proxy", async () => {
        const result = await sandbox.run(
          [
            "git",
            "ls-remote",
            "--exit-code",
            "https://github.com/linoxbt/shelby-deploy-magic.git",
            "HEAD",
          ],
          { network: true, timeout: 30000 },
        );
        assert.match(result.stdout, /^[a-f0-9]{40}\s+HEAD/m);
      });
      await t.test("filesystem and process identity", async () => {
        const r = await sandbox.run([
          "node",
          "-e",
          `const fs=require('fs');if(process.getuid()!==1000)process.exit(1);try{fs.writeFileSync('/etc/escape','x');process.exit(2)}catch(e){if(e.code!=='EROFS'&&e.code!=='EACCES')throw e}if(fs.existsSync('/var/run/docker.sock'))process.exit(3);`,
        ]);
        assert.equal(r.code, 0);
      });
      await t.test("build network is unavailable", async () => {
        await sandbox.run(
          [
            "node",
            "-e",
            `fetch('https://registry.npmjs.org',{signal:AbortSignal.timeout(2000)}).then(()=>process.exit(1),()=>process.exit(0))`,
          ],
          { timeout: 10000 },
        );
      });
      await t.test("deadline terminates container", async () => {
        await assert.rejects(
          sandbox.run(["node", "-e", "setInterval(()=>{},1000)"], { timeout: 1500 }),
          (e) => e instanceof ProcessFailure && e.timedOut,
        );
      });
      await t.test("missing output is rejected", async () => {
        await assert.rejects(
          sandbox.inspect({ mode: "artifacts", rootDirectory: ".", outputDirectory: "absent" }),
        );
      });
      await t.test("symlink artifacts are rejected", async () => {
        await sandbox.run(["ln", "-s", "/etc/passwd", "/workspace/source/dist/leak"]);
        await assert.rejects(
          sandbox.inspect({ mode: "artifacts", rootDirectory: ".", candidates: ["dist"] }),
          /Non-regular artifact/,
        );
      });
    } catch (error) {
      console.error(
        (
          await processRun("docker", ["logs", sandbox.proxy]).catch(() => ({
            stdout: "",
            stderr: "",
          }))
        ).stderr,
      );
      throw error;
    } finally {
      await sandbox.cleanup();
    }
    const resources = await processRun("docker", [
      "ps",
      "-a",
      "--filter",
      `name=${sandbox.id}`,
      "--format",
      "{{.Names}}",
    ]);
    assert.equal(resources.stdout.trim(), "");
    await assert.rejects(processRun("docker", ["volume", "inspect", sandbox.volume]));
  },
);
