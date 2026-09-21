import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { requireEnv } from "./env";
export interface AuthContext {
  userId: string;
  token: string;
  aptosAddresses: string[];
}
let keys: ReturnType<typeof createRemoteJWKSet> | undefined;
let keyEnvironment = "";
export function sessionFromClaims(payload: JWTPayload, token: string): AuthContext {
  if (
    !payload.sub ||
    typeof payload.scope !== "string" ||
    !payload.scope.split(" ").includes("user:basic")
  )
    throw new Error("Unauthorized: wallet authentication is incomplete");
  const credentials = Array.isArray(payload.verified_credentials)
    ? payload.verified_credentials
    : [];
  const aptosAddresses = credentials
    .filter(
      (c: any) =>
        String(c.chain).toUpperCase() === "APTOS" &&
        typeof c.address === "string" &&
        /^0x[a-fA-F0-9]{1,64}$/.test(c.address),
    )
    .map((c: any) => normalizeAptosAddress(c.address));
  return { userId: `dynamic:${payload.sub}`, token, aptosAddresses };
}
export function normalizeAptosAddress(value: string) {
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(value)) throw new Error("Invalid Aptos address");
  return "0x" + value.slice(2).toLowerCase().padStart(64, "0");
}
export function requireAptosAddress(auth: AuthContext, address: string) {
  const normalized = normalizeAptosAddress(address);
  if (!auth.aptosAddresses.includes(normalized))
    throw new Error("Forbidden: this Aptos wallet has not been verified by Dynamic");
  return normalized;
}
export async function verifyDynamicToken(
  token: string,
  environment: string,
  keySet: JWTVerifyGetKey,
) {
  const { payload } = await jwtVerify(token, keySet, {
    algorithms: ["RS256"],
    issuer: process.env.DYNAMIC_JWT_ISSUER || `app.dynamicauth.com/${environment}`,
    ...(process.env.DYNAMIC_JWT_AUDIENCE ? { audience: process.env.DYNAMIC_JWT_AUDIENCE } : {}),
  });
  return sessionFromClaims(payload, token);
}
export async function requireAuth(req: any): Promise<AuthContext> {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer "))
    throw new Error("Unauthorized: missing bearer token");
  const token = header.slice(7),
    environment = requireEnv("DYNAMIC_ENVIRONMENT_ID");
  if (!/^[a-f0-9-]{36}$/i.test(environment))
    throw new Error("Invalid Dynamic environment configuration");
  if (!keys || keyEnvironment !== environment) {
    keys = createRemoteJWKSet(
      new URL(`https://app.dynamicauth.com/api/v0/sdk/${environment}/.well-known/jwks`),
    );
    keyEnvironment = environment;
  }
  try {
    return await verifyDynamicToken(token, environment, keys);
  } catch {
    throw new Error("Unauthorized: invalid or expired Dynamic session");
  }
}
