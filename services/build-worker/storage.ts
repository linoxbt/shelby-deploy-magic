import { boundedBody } from "../../api/_lib/bounded-body";
import { shelbyBlobUrl, shelbyClient, shelbySigner, ttlMicros } from "../../api/_lib/shelby";
export { artifactManifest } from "./manifest";
import { digest, artifactManifest, type Artifact } from "./manifest";
export async function uploadRelease(
  projectId: string,
  deploymentId: string,
  files: Artifact[],
  metadata: Record<string, unknown>,
  log: (s: string) => void,
  signal: AbortSignal,
) {
  const client = shelbyClient(),
    signer = shelbySigner(),
    expirationMicros = ttlMicros();
  const owner = signer.accountAddress.toString();
  const { hash, manifest } = artifactManifest(files);
  const prefix = `releases/${projectId}/${deploymentId}/${hash}`;
  const entries = manifest.map((f) => ({
    ...f,
    blobName: `${prefix}${f.path}`,
    url: shelbyBlobUrl(owner, `${prefix}${f.path}`),
  }));
  async function put(blobName: string, data: Buffer) {
    signal.throwIfAborted();
    let abort: () => void = () => {};
    try {
      await Promise.race([
        client.upload({ signer, blobName, blobData: new Uint8Array(data), expirationMicros }),
        new Promise<never>((_, reject) => {
          abort = () =>
            reject(new Error("Storage upload exceeded its deadline or worker lease was lost"));
          signal.addEventListener("abort", abort, { once: true });
          if (signal.aborted) abort();
        }),
      ]);
    } finally {
      signal.removeEventListener("abort", abort);
    }
    // Read the actual bytes back before permitting promotion. HTTP 200 alone
    // is insufficient: corrupt/partial content must never become production.
    let error: Error = new Error("Shelby blob not readable");
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const response = await fetch(shelbyBlobUrl(owner, blobName), {
          headers: { Authorization: `Bearer ${process.env.SHELBY_API_KEY}` },
          signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
        });
        if (!response.ok) throw new Error(`Shelby read-back HTTP ${response.status}`);
        const body = await boundedBody(response, data.length);
        if (digest(body) !== digest(data)) throw new Error("Shelby read-back digest mismatch");
        return;
      } catch (e) {
        error = e as Error;
        signal.throwIfAborted();
        if (attempt < 4) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    throw error;
  }
  for (const entry of entries) {
    const file = files.find((f) => f.path === entry.path)!;
    await put(entry.blobName, Buffer.from(file.content, "base64"));
    log(`Stored and verified ${entry.path} (${entry.size} bytes)`);
  }
  const manifestName = `${prefix}/.shelby-manifest.json`;
  await put(
    manifestName,
    Buffer.from(
      JSON.stringify({
        schemaVersion: 1,
        projectId,
        deploymentId,
        hash,
        expirationMicros,
        metadata,
        files: entries,
      }),
    ),
  );
  return {
    hash,
    owner,
    manifest: entries,
    manifestUrl: shelbyBlobUrl(owner, manifestName),
    size: entries.reduce((n, f) => n + f.size, 0),
    files: entries.map((f) => ({
      path: f.path,
      name: f.path.split("/").pop(),
      size: f.size,
      type: f.type,
    })),
  };
}
