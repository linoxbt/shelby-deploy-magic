# ShelbyHost

ShelbyHost builds frontend applications in isolated workers, stores compiled
artifacts on Shelby Network, records their hashes on Aptos, and serves each project
at `https://<slug>.shelbyhost.xyz`.

The deployment pipeline executes real commands:

`Queued → Preparing → Cloning → Installing → Building → Validating → Uploading → Publishing → Ready`

Failures retain their stage, stdout/stderr logs and process exit code. Only a fully
successful release can replace production. Every successful deployment gets an
immutable version URL; rollback changes the production pointer without rebuilding.

## Components

- React/TanStack dashboard with Privy authentication, owned projects, GitHub
  integration, build settings, environment variables, live polling of logs and history.
- Supabase database with a durable build queue, worker leases, immutable release
  records and transactional promotion/rollback. No browser database writes.
- Dedicated Docker/gVisor workers. Submitted code has CPU, memory, process,
  filesystem, network, duration, artifact and log limits.
- Mandatory Shelby artifact storage with manifests and read-back hash verification.
  New deployments cannot fall back to another backend.
- Aptos managed-wallet publication, deployment fee receipts and registry integrity.
- Wildcard hostname gateway, stable project URLs, version URLs and verified custom domains.

## Development

Use Node 22:

```sh
npm ci
npm run dev
npm run build
npm run test:deployment
```

Existing Privy and Supabase frontend variables remain necessary. The API handlers
run on Vercel; `netlify.toml` builds only the frontend. A static frontend deployment
alone does not provide a build worker, APIs, Shelby credentials or wildcard gateway.

## Infrastructure setup

Read [the deployment infrastructure guide](docs-deployment-infrastructure.md) for
the DevStation architecture comparison, provisioning steps, security boundaries,
environment files, DNS/TLS, migration instructions and verification requirements.

Operator files are in [infra](infra). Keep secrets outside the repository. The
worker must have a funded Shelby signer, Supabase service credentials, the same
wallet/GitHub encryption keys as the control plane, and configured Aptos registry,
fee token and treasury. The managed project wallet needs gas and fee tokens.

```sh
docker build -t shelby-build:1 services/build-worker/image
npm run test:build-sandbox
npm run test:deployment-db
npm run worker
# Separate gateway host:
npm run gateway
```

Apply all migrations before starting the new worker. Regenerate old GitHub
workflows: direct artifact upload/finalization endpoints are retired. The new
workflow queues an isolated source build; use the dashboard for build results.

## Scope and retention

Supports applications producing static HTML/CSS/JS, including static exports of
frameworks. Persistent servers, SSR functions and native PR preview builds are not
implemented. Each repository needs package.json and a build script or configured
build command. Package-manager versions must match the worker image.

Shelby retention defaults to 365 days. Operators must fund storage and arrange
renewal; a content hash does not guarantee permanent availability. Rollback requires
retained blobs. Existing Supabase releases remain readable for compatibility.

Before production rollout, verify a real staging deployment through Shelby,
Aptos, public DNS and HTTPS. Local sandbox, database and gateway tests do not
establish that external infrastructure is provisioned.
