import { NextResponse, type NextRequest } from "next/server";
import { readSession, SESSION_COOKIE } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/login", "/s/", "/setup"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!process.env.SESSION_SECRET || !process.env.DATABASE_URL) {
    return pathname === "/setup" ? NextResponse.next() : NextResponse.rewrite(new URL("/setup", request.url));
  }
  if (PUBLIC_PATHS.some((path) => pathname.startsWith(path))) return NextResponse.next();
  // A quick signature check. Pages and routes also check the account in the database.
  if (await readSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
