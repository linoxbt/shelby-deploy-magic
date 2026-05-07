# 🚀 ShelbyHost — Decentralized Frontend Hosting

ShelbyHost is a next-generation deployment platform designed for the decentralized web. Built on top of the **Shelby Protocol** and secured by the **Aptos Blockchain**, ShelbyHost provides developers with a professional, immutable, and censorship-resistant workflow for hosting static frontends.

---

## 🌟 Key Features

### 📦 Permanent Storage
Deploy your assets to decentralized hot storage. Once uploaded, your project's content is addressable by its unique **SHA-256 Content Hash**, ensuring it stays live as long as the protocol exists.

### ⛓️ Aptos Registry & Integrity
Every deployment is anchored to the **Aptos Testnet**. 
- **Immutable Proof**: Content hashes are registered on-chain in a public registry contract.
- **Verifiable Deploys**: Users can verify the integrity of the frontend they are accessing by cross-referencing the on-chain state.

### 💳 Transparent Monetization
To sustain the decentralized infrastructure, ShelbyHost implements a mandatory deployment fee:
- **Fee**: 0.1 Shelby USDT
- **Mechanism**: The fee is processed on-chain before the project registration is finalized, ensuring a trustless service model.

### 🌍 Professional Routing
- **Wildcard Subdomains**: Every project automatically receives a `<slug>.shelbyhost.xyz` URL.
- **Custom Domains**: Assign your own branding with full SSL support and instant rollbacks to any previous content hash.
- **Preview Deploys**: Share preview links for every build before promoting to production.

---

## 🛠️ Technical Architecture

### Core Components:
1. **Frontend Control Plane**: Built with Vite, React, and TanStack Router for a high-performance developer experience.
2. **Identity**: Integrated with **Privy** for secure, multi-method authentication (Google, GitHub, Email, and Wallets).
3. **Storage Nodes**: Powered by the Shelby Node network for high-availability content delivery.
4. **Registry Contract**: A Move-based smart contract on Aptos that maintains the project-to-hash mapping.

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
