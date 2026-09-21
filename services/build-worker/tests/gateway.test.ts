import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import gateway from "../../../api/proxy-project";
test("gateway resolves active release, validates Shelby bytes and protects control-plane origin", async () => {
  process.env.SUPABASE_URL = "https://database.fixture";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
  process.env.SHELBY_RPC_URL = "https://storage.fixture";
  const original = globalThis.fetch,
    body = Buffer.from("<html>real fixture bytes</html>");
  let corrupt = false;
  const release = {
    id: "11111111-1111-4111-8111-111111111111",
    project_id: "22222222-2222-4222-8222-222222222222",
    status: "ready",
    content_hash: "a".repeat(64),
    shelby_owner_address: "0x123",
    shelby_manifest: [] as any[],
  };
  release.shelby_manifest = [
    {
      path: "/index.html",
      blobName: `releases/${release.project_id}/${release.id}/${release.content_hash}/index.html`,
      sha256: createHash("sha256").update(body).digest("hex"),
      size: body.length,
      type: "text/html",
    },
  ];
  globalThis.fetch = async (input, options) => {
    const url = String(input);
    if (url.startsWith("https://database.fixture/rest/v1/shelby_projects"))
      return Response.json({
        id: release.project_id,
        active_deployment_id: release.id,
        content_hash: release.content_hash,
      });
    if (url.startsWith("https://database.fixture/rest/v1/shelby_deployments")) {
      assert.ok(url.includes("status=eq.ready"));
      return Response.json(release);
    }
    if (url.startsWith("https://storage.fixture/"))
      return new Response(corrupt ? Buffer.alloc(body.length) : body);
    throw Error("Unexpected test fetch: " + url);
  };
  const request = async (host: string, path = "/deep/spa/route") => {
    const state = { status: 0, body: undefined as any, headers: {} as Record<string, string> };
    const res = {
      status(n: number) {
        state.status = n;
        return res;
      },
      setHeader(k: string, v: string) {
        state.headers[k] = v;
      },
      send(data: any) {
        state.body = data;
        return res;
      },
    };
    await gateway({ method: "GET", headers: { host }, url: path, query: { path } }, res);
    return state;
  };
  try {
    const success = await request("project.shelbyhost.xyz");
    assert.equal(success.status, 200);
    assert.deepEqual(success.body, body);
    assert.equal(success.headers["Cache-Control"], "no-store");
    assert.equal((await request("shelbyhost.xyz", "/api/proxy-project")).status, 404);
    assert.equal((await request("project.shelbyhost.xyz", "/missing.js")).status, 404);
    corrupt = true;
    assert.equal((await request("project.shelbyhost.xyz")).status, 502);
  } finally {
    globalThis.fetch = original;
  }
});
