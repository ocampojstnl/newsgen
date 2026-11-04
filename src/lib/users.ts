import { z } from "zod";
import { query } from "@/lib/db";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords";

export type AdminUserRow = {
  id: string;
  username: string;
  display_name: string;
  role: "admin" | "reporter";
  is_reporter: boolean;
  disabled: boolean;
  created_at: string;
  story_count: number;
};

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "Use 3 to 32 letters, numbers, dots, dashes or underscores.");
export const displayNameSchema = z.string().trim().min(1).max(80);
export const passwordSchema = z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`).max(200);
/** An account needs at least one role. */
export const rolesSchema = z
  .object({ admin: z.boolean(), reporter: z.boolean() })
  .refine((roles) => roles.admin || roles.reporter, "Choose at least one role.");

export function listUsersForAdmin(): Promise<AdminUserRow[]> {
  return query<AdminUserRow>(
    `select u.id, u.username, u.display_name, u.role, u.is_reporter, u.disabled, u.created_at,
       (select count(*)::int from public.stories s where s.owner_id = u.id) as story_count
     from public.users u
     order by u.disabled, u.role, u.display_name`,
  );
}

export async function activeAdminCount(): Promise<number> {
  const [row] = await query<{ n: number }>("select count(*)::int as n from public.users where role = 'admin' and not disabled");
  return row.n;
}
