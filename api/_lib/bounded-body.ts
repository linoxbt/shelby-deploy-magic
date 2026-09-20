// Bound untrusted upstream data before buffering it for digest verification.
export async function boundedBody(response: Response, limit: number): Promise<Buffer> {
  if (!Number.isSafeInteger(limit) || limit < 0 || limit > 100 * 1024 * 1024)
    throw new Error("Invalid artifact size");
  const advertised = response.headers.get("content-length");
  if (advertised && Number(advertised) > limit) {
    await response.body?.cancel();
    throw new Error("Storage response exceeds artifact size");
  }
  const reader = response.body?.getReader();
  if (!reader) return Buffer.alloc(0);
  const parts: Buffer[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new Error("Storage response exceeds artifact size");
      parts.push(Buffer.from(value));
    }
    return Buffer.concat(parts, bytes);
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
