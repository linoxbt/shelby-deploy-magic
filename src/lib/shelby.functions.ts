import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Compute the SHA-256 of a base64 file payload and (when SHELBY creds are
 * configured) prepare a real Shelby blob registration via @shelby-protocol/sdk
 * on Aptos testnet.
 *
 * The signed on-chain `register_blob` call must still be executed from the
 * browser using the user's Petra wallet (see useShelbyUpload). This server fn
 * is the place where we generate commitments and pre-compute the merkle root
 * using the official SDK so we never trust the client for those values.
 */
export const prepareShelbyUpload = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      filename: z.string().min(1).max(512),
      // base64-encoded file contents
      contentBase64: z.string().min(1),
      sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
    }).parse,
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.SHELBY_API_KEY;
    const endpoint = process.env.SHELBY_API_ENDPOINT;

    // Always hash on the server so the registry hash is trustworthy.
    const buf = Buffer.from(data.contentBase64, "base64");
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const contentHash =
      "0x" +
      Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    let merkleRoot: string | null = null;
    let shelbyConfigured = false;

    if (apiKey && endpoint) {
      shelbyConfigured = true;
      try {
        // Dynamic import keeps the SDK out of the Worker bundle when unused.
        const { generateMerkleRoot, generateCommitments } = await import(
          "@shelby-protocol/sdk/node"
        );
        const commitments = await generateCommitments(new Uint8Array(buf));
        merkleRoot = await generateMerkleRoot(commitments);
      } catch (err) {
        console.error("Shelby SDK commitments failed:", err);
      }
    }

    return {
      contentHash,
      merkleRoot,
      sizeBytes: data.sizeBytes,
      filename: data.filename,
      shelbyConfigured,
      endpoint: endpoint ? new URL(endpoint).host : null,
    };
  });
