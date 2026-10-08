// Magic-number detection: trust the bytes, not the file name or Content-Type.
import { describe, expect, it } from "vitest";
import { detectImageType } from "./image-type";

const bytes = (...values: Array<number | string>) =>
  new Uint8Array(values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v])));

describe("detectImageType", () => {
  it("recognises JPEG, PNG and WebP", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectImageType(bytes(0x89, "PNG", 0x0d, 0x0a))).toBe("image/png");
    expect(detectImageType(bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toBe("image/webp");
  });

  it("rejects anything else, e.g. a Windows executable", () => {
    expect(detectImageType(bytes("MZ", 0x90, 0x00))).toBeNull();
  });
});
