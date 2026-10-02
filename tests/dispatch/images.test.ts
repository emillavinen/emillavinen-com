// @vitest-environment node
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { BSKY_MAX_BYTES, processImage, SOCIAL_MAX_BYTES, titleFromFileName, UnsupportedImageError } from "@/lib/dispatch/images";

describe("image variants", () => {
  it("makes thumb, display, social and bsky at the right sizes and formats", async () => {
    const input = await sharp({ create: { width: 3000, height: 4000, channels: 3, background: "#224488" } }).jpeg().toBuffer();
    const v = await processImage(input);
    expect(v.thumb).toMatchObject({ width: 800, height: 1067, contentType: "image/webp" });
    expect(v.display).toMatchObject({ width: 1800, height: 2400, contentType: "image/webp" });
    expect(v.social).toMatchObject({ width: 1536, height: 2048, contentType: "image/jpeg" });
    expect(v.social.buffer.length).toBeLessThanOrEqual(SOCIAL_MAX_BYTES);
    expect(v.bsky.buffer.length).toBeLessThanOrEqual(BSKY_MAX_BYTES);
    expect((await sharp(v.thumb.buffer).metadata()).format).toBe("webp");
    expect((await sharp(v.social.buffer).metadata()).format).toBe("jpeg");
  });

  it("never enlarges a small image", async () => {
    const input = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#fff" } }).png().toBuffer();
    const v = await processImage(input);
    expect([v.thumb.width, v.display.width, v.social.width]).toEqual([600, 600, 600]);
  });

  it("strips all metadata, GPS included", async () => {
    const input = await sharp({ create: { width: 1200, height: 900, channels: 3, background: "#888" } })
      .jpeg()
      .withExif({ IFD0: { Copyright: "Emil", Artist: "Emil" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "60/1 10/1 0/1" } })
      .toBuffer();
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const v = await processImage(input);
    for (const variant of Object.values(v)) {
      const meta = await sharp(variant.buffer).metadata();
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.icc).toBeUndefined();
    }
  });

  it("converts CMYK to sRGB", async () => {
    const cmyk = await sharp({ create: { width: 1000, height: 800, channels: 3, background: "#cc3322" } }).toColourspace("cmyk").jpeg().toBuffer();
    expect((await sharp(cmyk).metadata()).space).toBe("cmyk");
    const v = await processImage(cmyk);
    for (const variant of Object.values(v)) expect((await sharp(variant.buffer).metadata()).space).toBe("srgb");
  });

  it("applies EXIF orientation before stripping it", async () => {
    // 1000×600 stored, orientation 6 = displayed rotated 90° → portrait.
    const rotated = await sharp({ create: { width: 1000, height: 600, channels: 3, background: "#123" } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const v = await processImage(rotated);
    expect(v.display.height).toBeGreaterThan(v.display.width);
  });

  it("flattens transparency onto white", async () => {
    const png = await sharp({ create: { width: 900, height: 900, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const v = await processImage(png);
    const { data } = await sharp(v.social.buffer).raw().toBuffer({ resolveWithObject: true });
    expect(data[0]).toBeGreaterThan(245);
  });

  it("squeezes bsky under 950 KB even for noisy, large images", async () => {
    const noise = Buffer.alloc(2600 * 2600 * 3);
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) >>> 24;
    const input = await sharp(noise, { raw: { width: 2600, height: 2600, channels: 3 } }).png().toBuffer();
    const v = await processImage(input);
    expect(v.bsky.buffer.length).toBeLessThanOrEqual(BSKY_MAX_BYTES);
    expect(v.social.buffer.length).toBeLessThanOrEqual(SOCIAL_MAX_BYTES);
  }, 60_000);

  it("rejects things that are not images", async () => {
    await expect(processImage(Buffer.from("not an image"))).rejects.toBeInstanceOf(UnsupportedImageError);
    // An MP4-ish header.
    await expect(processImage(Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex"))).rejects.toBeInstanceOf(UnsupportedImageError);
  });

  it("titles from file names", () => {
    expect(titleFromFileName("IMG_2041-final_v2.jpg")).toBe("IMG 2041 final v2");
    expect(titleFromFileName(".jpg")).toBe("Untitled");
    expect(titleFromFileName("Soznanie Fest poster.PNG")).toBe("Soznanie Fest poster");
  });
});
