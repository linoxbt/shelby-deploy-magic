export function methodNotAllowed(res: any, methods: string[]) {
  res.setHeader("Allow", methods.join(", "));
  return res.status(405).json({ error: `Method not allowed. Use ${methods.join(", ")}.` });
}

export async function readJson<T>(req: any): Promise<T> {
  if (typeof req.body === "string") return JSON.parse(req.body) as T;
  return (req.body || {}) as T;
}

export function errorResponse(res: any, error: unknown, fallback = "Request failed") {
  const message = error instanceof Error ? error.message : fallback;
  const status = message.includes("Unauthorized")
    ? 401
    : message.includes("Forbidden")
      ? 403
      : message.includes("not found")
        ? 404
        : message.includes("Missing required environment variable")
          ? 500
          : 400;

  return res.status(status).json({ error: message || fallback });
}
