# 🚀 ShelbyHost - Decentralized Frontend Hosting

ShelbyHost is a deployment platform for static frontend apps with wallet-aware project ownership, content hashes, GitHub Actions deploys, wildcard subdomains, and optional Shelby Protocol storage mirroring. It runs as a Vercel-hosted control plane while serving user apps from `*.shelbyhost.xyz`.

---

## 🌟 Key Features

### 📦 Storage

Deploy assets by content hash. Supabase Storage is used as the upload staging/cache layer. When `SHELBY_STORAGE_ENABLED=true` and a funded Shelby signer/API key are configured, finalized deployments are mirrored to Shelby blobs and the project proxy prefers Shelby before falling back to Supabase.

### ⛓️ Aptos Registry & Integrity

Every deployment is anchored to the **Aptos Testnet**.

- **Immutable Proof**: Content hashes are registered onchain in a public registry contract.
- **Verifiable Deploys**: Users can verify the integrity of the frontend they are accessing by cross referencing the onchain state.

### 💳 Transparent Monetization

To sustain the decentralized infrastructure, ShelbyHost implements a mandatory deployment fee:

- **Fee**: 0.1 Shelby USDT
- **Mechanism**: The fee is processed onchain before the project registration is finalized, ensuring a trustless service model.

### 🌍 Professional Routing

- **Wildcard Subdomains**: Every project automatically receives a `<slug>.shelbyhost.xyz` URL.
- **Custom Domains**: Assign user-owned domains through Vercel domain automation or manual DNS verification.
- **Static Deploys**: Upload build folders directly or deploy static output from GitHub Actions.

---

## 🛠️ Technical Architecture

### Core Components:

1. **Frontend Control Plane**: Built with Vite, React, and TanStack Router for a high performance developer experience.
2. **Identity**: Integrated with **Privy** for secure, multi-method authentication (Google, GitHub, Email, and Wallets).
3. **Storage**: Supabase Storage for upload staging and CDN fallback, with optional Shelby Protocol blob mirroring.
4. **Registry Contract**: A Move based smart contract on Aptos that maintains the project-to-hash mapping.

---

## 🚀 Getting Started

### Prerequisites:

- An Aptos-compatible wallet (e.g., Petra, Martian).
- Some Testnet APT for gas.
- **0.1 Shelby USDT** for the deployment fee.

### Deployment Workflow:

1. **Connect**: Sign in with Privy and connect your Aptos wallet.
2. **Upload**: Drag and drop your `dist` folder or connect your GitHub repository.
3. **Verify**: Preview the build locally.
4. **Deploy**: Confirm the 0.1 USDT fee transaction.
5. **Live**: Your project is now anchored to the blockchain and live at `<slug>.shelbyhost.xyz`.

---

## Production Setup

ShelbyHost is configured for Vercel with serverless API routes, wildcard subdomain routing, Supabase Storage, optional Shelby blob mirroring, Privy auth, Aptos verification, GitHub Actions deploys, and GitHub App repo write automation.

### Required Vercel Environment Variables

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=

PRIVY_APP_ID=
VITE_PRIVY_APP_ID=
PRIVY_APP_SECRET=
PRIVY_PUBLIC_KEY=

SHELBY_BASE_DOMAIN=shelbyhost.xyz
VITE_SHELBY_BASE_DOMAIN=shelbyhost.xyz
SHELBY_APP_URL=https://shelbyhost.xyz
SHELBY_DEPLOY_TOKEN=

REGISTRY_ADDRESS=
VITE_REGISTRY_ADDRESS=
TREASURY_ADDRESS=
VITE_TREASURY_ADDRESS=
USDT_COIN_TYPE=
VITE_USDT_COIN_TYPE=
DEPLOY_FEE=10000
APTOS_NETWORK=testnet
APTOS_API_KEY=
APTOS_FULLNODE_URL=https://api.testnet.aptoslabs.com/v1

