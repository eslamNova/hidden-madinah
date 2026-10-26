/**
 * Reads an image's real type and pixel size from its first bytes — JPEG,
 * PNG, WebP (lossy, lossless, extended) and GIF — without decoding it.
 *
 * The upload route trusts these bytes, never the browser's declared MIME
 * type or file name: a file that does not parse as one of the four formats
 * is refused, and the stored object's Content-Type and the dimensions in its
 * key come from here.
 */

export type SniffedImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
export type SniffedImage = { type: SniffedImageType; width: number; height: number };

/** Larger than any photo the editor produces (1600 px wide); guards against nonsense headers. */
const MAX_SIDE = 20_000;

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
const u16be = (b: Uint8Array, at: number) => (b[at] << 8) | b[at + 1];
const u16le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u24le = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8) | (b[at + 2] << 16);
const u32be = (b: Uint8Array, at: number) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;

function sized(type: SniffedImageType, width: number, height: number): SniffedImage | null {
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width < 1 || height < 1 || width > MAX_SIDE || height > MAX_SIDE) return null;
  return { type, width, height };
}

function png(b: Uint8Array): SniffedImage | null {
  // Signature, then the IHDR chunk: length (4), "IHDR", width (4), height (4).
  if (b.length < 24 || ascii(b, 12, 4) !== "IHDR") return null;
  return sized("image/png", u32be(b, 16), u32be(b, 20));
}

function webp(b: Uint8Array): SniffedImage | null {
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 ") {
    // Lossy: frame tag (3), start code 9d 01 2a, then 14-bit width and height.
    if (b.length < 30 || b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return sized("image/webp", u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
  }
  if (chunk === "VP8L") {
    // Lossless: signature 0x2f, then width-1 and height-1 in 14 bits each.
    if (b.length < 25 || b[20] !== 0x2f) return null;
    const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
    return sized("image/webp", (bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
  }
  if (chunk === "VP8X") {
    // Extended (alpha, animation): flags (4), then canvas width-1 and height-1 in 24 bits each.
    if (b.length < 30) return null;
    return sized("image/webp", u24le(b, 24) + 1, u24le(b, 27) + 1);
  }
  return null;
}

function jpeg(b: Uint8Array): SniffedImage | null {
  // Walk the marker segments up to the first start-of-frame (SOF0–SOF15,
  // except DHT c4, JPG c8 and DAC cc), which holds height then width.
  let i = 2;
  while (i + 9 <= b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2; // standalone markers carry no length
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // end of image / start of scan before any frame header
    const length = u16be(b, i + 2);
    if (length < 2) return null;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return sized("image/jpeg", u16be(b, i + 7), u16be(b, i + 5));
    }
    i += 2 + length;
  }
  return null;
}

/** The image's type and size from its header, or null when it is not a JPEG, PNG, WebP or GIF. */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  const b = bytes;
  if (b.length < 12) return null;
  if (b[0] === 0x89 && ascii(b, 1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return png(b);
  const gif = ascii(b, 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") return sized("image/gif", u16le(b, 6), u16le(b, 8));
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return webp(b);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return jpeg(b);
  return null;
}
