import { AwsClient } from "aws4fetch";
import { mediaPublicBase } from "@/lib/article-images";

/**
 * Cloudflare R2 through its S3-compatible API, for the admin image uploads
 * (src/app/api/admin/upload). Server only: the keys below must never reach
 * the browser, so none of them has the NEXT_PUBLIC_ prefix.
 *
 *   R2_ACCOUNT_ID         Cloudflare account id (32 hex characters)
 *   R2_ACCESS_KEY_ID      R2 API token → Access Key ID (Object Read & Write on the bucket)
 *   R2_SECRET_ACCESS_KEY  R2 API token → Secret Access Key
 *   R2_BUCKET             default "mazarat-media"
 *   MEDIA_PUBLIC_BASE     default "https://media.mazarat-madinah.com" (the bucket's public domain)
 *   R2_ENDPOINT           optional; only for buckets in a jurisdiction
 *                         (e.g. https://<account>.eu.r2.cloudflarestorage.com)
 */

export type R2Config = {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** https://<account>.r2.cloudflarestorage.com, no trailing slash. */
  endpoint: string;
  /** Where the uploaded objects are publicly served, no trailing slash. */
  publicBase: string;
};

const ACCOUNT_RE = /^[0-9a-f]{32}$/i;
const BUCKET_RE = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

/** The R2 settings, or null when any required variable is missing or malformed. */
export function r2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim() || "mazarat-media";
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  if (!ACCOUNT_RE.test(accountId) || !BUCKET_RE.test(bucket)) return null;

  const endpoint = (process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(endpoint)) return null;

  return { accessKeyId, secretAccessKey, bucket, endpoint, publicBase: mediaPublicBase() };
}

export const isR2Configured = () => r2Config() !== null;

/** Attempts per object: R2 occasionally answers 5xx or 429; the editor should not wait long. */
const ATTEMPTS = 3;

/**
 * Stores one object; uploads have a random name and never change, so they
 * are cached for a year.
 *
 * aws4fetch signs the request (SigV4, payload UNSIGNED-PAYLOAD), but the
 * request is sent here with the bytes themselves: aws4fetch's own fetch()
 * passes a Request whose body is a stream, which Node sends chunked, and R2
 * refuses a PUT without Content-Length (HTTP 411 MissingContentLength).
 */
export async function putR2Object(config: R2Config, key: string, body: Uint8Array<ArrayBuffer>, contentType: string): Promise<void> {
  const aws = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const path = key.split("/").map(encodeURIComponent).join("/");
  const url = `${config.endpoint}/${encodeURIComponent(config.bucket)}/${path}`;

  let res: Response | null = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    // Signed afresh each time: the signature carries a timestamp.
    const signed = await aws.sign(url, {
      method: "PUT",
      headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
    });
    res = await fetch(signed.url, { method: "PUT", headers: signed.headers, body });
    if (res.ok || (res.status < 500 && res.status !== 429)) break;
    if (attempt < ATTEMPTS) await new Promise((r) => setTimeout(r, 200 * attempt));
  }
  if (!res?.ok) {
    const detail = (await res?.text().catch(() => ""))?.slice(0, 300) ?? "";
    throw new Error(`R2 PUT ${key} failed: HTTP ${res?.status} ${detail}`);
  }
}
