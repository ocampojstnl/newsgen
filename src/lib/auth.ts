// Uses Web Crypto so the same code runs in the proxy and in route handlers.

export const SESSION_COOKIE = "newsgen_session";
export const SESSION_DAYS = 30;

const encoder = new TextEncoder();

export type SessionClaims = { userId: string; version: number };

function hmacKey(usages: KeyUsage[]) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usages);
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** "userId.version.expires.signature". The server also checks the version against the database. */
export async function createSessionValue(claims: SessionClaims, now = Date.now()): Promise<string> {
  const payload = `${claims.userId}.${claims.version}.${now + SESSION_DAYS * 86_400_000}`;
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(["sign"]), encoder.encode(payload));
  return `${payload}.${toHex(signature)}`;
}

export async function readSession(value: string | undefined, now = Date.now()): Promise<SessionClaims | null> {
  if (!value || !process.env.SESSION_SECRET) return null;
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const [userId, version, expires, signature] = parts;
  const bytes = fromHex(signature);
  if (!bytes || !(Number(expires) > now) || !/^\d+$/.test(version)) return null;
  const valid = await crypto.subtle.verify("HMAC", await hmacKey(["verify"]), bytes, encoder.encode(`${userId}.${version}.${expires}`));
  return valid ? { userId, version: Number(version) } : null;
}
