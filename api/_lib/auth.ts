import { PrivyClient, verifyAccessToken } from "@privy-io/node";
import { requireEnv } from "./env";

export interface AuthContext {
  userId: string;
  token: string;
}

let privyClient: PrivyClient | undefined;

function getBearerToken(req: any) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string" || !header.startsWith("Bearer ")) {
    throw new Error("Unauthorized: missing bearer token");
  }
  return header.slice("Bearer ".length);
}

function getPrivyClient() {
  if (!privyClient) {
    privyClient = new PrivyClient({
      appId: requireEnv("PRIVY_APP_ID"),
      appSecret: requireEnv("PRIVY_APP_SECRET"),
      jwtVerificationKey: requireEnv("PRIVY_PUBLIC_KEY").replace(/\\n/g, "\n"),
    });
  }
  return privyClient;
}

export async function requireAuth(req: any): Promise<AuthContext> {
  const token = getBearerToken(req);
  const verified = await verifyAccessToken({
    access_token: token,
    app_id: requireEnv("PRIVY_APP_ID"),
    verification_key: requireEnv("PRIVY_PUBLIC_KEY").replace(/\\n/g, "\n"),
  });

  return { userId: verified.user_id, token };
}

export async function getPrivyUser(userId: string) {
  return getPrivyClient().users()._get(userId);
}
