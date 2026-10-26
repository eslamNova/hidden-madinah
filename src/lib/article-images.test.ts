import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { sniffImage } from "./image-sniff";
import { articleImageKey, articleImageSize, isAllowedArticleImage, uploadedShareImage } from "./article-images";
import { articleCover, articleShareImage } from "./article-format";

const solid = (width: number, height: number, alpha = false) =>
  sharp({ create: { width, height, channels: alpha ? 4 : 3, background: alpha ? { r: 31, g: 92, b: 61, alpha: 0.5 } : "#1f5c3d" } });

test("image sniffing: real files of every accepted format give their type and size", async () => {
  const cases: [Buffer, string][] = [
    [await solid(37, 23).jpeg().toBuffer(), "image/jpeg"],
    [await solid(37, 23).jpeg({ progressive: true }).toBuffer(), "image/jpeg"],
    [await solid(37, 23).png().toBuffer(), "image/png"],
    [await solid(37, 23).gif().toBuffer(), "image/gif"],
    [await solid(37, 23).webp({ quality: 82 }).toBuffer(), "image/webp"], // VP8 (lossy)
    [await solid(37, 23).webp({ lossless: true }).toBuffer(), "image/webp"], // VP8L
    [await solid(37, 23, true).webp({ quality: 82 }).toBuffer(), "image/webp"], // VP8X (alpha)
  ];
  for (const [buf, type] of cases) {
    assert.deepEqual(sniffImage(new Uint8Array(buf)), { type, width: 37, height: 23 }, type);
  }
  // EXIF before the frame header is skipped.
  const withExif = await solid(1600, 900).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  assert.deepEqual(sniffImage(new Uint8Array(withExif)), { type: "image/jpeg", width: 1600, height: 900 });
});

test("image sniffing: anything else is refused", () => {
  const text = (s: string) => new TextEncoder().encode(s);
  assert.equal(sniffImage(text("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), null);
  assert.equal(sniffImage(text("<html><script>alert(1)</script></html>")), null);
  assert.equal(sniffImage(text("GIF89a")), null); // too short
  assert.equal(sniffImage(text("RIFF\0\0\0\0WEBPVP8 \0\0\0\0\0\0\0\0\0\0\0\0\0\0")), null); // no start code
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xd9, 0, 0, 0, 0, 0, 0, 0, 0])), null); // JPEG without a frame
  assert.equal(sniffImage(new Uint8Array(0)), null);
});

test("article images: keys carry the size; sizes and share images are read back from them", () => {
  const key = articleImageKey(new Date("2026-03-09T23:30:00Z"), "3f9c0a1b2c3d4e5f", 1600, 900, "webp");
  assert.equal(key, "articles/2026/03/3f9c0a1b2c3d4e5f-1600x900.webp");

  const url = `https://media.mazarat-madinah.com/${key}`;
  assert.deepEqual(articleImageSize(url), { width: 1600, height: 900 });
  assert.equal(articleImageSize("https://media.mazarat-madinah.com/places/x/abc-1600.webp"), null);
  assert.equal(articleImageSize("not a url"), null);

  assert.deepEqual(uploadedShareImage(url), { url: url.replace(/\.webp$/, ".jpg"), width: 1600, height: 900 });
  assert.deepEqual(uploadedShareImage(url.replace(/\.webp$/, ".png")), { url: url.replace(/\.webp$/, ".png"), width: 1600, height: 900 });
  // Same name on another host: no JPEG twin can be assumed there.
  assert.equal(uploadedShareImage(`https://evil.example/${key}`), null);

  // Covers: an upload gives its real ratio and its JPEG twin with exact size.
  assert.deepEqual(articleCover(url), { url, width: 1600, height: 900, singleVariant: true });
  assert.deepEqual(articleShareImage(url), { url: url.replace(/\.webp$/, ".jpg"), width: 1600, height: 900 });
  // A place-media variant: its 1600px JPEG, size unknown.
  assert.deepEqual(articleShareImage("https://media.mazarat-madinah.com/places/p1/abc-800.webp"), {
    url: "https://media.mazarat-madinah.com/places/p1/abc-1600.jpg",
  });
  // Any other https image as it is; http or empty: none.
  assert.deepEqual(articleShareImage("https://example.com/a.png"), { url: "https://example.com/a.png" });
  assert.equal(articleShareImage("http://example.com/a.png"), null);
  assert.equal(articleShareImage(""), null);
});

test("article images: allowed origins", () => {
  const origins = ["https://media.mazarat-madinah.com", "https://www.mazarat-madinah.com"];
  assert.equal(isAllowedArticleImage("https://media.mazarat-madinah.com/articles/a.webp", origins), true);
  assert.equal(isAllowedArticleImage("/icons/icon-512.png", origins), true);
  assert.equal(isAllowedArticleImage("//media.mazarat-madinah.com/a.webp", origins), false);
  assert.equal(isAllowedArticleImage("http://media.mazarat-madinah.com/a.webp", origins), false);
  assert.equal(isAllowedArticleImage("https://evil.example/a.webp", origins), false);
  assert.equal(isAllowedArticleImage("https://media.mazarat-madinah.com:8443/a.webp", origins), false);
  assert.equal(isAllowedArticleImage("data:image/png;base64,AAAA", origins), false);
  assert.equal(isAllowedArticleImage("/\\evil.example/a.png", origins), false);
});
