import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, requireAdmin, uuid } from "@/lib/api";
import { query } from "@/lib/db";
import { hashPassword } from "@/lib/passwords";
import { activeAdminCount, displayNameSchema, listUsersForAdmin, passwordSchema, rolesSchema } from "@/lib/users";

const body = z.object({
  displayName: displayNameSchema.optional(),
  roles: rolesSchema.optional(),
  disabled: z.boolean().optional(),
  password: passwordSchema.optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const id = uuid.parse((await params).id);
    const parsed = body.safeParse(await request.json());
    if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "Check the details and try again.");
    const input = parsed.data;

    const [target] = await query<{ role: string; disabled: boolean }>("select role, disabled from public.users where id = $1", [id]);
    if (!target) throw new ApiError(404, "User not found.");

    // The workspace must always keep an admin who can sign in.
    const losesAdmin = target.role === "admin" && !target.disabled && (input.roles?.admin === false || input.disabled === true);
    if (losesAdmin && (await activeAdminCount()) <= 1) throw new ApiError(400, "Keep at least one active admin.");
    if (id === admin.id && input.disabled) throw new ApiError(400, "You cannot disable your own account.");

    const sets: string[] = [];
    const values: unknown[] = [id];
    const set = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (input.displayName !== undefined) set("display_name", input.displayName);
    if (input.roles !== undefined) {
      set("role", input.roles.admin ? "admin" : "reporter");
      set("is_reporter", input.roles.reporter);
    }
    if (input.disabled !== undefined) set("disabled", input.disabled);
    if (input.password !== undefined) set("password_hash", await hashPassword(input.password));
    // A new password or a disabled account ends that user's existing sessions.
    if (input.password !== undefined || input.disabled === true) sets.push("session_version = session_version + 1");
    if (sets.length > 0) await query(`update public.users set ${sets.join(", ")} where id = $1`, values);

    return NextResponse.json({ users: await listUsersForAdmin() });
  } catch (error) {
    return errorResponse(error);
  }
}
