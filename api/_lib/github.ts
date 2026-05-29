import crypto from "node:crypto";
import sodium from "libsodium-wrappers";

import { GITHUB_DEPLOY_SECRET_NAME, GITHUB_WORKFLOW_FILE } from "./workflow";

const githubHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "User-Agent": "ShelbyHost/1.0",
  "X-GitHub-Api-Version": "2022-11-28",
});

function base64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

async function githubJson<T>(
  path: string,
  {
    token,
    method = "GET",
    body,
    okStatuses = [200],
  }: {
    token: string;
    method?: string;
    body?: unknown;
    okStatuses?: number[];
  },
): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      ...githubHeaders(token),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!okStatuses.includes(response.status)) {
    const text = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${text.slice(0, 300)}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fetchGithubRepos(token: string) {
  const response = await fetch(
    "https://api.github.com/user/repos?per_page=100&sort=pushed&type=owner",
    {
      headers: githubHeaders(token),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json();
}

export async function getGithubUser(token: string) {
  const response = await fetch("https://api.github.com/user", {
    headers: githubHeaders(token),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub user lookup failed ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json();
}

export async function triggerWorkflow({
  token,
  owner,
  repo,
  branch,
  workflowFile,
}: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  workflowFile: string;
}) {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(
      workflowFile,
    )}/dispatches`,
    {
      method: "POST",
      headers: {
        ...githubHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: branch }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub workflow dispatch failed ${response.status}: ${text.slice(0, 200)}`);
  }
}

export function githubAppConfigured() {
  return Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

export function githubAppInstallUrl() {
  if (process.env.GITHUB_APP_INSTALL_URL) return process.env.GITHUB_APP_INSTALL_URL;
  const appName = process.env.GITHUB_APP_NAME;
  return appName ? `https://github.com/apps/${appName}/installations/new` : null;
}

export function createGithubAppJwt() {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyValue = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !privateKeyValue) {
    throw new Error("GitHub App automation is not configured");
  }

  const privateKey = privateKeyValue.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: appId,
    }),
  );
  const input = `${header}.${payload}`;
  const signature = crypto.createSign("RSA-SHA256").update(input).sign(privateKey);
  return `${input}.${base64url(signature)}`;
}

export async function createInstallationToken(installationId: number | string) {
  const jwt = createGithubAppJwt();
  const data = await githubJson<{ token: string; expires_at: string }>(
    `/app/installations/${installationId}/access_tokens`,
    {
      token: jwt,
      method: "POST",
      okStatuses: [201],
    },
  );
  return data.token;
}

export async function fetchInstallationRepositories(installationId: number | string) {
  const token = await createInstallationToken(installationId);
  const data = await githubJson<{ repositories: unknown[] }>("/installation/repositories", {
    token,
  });
  return data.repositories;
}

export async function upsertRepoSecret({
  token,
  owner,
  repo,
  secretName = GITHUB_DEPLOY_SECRET_NAME,
  secretValue,
}: {
  token: string;
  owner: string;
  repo: string;
  secretName?: string;
  secretValue: string;
}) {
  const publicKey = await githubJson<{ key_id: string; key: string }>(
    `/repos/${owner}/${repo}/actions/secrets/public-key`,
    { token },
  );

  await sodium.ready;
  const encryptedBytes = sodium.crypto_box_seal(
    sodium.from_string(secretValue),
    sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL),
  );

  await githubJson<void>(`/repos/${owner}/${repo}/actions/secrets/${secretName}`, {
    token,
    method: "PUT",
    okStatuses: [201, 204],
    body: {
      encrypted_value: sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL),
      key_id: publicKey.key_id,
    },
  });
}

export async function upsertWorkflowFile({
  token,
  owner,
  repo,
  branch,
  workflowYaml,
  workflowFile = GITHUB_WORKFLOW_FILE,
}: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  workflowYaml: string;
  workflowFile?: string;
}) {
  const encodedPath = workflowFile
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
  let sha: string | undefined;

  try {
    const existing = await githubJson<{ sha: string }>(
      `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`,
      { token },
    );
    sha = existing.sha;
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("GitHub API error 404")) {
      throw error;
    }
  }

  await githubJson<void>(`/repos/${owner}/${repo}/contents/${encodedPath}`, {
    token,
    method: "PUT",
    okStatuses: [200, 201],
    body: {
      message: "Configure ShelbyHost deployment",
      branch,
      content: Buffer.from(workflowYaml, "utf8").toString("base64"),
      ...(sha ? { sha } : {}),
    },
  });
}

export function encryptToken(token: string) {
  const key = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!key) return token;

  const secret = crypto.createHash("sha256").update(key).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secret, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptToken(value: string) {
  if (!value.startsWith("v1:")) return value;

  const key = process.env.GITHUB_TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error("Missing GITHUB_TOKEN_ENCRYPTION_KEY for encrypted GitHub token");

  const [, ivValue, tagValue, encryptedValue] = value.split(":");
  const secret = crypto.createHash("sha256").update(key).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm", secret, Buffer.from(ivValue, "base64"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
