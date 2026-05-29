type JsonRequestInit = Omit<RequestInit, "body"> & {
  body?: RequestInit["body"] | Record<string, unknown> | unknown[];
};

export async function apiRequest<T>(
  path: string,
  options: JsonRequestInit = {},
  getAccessToken?: () => Promise<string | null>,
): Promise<T> {
  const headers = new Headers(options.headers);
  let body = options.body;

  if (
    body &&
    typeof body === "object" &&
    !(body instanceof FormData) &&
    !(body instanceof Blob) &&
    !(body instanceof ArrayBuffer) &&
    !(body instanceof URLSearchParams)
  ) {
    body = JSON.stringify(body);
  }

  if (!headers.has("Content-Type") && body && typeof body === "string") {
    headers.set("Content-Type", "application/json");
  }

  if (getAccessToken) {
    const token = await getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...options,
    body,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? String((payload as { error: unknown }).error)
        : String(payload || "Request failed");
    throw new Error(message);
  }

  return payload as T;
}
