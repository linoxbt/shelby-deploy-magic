import { Readable } from "node:stream";
import { boundedBody } from "./bounded-body";
export type ApiHandler = (request: any, response: any) => Promise<unknown>;
/** Adapt existing authenticated handlers to Fetch APIs without changing ownership checks. */
export async function invokeHandler(
  request: Request,
  handler: ApiHandler,
  params: Record<string, string> = {},
  raw = false,
): Promise<Response> {
  const url = new URL(request.url);
  let bytes: Buffer = Buffer.alloc(0);
  if (!["GET", "HEAD"].includes(request.method)) {
    try {
      bytes = await boundedBody(new Response(request.body), 3 * 1024 * 1024);
    } catch {
      return Response.json({ error: "Request body exceeds 3 MiB" }, { status: 413 });
    }
  }
  let body: unknown;
  if (bytes.length && !raw) {
    try {
      body = JSON.parse(bytes.toString());
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }
  const req = Object.assign(Readable.from(bytes.length ? [bytes] : []), {
    method: request.method,
    url: url.pathname + url.search,
    headers: { ...Object.fromEntries(request.headers), host: url.host },
    query: { ...Object.fromEntries(url.searchParams), ...params },
    body,
  });
  const headers = new Headers({ "Cache-Control": "no-store" });
  let status = 200,
    result: BodyInit | null = null,
    sent = false;
  const res = {
    setHeader(name: string, value: string | string[]) {
      if (Array.isArray(value)) {
        headers.delete(name);
        for (const item of value) headers.append(name, item);
      } else headers.set(name, value);
      return res;
    },
    status(code: number) {
      status = code;
      return res;
    },
    json(value: unknown) {
      headers.set("Content-Type", "application/json");
      result = JSON.stringify(value);
      sent = true;
      return res;
    },
    send(value: any) {
      result = value;
      sent = true;
      return res;
    },
    end(value?: any) {
      result = value ?? null;
      sent = true;
      return res;
    },
    redirect(code: number | string, location?: string) {
      status = typeof code === "number" ? code : 302;
      headers.set("Location", location || String(code));
      sent = true;
      return res;
    },
  };
  try {
    await handler(req, res);
  } catch (error) {
    console.error("API handler failed:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Internal API error" }, { status: 500 });
  }
  if (!sent)
    return Response.json({ error: "API handler did not return a response" }, { status: 500 });
  return new Response(request.method === "HEAD" ? null : result, { status, headers });
}
