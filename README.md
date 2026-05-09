# ShelbyHost - Decentralized Frontend Hosting

ShelbyHost is a next-generation deployment platform designed for the decentralized web. Built on top of the **Shelby Protocol** and secured by the **Aptos Blockchain**, ShelbyHost provides developers with a professional, immutable, and censorship resistant workflow for hosting static frontends.

---

## 🌟 Key Features

### 📦 Permanent Storage
Deploy your assets to decentralized hot storage. Once uploaded, your project's content is addressable by its unique **SHA-256 Content Hash**, ensuring it stays live as long as the protocol exists.

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
- **Custom Domains**: Assign your own branding with full SSL support and instant rollbacks to any previous content hash.
- **Preview Deploys**: Share preview links for every build before promoting to production.

---

## 🛠️ Technical Architecture

### Core Components:
1. **Frontend Control Plane**: Built with Vite, React, and TanStack Router for a high performance developer experience.
2. **Identity**: Integrated with **Privy** for secure, multi-method authentication (Google, GitHub, Email, and Wallets).
3. **Storage Nodes**: Powered by the Shelby Node network for high availability content delivery.
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

## 🔒 Security & Ownership
ShelbyHost is built on the principle of **Developer Sovereignty**. Your projects are owned by your wallet address on the blockchain. The platform cannot censor or delete your content once it is registered in the public registry.

---

## 📄 License
ShelbyHost is open-source software. Build the future of the decentralized web with us.

---

**deploy once. live forever.**  
[shelbyhost.xyz](https://shelbyhost.xyz)

---

## 🧰 Build commands

ShelbyHost ships two distinct production builds. Picking the wrong one is the
most common cause of "deploys fail on Vercel but work locally".

| Script             | When to use                                      | What it does                                                            |
| ------------------ | ------------------------------------------------ | ----------------------------------------------------------------------- |
| `npm run dev`      | Local development                                | Vite dev server with HMR on `:8080`.                                    |
| `npm run build:dev`| Preview / staging deploys, GitHub PR previews    | `vite build --mode development` — keeps source maps, dev env vars.      |
| `npm run build`    | Production deploys (`main` branch, custom domain)| `tsc && vite build` — type-checks then builds an optimised bundle.      |
| `npm run preview`  | Smoke-test a production build locally            | Serves `dist/` via Vite preview.                                        |
| `npm run lint`     | CI / pre-commit                                  | ESLint over the project.                                                |

### Rules of thumb

- **Production / `main` / custom domain** → always `npm run build`.
- **Preview environments** (e.g. Vercel preview deployments, internal staging)
  → `npm run build:dev`. This keeps env vars prefixed with `MODE=development`
  consistent with what the dev server sees.
- **Never** use `npm run build:dev` for the production deployment — type errors
  are skipped and the bundle is larger.

### CI guardrail

`scripts/check-required-scripts.mjs` runs in CI (`.github/workflows/ci.yml`) and
fails the pipeline if any of `dev`, `build`, `build:dev`, `preview`, or `lint`
are missing from `package.json`. This is what prevents the "Script not found
'build:dev'" class of failure from reaching production.

---

## 🧪 Why a deploy might be failing

If a Vercel build fails:

1. **Check the missing-script guard** — `node scripts/check-required-scripts.mjs`
   locally. CI runs this first and prints a clear list.
2. **Type errors** only surface in `npm run build` (production). `build:dev`
   skips `tsc`. If Vercel uses `build` and local uses `build:dev`, type errors
   only show up in CI.
3. **Environment variables** must be set in the Vercel project settings —
   `VITE_*` vars are needed at build time. Server secrets (Supabase service
   role, Shelby API key) are runtime-only and live in Lovable Cloud.
4. **Routing 404s on refresh** are handled by `vercel.json` rewrites.
