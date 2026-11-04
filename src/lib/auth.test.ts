import { beforeEach, describe, expect, it } from "vitest";
import { createSessionValue, readSession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/passwords";

const claims = { userId: "11111111-1111-1111-1111-111111111111", version: 3 };

describe("sessions", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test secret";
  });

  it("reads back a session it signed", async () => {
    expect(await readSession(await createSessionValue(claims))).toEqual(claims);
  });

  it("rejects a changed user, version or expiry", async () => {
    const [userId, version, expires, signature] = (await createSessionValue(claims)).split(".");
    expect(await readSession(`22222222-2222-2222-2222-222222222222.${version}.${expires}.${signature}`)).toBeNull();
    expect(await readSession(`${userId}.4.${expires}.${signature}`)).toBeNull();
    expect(await readSession(`${userId}.${version}.${Number(expires) + 1}.${signature}`)).toBeNull();
  });

  it("rejects junk, nothing and expired sessions", async () => {
    expect(await readSession("junk")).toBeNull();
    expect(await readSession(undefined)).toBeNull();
    expect(await readSession(await createSessionValue(claims, Date.now() - 40 * 86_400_000))).toBeNull();
  });

  it("signs everyone out when the secret changes", async () => {
    const value = await createSessionValue(claims);
    process.env.SESSION_SECRET = "another secret";
    expect(await readSession(value)).toBeNull();
  });

  it("accepts nothing when no secret is set", async () => {
    const value = await createSessionValue(claims);
    delete process.env.SESSION_SECRET;
    expect(await readSession(value)).toBeNull();
  });
});

describe("passwords", () => {
  it("verifies only the right password", async () => {
    const stored = await hashPassword("correct horse");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse", stored)).toBe(true);
    expect(await verifyPassword("correct hors", stored)).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects a malformed stored hash", async () => {
    expect(await verifyPassword("x", "plain-text")).toBe(false);
  });
});
