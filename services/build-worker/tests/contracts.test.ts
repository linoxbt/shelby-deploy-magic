import test from "node:test";
import assert from "node:assert/strict";
import { detect } from "../detect";
import { buildConfigSchema, sourceSchema, validateSource } from "../../../api/_lib/build-contract";
import { tenantRoute, requestAssetPath } from "../../../api/_lib/routing";
import { boundedBody } from "../../../api/_lib/bounded-body";
import { artifactManifest } from "../manifest";
test("reject traversal and ambiguous sources", () => {
  for (const path of ["../app", "/etc/passwd", "src/../app", "a//b"])
    assert.throws(() => buildConfigSchema.parse({ rootDirectory: path }));
  assert.throws(() =>
    validateSource(
      sourceSchema.parse({ kind: "upload", files: [{ path: ".env", content: "eA==" }] }),
    ),
  );
  assert.throws(() =>
    validateSource(sourceSchema.parse({ kind: "github", repository: "../repo", branch: "main" })),
  );
});
test("detect frozen installs and reject conflicting managers or missing build", () => {
  const plan = detect(
    {
      pkg: { scripts: { build: "vite build" }, devDependencies: { vite: "6" } },
      names: ["package-lock.json"],
      tsconfig: false,
    },
    { rootDirectory: "." },
  );
  assert.equal(plan.framework, "vite");
  assert.equal(plan.install[1], "ci");
  assert.throws(
    () =>
      detect(
        {
          pkg: { scripts: { build: "x" } },
          names: ["yarn.lock", "package-lock.json"],
          tsconfig: false,
        },
        { rootDirectory: "." },
      ),
    /Conflicting/,
  );
  assert.throws(
    () => detect({ pkg: {}, names: [], tsconfig: false }, { rootDirectory: "." }),
    /Missing/,
  );
});
test("host routing separates tenant API paths and control plane", () => {
  assert.equal(tenantRoute("shelbyhost.xyz"), null);
  assert.deepEqual(tenantRoute("my-app.shelbyhost.xyz"), { slug: "my-app" });
  assert.deepEqual(tenantRoute("example.org"), { domain: "example.org" });
  assert.equal(requestAssetPath("/api/app"), "/api/app");
  for (const path of ["/%2e%2e/private", "/%252e%252e/private", "/.env", "/a\\b"])
    assert.throws(() => requestAssetPath(path));
});
test("manifest hash is deterministic and responds to bytes and paths", () => {
  const files = [
    { path: "/b.js", content: "eA==" },
    { path: "/index.html", content: "eQ==" },
  ];
  assert.equal(artifactManifest(files).hash, artifactManifest([...files].reverse()).hash);
  assert.notEqual(
    artifactManifest(files).hash,
    artifactManifest([{ ...files[0], path: "/c.js" }, files[1]]).hash,
  );
});
test("storage responses cannot exceed manifest size", async () => {
  await assert.rejects(boundedBody(new Response("too much"), 2), /exceeds/);
  assert.equal((await boundedBody(new Response("ok"), 2)).toString(), "ok");
});
