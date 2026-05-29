export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const appBaseDomain = () => process.env.SHELBY_BASE_DOMAIN || "shelbyhost.xyz";

export const appHostnames = () =>
  new Set(
    [
      appBaseDomain(),
      `www.${appBaseDomain()}`,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
      ...(process.env.SHELBY_APP_HOSTS || "").split(","),
    ]
      .map((host) => host?.trim().toLowerCase())
      .filter(Boolean) as string[],
  );
