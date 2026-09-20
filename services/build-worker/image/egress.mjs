import http from "node:http";
import net from "node:net";
import dns from "node:dns/promises";
const allowed = new Set([
  "registry.npmjs.org",
  "registry.yarnpkg.com",
  "github.com",
  "codeload.github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
]);
function publicAddress(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return !(
    p[0] === 0 ||
    p[0] === 10 ||
    p[0] === 127 ||
    p[0] >= 224 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && [0, 168].includes(p[1])) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
    (p[0] === 198 && [18, 19].includes(p[1]))
  );
}
const server = http.createServer((_req, res) => {
  res.writeHead(403);
  res.end("Only HTTPS CONNECT to approved registries is permitted");
});
server.on("connect", async (req, client, head) => {
  try {
    const [host, port] = String(req.url).split(":");
    if (port !== "443" || !allowed.has(host)) throw new Error("Denied");
    const addresses = await dns.lookup(host, { all: true, family: 4 });
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
      throw new Error("Denied address");
    const upstream = net.connect({ host: addresses[0].address, port: 443 });
    upstream.setTimeout(120000, () => upstream.destroy());
    client.setTimeout(120000, () => client.destroy());
    upstream.on("connect", () => {
      client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      client.pipe(upstream);
      upstream.pipe(client);
    });
    upstream.on("error", () => client.destroy());
    client.on("error", () => upstream.destroy());
    client.on("close", () => upstream.destroy());
    upstream.on("close", () => client.destroy());
  } catch (error) {
    console.error("Egress connection rejected:", error.message);
    client.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
  }
});
server.maxConnections = 64;
server.headersTimeout = 10000;
server.listen(3128, "0.0.0.0");
