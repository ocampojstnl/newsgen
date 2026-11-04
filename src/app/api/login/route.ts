import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api";
import { createSessionValue, SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";
import { query } from "@/lib/db";
import { decoyHash, verifyPassword } from "@/lib/passwords";

const MAX_FAILURES = 5;
const LOCKOUT_MS = 5 * 60 * 1000;
const failures = new Map<string, { count: number; resetAt: number }>();

const body = z.object({ username: z.string().trim().toLowerCase().max(64), password: z.string().max(500) });

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const record = failures.get(ip);
    const active = record && record.resetAt > Date.now() ? record : null;
    if (active && active.count >= MAX_FAILURES) {
      return NextResponse.json({ error: "Too many wrong attempts. Try again in a few minutes." }, { status: 429 });
    }

    const { username, password } = body.parse(await request.json());
    const [user] = await query<{ id: string; password_hash: string; disabled: boolean; session_version: number }>(
      "select id, password_hash, disabled, session_version from public.users where username = $1",
      [username],
    );
    // An unknown username is checked against a decoy, so it takes as long as a wrong password.
    const valid = await verifyPassword(password, user?.password_hash ?? (await decoyHash()));
    if (!user || !valid || user.disabled) {
      failures.set(ip, { count: (active?.count ?? 0) + 1, resetAt: active?.resetAt ?? Date.now() + LOCKOUT_MS });
      return NextResponse.json({ error: "That username or password is not correct." }, { status: 401 });
    }

    failures.delete(ip);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, await createSessionValue({ userId: user.id, version: user.session_version }), {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
      path: "/",
      maxAge: SESSION_DAYS * 86_400,
    });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