GITHUB_WEBHOOK_SECRET=
GITHUB_TOKEN_ENCRYPTION_KEY=
```

Optional GitHub App automation:

```bash
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_NAME=
GITHUB_APP_INSTALL_URL=
```

Optional custom-domain automation:

```bash
VERCEL_TOKEN=
VERCEL_PROJECT_ID=
VERCEL_TEAM_ID=
SHELBY_CUSTOM_DOMAIN_TARGET=cname.vercel-dns.com
```

Optional Shelby storage mirroring:

```bash
SHELBY_STORAGE_ENABLED=true
SHELBY_STORAGE_REQUIRED=false
SHELBY_NETWORK=testnet
SHELBY_API_KEY=
SHELBY_PRIVATE_KEY=
SHELBY_RPC_URL=https://api.testnet.shelby.xyz/shelby
SHELBY_APTOS_FULLNODE_URL=https://api.testnet.aptoslabs.com/v1
SHELBY_INDEXER_URL=https://api.testnet.aptoslabs.com/v1/graphql
SHELBY_BLOB_INDEXER_URL=https://api.testnet.aptoslabs.com/nocode/v1/public/alias/shelby/testnet/v1/graphql
SHELBY_BLOB_TTL_DAYS=365
SHELBY_ORDERLESS=false
SHELBY_MAX_DEPLOY_FILES=2000
SHELBY_MAX_DEPLOY_BYTES=104857600
SHELBY_MAX_DEPLOY_FILE_BYTES=52428800
```

For your current Testnet setup, configure these in Vercel project environment variables, not in git:

```bash
SHELBY_NETWORK=testnet
SHELBY_API_KEY=<your Testnet API key>
SHELBY_PRIVATE_KEY=<your ed25519 private key>
APTOS_NETWORK=testnet
APTOS_API_KEY=<your Testnet API key>
APTOS_FULLNODE_URL=https://api.testnet.aptoslabs.com/v1
```

`SHELBY_PRIVATE_KEY` must be a funded Aptos Ed25519 account that can pay gas and ShelbyUSD storage costs. The key is server-side only. If `SHELBY_STORAGE_REQUIRED=true`, deployments fail instead of falling back to Supabase when Shelby upload fails.

### DNS and Vercel Domains

Add both `shelbyhost.xyz` and `*.shelbyhost.xyz` to the Vercel project. In Namecheap Advanced DNS:

```text
Type   Host   Value
A      @      76.76.21.21
CNAME  *      cname.vercel-dns.com
CNAME  www    cname.vercel-dns.com
```

Remove conflicting parked/default records for `@`, `www`, or `*`. Use the exact target Vercel shows if it differs from the defaults above. After propagation, verify both the apex and wildcard in the Vercel Domains UI.

For user-owned custom domains, the app stores the mapping and can optionally register the domain with Vercel when `VERCEL_TOKEN` and `VERCEL_PROJECT_ID` are set. Users should point custom CNAME records to `SHELBY_CUSTOM_DOMAIN_TARGET` or the domain target Vercel assigns.

### Database

Apply all Supabase migrations:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

Or open the Supabase Dashboard SQL editor and run `supabase/migrations/20260528000000_product_ready_vercel.sql` manually. Back up production first because this migration changes owner IDs to Privy-compatible text IDs and moves writes behind server-side APIs.

That migration also adds payment/registry hashes, per-project GitHub deploy tokens, GitHub App installation metadata, Shelby storage metadata, and the public `shelby_nodes` bucket policies used by deployed assets.

### GitHub App Automation

Create a GitHub App with repository permissions for `Contents: Read and write`, `Actions: Read and write`, `Secrets: Read and write`, and `Workflows: Read and write` if available in the GitHub App permissions UI. Set the app setup URL to a ShelbyHost page where the user can finish connecting a project, for example `https://shelbyhost.xyz/dashboard`.

After installing the app on a repo, GitHub redirects with `installation_id`. In project settings, choose the repo, paste or keep that installation ID, and click **Auto-configure**. The API exchanges the installation ID for an installation token, writes `SHELBYHOST_DEPLOY_TOKEN` as a repo Actions secret, commits `.github/workflows/shelbyhost-deploy.yml`, and records the connection in Supabase.

### Product Scope

The current product supports static websites and frontend apps that produce an `index.html` output folder. The generated GitHub workflow handles common Node package managers and output folders (`dist`, `build`, `out`, `public`, or root static files).

GitHub builds succeed or fail in GitHub Actions. ShelbyHost writes queued deployment rows for push/dispatch events, then the generated workflow uploads the built files, mirrors them to Shelby when configured, and finalizes the deployment through the ShelbyHost API.

It is not full Vercel parity yet. It does not execute builds inside ShelbyHost infrastructure, stream build logs into the app, run SSR/serverless/edge functions, create preview deployments per pull request, manage per-project environment variables, or support Vercel's full framework preset matrix.

---

## 🔒 Security & Ownership

ShelbyHost is built on the principle of **Developer Sovereignty**. Your projects are owned by your wallet address on the blockchain. The platform cannot censor or delete your content once it is registered in the public registry.

---

## 📄 License

ShelbyHost is open-source software. Build the future of the decentralized web with us.

---

**deploy once. live forever.**  
[shelbyhost.xyz](https://shelbyhost.xyz)
