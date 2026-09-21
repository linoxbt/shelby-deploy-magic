import assert from "node:assert/strict";
import test from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { requireAptosAddress, verifyDynamicToken } from "./auth";

const environment = "11111111-1111-4111-8111-111111111111";

async function fixture(overrides: Record<string, unknown> = {}) {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = "test";
  const token = await new SignJWT({
    scope: "user:basic",
    verified_credentials: [{ chain: "APTOS", address: "0x1" }],
    ...overrides,
  })
    .setProtectedHeader({ alg: "RS256", kid: "test" })
    .setSubject("user-1")
    .setIssuer(`app.dynamicauth.com/${environment}`)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(privateKey);
  return { token, keys: createLocalJWKSet({ keys: [publicJwk] }) };
}

test("accepts a signed Dynamic access token and binds its verified Aptos wallet", async () => {
  const { token, keys } = await fixture();
  const auth = await verifyDynamicToken(token, environment, keys);
  assert.equal(auth.userId, "dynamic:user-1");
  assert.equal(requireAptosAddress(auth, "0x01"), `0x${"1".padStart(64, "0")}`);
  assert.throws(() => requireAptosAddress(auth, "0x2"), /not been verified/);
});

test("rejects incomplete authentication scopes", async () => {
  const { token, keys } = await fixture({ scope: "requiresAdditionalAuth" });
  await assert.rejects(() => verifyDynamicToken(token, environment, keys), /incomplete/);
});

test("rejects tokens issued for another Dynamic environment", async () => {
  const { token, keys } = await fixture();
  await assert.rejects(
    () => verifyDynamicToken(token, "22222222-2222-4222-8222-222222222222", keys),
    /unexpected "iss" claim value/,
  );
});
