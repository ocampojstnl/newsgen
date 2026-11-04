import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const COST = 16384;
export const MIN_PASSWORD_LENGTH = 8;

function derive(password: string, salt: Buffer, cost: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_LENGTH, { N: cost, r: 8, p: 1 }, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

/** Stored as "scrypt$cost$salt$hash", so the cost can be raised later without breaking old passwords. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, COST);
  return `scrypt$${COST}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, cost, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !cost || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await derive(password, Buffer.from(salt, "base64"), Number(cost));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Checked against for unknown usernames, so a wrong username takes as long as a wrong password.
let decoy: Promise<string> | null = null;
export function decoyHash(): Promise<string> {
  decoy ??= hashPassword(randomBytes(16).toString("hex"));
  return decoy;
}
