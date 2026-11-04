// Creates a NewsGen account from the command line. Use it for the first admin, or if every admin is locked out.
//   npm run create-user -- --username admin --name "Your Name" --role admin|reporter|both [--password "..."]
// Without --password a strong one is generated and printed once.
// The first admin also takes over any stories that have no owner yet.
import { randomBytes, scrypt } from "node:crypto";
import fs from "node:fs";
import pg from "pg";

const COST = 16384;

function readEnv() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const file = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
  return file.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
}

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : undefined;
}

function hashPassword(password) {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, { N: COST, r: 8, p: 1 }, (error, key) =>
      error ? reject(error) : resolve(`scrypt$${COST}$${salt.toString("base64")}$${key.toString("base64")}`),
    ),
  );
}

const username = argument("username")?.trim().toLowerCase();
const name = argument("name")?.trim();
const role = argument("role") ?? "reporter";
const generated = !argument("password");
const password = argument("password") ?? randomBytes(12).toString("base64url");

if (!username || !/^[a-z0-9._-]{3,32}$/.test(username) || !name || !["admin", "reporter", "both"].includes(role) || password.length < 8) {
  console.error('Usage: npm run create-user -- --username <3-32 chars> --name "Full Name" [--role admin|reporter|both] [--password <8+ chars>]');
  process.exit(1);
}

const connectionString = readEnv();
if (!connectionString) {
  console.error("DATABASE_URL is not set in the environment or .env.local.");
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  const { rows } = await client.query(
    "insert into public.users (username, display_name, password_hash, role, is_reporter) values ($1, $2, $3, $4, $5) returning id",
    [username, name, await hashPassword(password), role === "reporter" ? "reporter" : "admin", role !== "admin"],
  );
  console.log(`Created ${role} @${username}.`);
  if (role !== "reporter") {
    const claimed = await client.query("update public.stories set owner_id = $1 where owner_id is null", [rows[0].id]);
    if (claimed.rowCount) console.log(`Assigned ${claimed.rowCount} existing stories to @${username}.`);
  }
  if (generated) console.log(`Password: ${password}\nWrite it down now. It is not stored anywhere readable.`);
} catch (error) {
  console.error(error.code === "23505" ? `The username @${username} is already taken.` : error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
