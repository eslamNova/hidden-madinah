import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { putR2Object, r2Config, type R2Config } from "./r2";

type Received = { method?: string; url?: string; headers: IncomingHttpHeaders; body: Buffer };

/** A stand-in for R2's S3 endpoint that, like R2, refuses a PUT without Content-Length. */
async function fakeR2(status = 200) {
  const received: Received[] = [];
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      received.push({ method: req.method, url: req.url, headers: req.headers, body: Buffer.concat(chunks) });
      if (!req.headers["content-length"]) {
        res.writeHead(411);
        return res.end("<Error><Code>MissingContentLength</Code></Error>");
      }
      res.writeHead(status);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const config: R2Config = {
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    bucket: "mazarat-media",
    endpoint: `http://127.0.0.1:${port}`,
    publicBase: "https://media.mazarat-madinah.com",
  };
  return { received, config, close: () => new Promise<void>((resolve) => server.close(() => resolve())) };
}

test("r2: a PUT carries Content-Length, a SigV4 signature, the type and a year of caching", async () => {
  const r2 = await fakeR2();
  try {
    const body = new Uint8Array([1, 2, 3, 4, 5]);
    await putR2Object(r2.config, "articles/2026/10/abc-10x10.webp", body, "image/webp");
    assert.equal(r2.received.length, 1);
    const [req] = r2.received;
    assert.equal(req.method, "PUT");
    assert.equal(req.url, "/mazarat-media/articles/2026/10/abc-10x10.webp");
    assert.equal(req.headers["content-length"], "5");
    assert.equal(req.headers["transfer-encoding"], undefined);
    assert.deepEqual([...req.body], [1, 2, 3, 4, 5]);
    assert.equal(req.headers["content-type"], "image/webp");
    assert.equal(req.headers["cache-control"], "public, max-age=31536000, immutable");
    assert.equal(req.headers["x-amz-content-sha256"], "UNSIGNED-PAYLOAD");
    assert.match(String(req.headers.authorization), /^AWS4-HMAC-SHA256 Credential=test-key\/\d{8}\/auto\/s3\/aws4_request, SignedHeaders=[^,]*host[^,]*, Signature=[0-9a-f]{64}$/);
  } finally {
    await r2.close();
  }
});

test("r2: a refused write throws; server errors are retried, then reported", async () => {
  const denied = await fakeR2(403);
  try {
    await assert.rejects(putR2Object(denied.config, "articles/x.webp", new Uint8Array([1]), "image/webp"), /HTTP 403/);
    assert.equal(denied.received.length, 1);
  } finally {
    await denied.close();
  }
  const failing = await fakeR2(503);
  try {
    await assert.rejects(putR2Object(failing.config, "articles/x.webp", new Uint8Array([1]), "image/webp"), /HTTP 503/);
    assert.equal(failing.received.length, 3);
  } finally {
    await failing.close();
  }
});

test("r2: settings come from the environment and are refused when incomplete or malformed", () => {
  const saved = { ...process.env };
  try {
    for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_ENDPOINT", "MEDIA_PUBLIC_BASE"]) delete process.env[k];
    assert.equal(r2Config(), null);
    Object.assign(process.env, { R2_ACCOUNT_ID: "0123456789abcdef0123456789abcdef", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s" });
    assert.deepEqual(r2Config(), {
      accessKeyId: "k",
      secretAccessKey: "s",
      bucket: "mazarat-media",
      endpoint: "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
      publicBase: "https://media.mazarat-madinah.com",
    });
    process.env.R2_ACCOUNT_ID = "not-an-account";
    assert.equal(r2Config(), null);
    process.env.R2_ACCOUNT_ID = "0123456789abcdef0123456789abcdef";
    process.env.R2_ENDPOINT = "http://insecure.example";
    assert.equal(r2Config(), null);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});
