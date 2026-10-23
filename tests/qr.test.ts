import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { distanceMeters, qrToken, verifyQrToken } from "../lib/qr";

const OFFICE = "11111111-1111-1111-1111-111111111111";
const OTHER_OFFICE = "22222222-2222-2222-2222-222222222222";
const DATE = "2026-10-23";

const original = process.env.QR_SIGNING_SECRET;

beforeEach(() => {
  process.env.QR_SIGNING_SECRET = "test-secret-not-used-anywhere-else";
});

afterEach(() => {
  if (original === undefined) delete process.env.QR_SIGNING_SECRET;
  else process.env.QR_SIGNING_SECRET = original;
});

describe("qrToken", () => {
  it("is a 64-character hex HMAC-SHA256 and deterministic", () => {
    const token = qrToken(OFFICE, DATE);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(qrToken(OFFICE, DATE)).toBe(token);
  });

  it("changes with the office, the date and the secret", () => {
    const token = qrToken(OFFICE, DATE);
    expect(qrToken(OTHER_OFFICE, DATE)).not.toBe(token);
    expect(qrToken(OFFICE, "2026-10-24")).not.toBe(token);
    process.env.QR_SIGNING_SECRET = "a-different-secret";
    expect(qrToken(OFFICE, DATE)).not.toBe(token);
  });

  it("refuses to sign without a configured secret", () => {
    delete process.env.QR_SIGNING_SECRET;
    expect(() => qrToken(OFFICE, DATE)).toThrow("QR_SIGNING_SECRET is not configured");
  });

  it("defaults to today's date in UTC, not the office's local date", () => {
    // Callers must pass the office-local date (the API routes do). The default is UTC.
    const utcToday = new Date().toISOString().slice(0, 10);
    expect(qrToken(OFFICE)).toBe(qrToken(OFFICE, utcToday));
  });
});

describe("verifyQrToken", () => {
  it("accepts the token issued for that office and date", () => {
    expect(verifyQrToken(OFFICE, DATE, qrToken(OFFICE, DATE))).toBe(true);
  });

  it("rejects a token replayed for another office or another day", () => {
    const token = qrToken(OFFICE, DATE);
    expect(verifyQrToken(OTHER_OFFICE, DATE, token)).toBe(false);
    expect(verifyQrToken(OFFICE, "2026-10-24", token)).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const forged = qrToken(OFFICE, DATE);
    process.env.QR_SIGNING_SECRET = "rotated-secret";
    expect(verifyQrToken(OFFICE, DATE, forged)).toBe(false);
  });

  it("rejects tampered, truncated, empty and non-hex tokens without throwing", () => {
    const token = qrToken(OFFICE, DATE);
    const flipped = (token[0] === "0" ? "1" : "0") + token.slice(1);
    for (const bad of [flipped, token.slice(0, 62), token + "00", "", "zz", "not a token", "abc"]) {
      expect(verifyQrToken(OFFICE, DATE, bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("fails closed when no secret is configured", () => {
    const token = qrToken(OFFICE, DATE);
    delete process.env.QR_SIGNING_SECRET;
    expect(verifyQrToken(OFFICE, DATE, token)).toBe(false);
  });
});

describe("distanceMeters", () => {
  it("is zero for the same point and symmetric between two points", () => {
    expect(distanceMeters(17.385, 78.4867, 17.385, 78.4867)).toBe(0);
    const ab = distanceMeters(17.385, 78.4867, 17.4399, 78.4983);
    const ba = distanceMeters(17.4399, 78.4983, 17.385, 78.4867);
    expect(ab).toBeCloseTo(ba, 6);
  });

  it("measures one degree of latitude as about 111.2 km", () => {
    expect(distanceMeters(0, 0, 1, 0)).toBeCloseTo(111195, -2);
  });

  it("tells inside from outside the default 150 m geofence", () => {
    // 0.001 degrees of latitude is about 111 m; 0.002 is about 222 m.
    expect(distanceMeters(17.385, 78.4867, 17.386, 78.4867)).toBeLessThan(150);
    expect(distanceMeters(17.385, 78.4867, 17.387, 78.4867)).toBeGreaterThan(150);
  });

  it("shrinks east-west distances away from the equator", () => {
    const atEquator = distanceMeters(0, 0, 0, 1);
    const atHyderabad = distanceMeters(17.385, 0, 17.385, 1);
    expect(atHyderabad).toBeLessThan(atEquator);
    expect(atHyderabad / atEquator).toBeCloseTo(Math.cos((17.385 * Math.PI) / 180), 2);
  });
});
