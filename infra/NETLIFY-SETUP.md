# ShelbyHost production setup

Netlify serves `shelbyhost.xyz`, `www.shelbyhost.xyz`, the dashboard and
`/api/*`. Tenant traffic uses the dedicated gateway because artifacts can exceed
Function response limits and user builds must execute only inside isolated workers.

## Required values

- Dynamic environment ID with the Aptos connector enabled
- Supabase URL and service-role key
- public address for a dedicated gateway VM
- separate Docker worker VM with the `runsc` gVisor runtime
- Shelby API credentials and a funded Shelby signer
- Aptos registry, treasury and fee coin addresses
- GitHub OAuth/App credentials and encryption/webhook secrets

## Netlify control plane

Set these encrypted environment variables for production:

```text
VITE_DYNAMIC_ENVIRONMENT_ID=<Dynamic environment UUID>
DYNAMIC_ENVIRONMENT_ID=<same UUID>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only key>
SHELBY_API_KEY=<server-only key>
SHELBY_NETWORK=testnet
SHELBY_BASE_DOMAIN=shelbyhost.xyz
SHELBY_APP_URL=https://shelbyhost.xyz
SHELBY_CUSTOM_DOMAIN_TARGET=gateway.shelbyhost.xyz
APTOS_NETWORK=testnet
APTOS_FULLNODE_URL=https://fullnode.testnet.aptoslabs.com/v1
REGISTRY_ADDRESS=0x...
TREASURY_ADDRESS=0x...
USDT_COIN_TYPE=0x...::...::...
DEPLOY_FEE=10000
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_APP_ID=...
GITHUB_APP_PRIVATE_KEY=...
GITHUB_WEBHOOK_SECRET=...
GITHUB_TOKEN_ENCRYPTION_KEY=<32-byte secret>
```

Only `VITE_*` variables enter the browser bundle. Run every Supabase migration
before starting a worker. Existing Privy owner IDs require an explicit verified
operator migration; never map accounts by email.

## DNS

Keep the apex and `www` records used by Netlify, then add these records to the
existing Netlify DNS zone:

| Host      | Type                        | Value                     |
| --------- | --------------------------- | ------------------------- |
| `gateway` | `A` (and optionally `AAAA`) | gateway VM public address |
| `*`       | `CNAME`                     | `gateway.shelbyhost.xyz.` |

The explicit `gateway` record overrides the wildcard and prevents a CNAME loop.
No per-project record is required. Do not attach `*.shelbyhost.xyz` to the Netlify
site; that wildcard belongs to the artifact gateway.

## Gateway and TLS

Copy the repository to `/opt/shelbyhost`, then build the pinned Caddy binary:

```sh
cd /opt/shelbyhost/infra
sh build-caddy.sh
sudo install -m 0755 caddy /usr/local/bin/caddy
```

Copy `gateway.env.example` to `/etc/shelbyhost/gateway.env` and
`caddy.env.example` to `/etc/shelbyhost/caddy.env`, fill them, and set mode
`0600`. Install and enable `shelby-gateway.service` and `shelby-caddy.service`.
Caddy obtains `*.shelbyhost.xyz` using Netlify DNS-01. Its guarded on-demand
endpoint issues certificates only for custom domains ShelbyHost has verified.
Open inbound TCP 80/443 and keep port 8090 on loopback.

## Worker

Copy `worker.env.example` to `/etc/shelbyhost/worker.env`, then:

```sh
docker build -t shelby-build:1 services/build-worker/image
docker run --rm --runtime=runsc shelby-build:1 true
sudo systemctl enable --now shelby-worker
```

The worker uploads and reads back every release from Shelby. Connected-wallet
deployments stop at `awaiting_signature`; verified Aptos fee and registry receipts
then atomically promote the stored release.

## Verification

Deploy a small repository and confirm:

1. logs advance through clone, install, build, validate and upload;
2. the deployment pauses for the connected Aptos wallet;
3. rejecting a transaction leaves the old production release active;
4. approval changes the deployment to Ready;
5. `https://<slug>.shelbyhost.xyz` serves the Shelby-stored files;
6. rollback changes the active version without rebuilding;
7. a verified custom domain receives HTTPS and serves the same release.
