import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
const name = `shelby-db-test-${randomUUID().slice(0, 8)}`;
function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", timeout: 120000 });
  if (result.status !== 0) throw Error(result.stderr || result.error?.message || "Docker failed");
  return result.stdout;
}
try {
  docker([
    "run",
    "-d",
    "--name",
    name,
    "-e",
    "POSTGRES_PASSWORD=disposable-test-only",
    "postgres:17-alpine",
  ]);
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      docker(["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]);
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!ready) throw Error("Postgres did not become ready");
  const bootstrap = `CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;CREATE SCHEMA storage;CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint);CREATE TABLE storage.objects(id uuid,bucket_id text);GRANT USAGE ON SCHEMA public TO service_role;ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;`;
  const migrations = readdirSync("supabase/migrations")
    .filter((n) => n.endsWith(".sql"))
    .sort()
    .map((n) => readFileSync(`supabase/migrations/${n}`, "utf8"))
    .join("\n");
  docker(
    ["exec", "-i", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
    bootstrap + "\n" + migrations,
  );
  docker(
    ["exec", "-i", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"],
    readFileSync("services/build-worker/tests/pipeline.sql", "utf8"),
  );
  console.log("PASS: all migrations and transactional deployment tests on PostgreSQL 17");
} finally {
  docker(["rm", "-f", name]);
}
