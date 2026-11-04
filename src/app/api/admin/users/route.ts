import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, requireAdmin } from "@/lib/api";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";
import { displayNameSchema, listUsersForAdmin, passwordSchema, rolesSchema, usernameSchema } from "@/lib/users";

const body = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema,
  roles: rolesSchema,
});

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json({ users: await listUsersForAdmin() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const parsed = body.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Check the details and try again.");
    const input = parsed.data;
    const [taken] = await query("select 1 from public.users where username = $1", [input.username]);
    if (taken) throw new ApiError(409, "That username is already taken.");
    await query("insert into public.users (username, display_name, password_hash, role, is_reporter) values ($1, $2, $3, $4, $5)", [
      input.username,
      input.displayName,
      await hashPassword(input.password),
      input.roles.admin ? "admin" : "reporter",
      input.roles.reporter,
    ]);
    return NextResponse.json({ users: await listUsersForAdmin() });
  } catch (error) {
    return errorResponse(error);
  }
}
