# ShelbyHost deployment infrastructure

## Architecture and reference

The DevStation reference was inspected in `services/runner/src/sandbox.ts`,
`publish.ts`, `server.ts`, `limits.ts`, its build/deploy API routes, and Caddy
configuration. ShelbyHost retains the separate gVisor worker and hostname routing
pattern. It replaces DevStation's local published directories with immutable
Shelby blobs and a transactional Postgres production pointer.

Source → durable queue → clone pinned commit → install → typecheck/build →
validate → upload and read back Shelby blobs → confirm Aptos fee/registry →
atomic publication → hostname gateway.

The dashboard and control-plane APIs run on Netlify with Dynamic authentication
and a native Aptos connector. Workers run on dedicated Linux VMs with Docker and
gVisor (`runsc`). A separate Caddy gateway serves Shelby artifacts for the wildcard
domain; see `infra/NETLIFY-SETUP.md` for the exact DNS and TLS configuration.

## Supported applications

This pipeline builds applications producing static HTML/CSS/JS, including Vite,
React, Astro static output, Next static export, Nuxt generated output, and SvelteKit
with a static adapter. It does **not** run persistent Node servers, SSR handlers,
functions, databases, or containers from submitted repositories. Missing static
output fails validation with an actionable error. Builds needing outbound network
access (remote fonts, content APIs) must vendor those inputs; build-stage network
access is disabled.

A package.json and a build script or explicit build command are required.
Conflicting lockfiles fail; frozen installation is used when a lockfile exists.
Root tsconfig projects get an additional TypeScript check. GitHub is recommended
for repositories larger than the 2 MiB source-upload limit.

## Provisioning

1. Apply the migrations with the Supabase CLI to the intended environment. Back up
   an existing database first. The pipeline tables/RPCs are service-role only;
   browsers authenticate through the owned-project API. A correction in the older
   product migration makes fresh installs handle domain statuses and constraints
   in the proper order; already-applied installations need only the new migration.
2. Build the worker image: `docker build -t shelby-build:1 services/build-worker/image`.
   Install/register gVisor's `runsc` Docker runtime. No runc fallback is allowed.
3. Install this repository and dependencies under `/opt/shelbyhost` on the dedicated
   worker VM. Configure `/etc/shelbyhost/worker.env` from `infra/worker.env.example`,
   using the existing GitHub encryption key. Protect this file (0600). Fund the
   Shelby storage signer. Connected wallets authorize Aptos fees and registry
   writes without exporting private keys to ShelbyHost.
4. Install `infra/shelby-worker.service`. Its account requires Docker access and
   must have no unrelated workloads or credentials on the host. Each process runs
   one build at a time; add worker VMs for concurrency. Never expose Docker TCP.
5. Install the gateway service on a separate host with `infra/gateway.env.example`.
   It needs the server-side database credential and Shelby read credential, **not**
   wallet encryption or signing keys. Keep it behind Caddy on loopback port 8090.
6. Configure the wildcard CNAME and explicit gateway address described in
   `infra/NETLIFY-SETUP.md`. Keep apex/www on Netlify. Build the pinned Caddy binary
   and set its ACME email and Netlify DNS token. Ports 80/443 must be
   publicly reachable for ACME. The local ask endpoint permits certificates only
   for published projects/releases and verified custom domains. No per-project DNS
   records are necessary. Configure `SHELBY_CUSTOM_DOMAIN_TARGET` to a gateway DNS
   hostname for custom CNAMEs. Domain registration requires a per-domain TXT proof.
7. Configure GitHub OAuth/token encryption as before. Native signed push webhooks
   need GITHUB_WEBHOOK_SECRET. Alternatively generate the minimal repository
   workflow: it queues work and links the user to ShelbyHost logs; Actions success
   means queued, not deployed. Native pull-request preview builds are not yet
   implemented. Each ready release has a distinct immutable version hostname.
8. Run a staging deployment with a funded wallet; verify logs, a Shelby manifest,
   registry receipt, real production URL, failed redeploy preservation, and rollback
   before enabling public signups. Local tests do not replace this live check.

## Security and limits

Each stage uses a new non-root gVisor container with a read-only root filesystem,
no capabilities, no-new-privileges, 2 CPUs, 3 GiB RAM, 256 processes, and a bounded
2 GiB tmpfs workspace. A small trusted keeper keeps that tmpfs mounted across
stages. Install/clone use a per-job internal network and a registry-only CONNECT
proxy that pins public IPv4 destinations. The trusted proxy uses the standard
container runtime for Docker DNS/network compatibility; it never loads repository
code or mounts the build workspace. All submitted code executes under gVisor. Build and inspection have no network.
The proxy has no project secrets or storage keys. Own-project build variables
arrive on stdin; platform secrets never enter the build environment. Compilation
can embed build variables into public JavaScript: never use private runtime
secrets as frontend variables.

Whole jobs have a 20-minute deadline and a renewable 180-second database lease.
Logs are capped at 2 MiB/20,000 lines, 64 KiB per line; exceeding limits fails the
build. Artifacts are limited to 2,000 files, 50 MiB/file and 100 MiB total. Symlinks,
hardlinks, private/source files and invalid paths are rejected. All stages stop on
nonzero exit, with stdout/stderr, stage and exit code persisted. No truncation
silently turns a failing build into success.

Cleanup removes containers, per-job networks and volumes on success/failure.
A startup/periodic janitor removes tagged resources after 30 minutes following a
worker crash. Configure service auto-restart and alert if the worker or janitor
fails; a stopped host cannot run cleanup until it restarts.

## Versions, promotion and retention

Only a publishing worker holding the current lease can mark a release ready.
Publication requires validated artifacts, successful Shelby uploads and read-back
hash verification, and a confirmed Aptos registry transaction. A ready release
only becomes production if it remains the project's desired deployment. Failed or
older queued builds cannot overwrite production; rollback also updates this
pointer so an already-running build cannot undo the rollback.

Release rows and content hashes are immutable. Rollback changes the production
pointer and metadata without rebuilding. Gateway responses verify size and SHA256
against the manifest. Version URLs are immutable-cacheable; production routes use
no-store so rollback is immediate.

Shelby retention defaults to 365 days. Operators must fund/renew storage before
expiry; the current code does not auto-renew expired blobs. Historical rollback
requires retained, available blobs. Never promise permanent availability merely
because a release has a content hash. Old Supabase releases remain readable for
compatibility; all new deployments require Shelby and have no storage fallback.

## Verification commands

- `npm run build` — application and worker typecheck, production frontend build.
- `npm run test:build-sandbox` — actual Docker/gVisor install/build and isolation.
- `npm run test:deployment` — source contracts, routing and integrity tests.
- `npm run test:deployment-db` provisions a disposable Postgres container and applies
  every migration before running the transactional tests. Alternatively, run
  `services/build-worker/tests/pipeline.sql` — transactions, ownership, stage
  ordering, event deduplication, immutable releases, failed-build preservation and
  rollback versus in-flight builds. The SQL uses fixture storage receipts only;
  it does not claim a live Shelby upload or on-chain transaction.
