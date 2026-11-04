import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { z } from "zod";
import { readSession, SESSION_COOKIE } from "@/lib/auth";
import { query } from "@/lib/db";
import { cleanText } from "@/lib/text";
import type { SessionUser, Source, Story, Version } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The signed-in user, or null. Disabled users and outdated sessions (after a password change) count as signed out. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const claims = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const [user] = await query<SessionUser & { session_version: number; disabled: boolean }>(
    "select id, username, display_name, role, is_reporter, session_version, disabled from public.users where id = $1",
    [claims.userId],
  );
  if (!user || user.disabled || user.session_version !== claims.version) return null;
  return { id: user.id, username: user.username, display_name: user.display_name, role: user.role, is_reporter: user.is_reporter };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Please sign in.");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new ApiError(403, "Only an admin can do that.");
  return user;
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  console.error(error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

/**
 * "view": read the story. "edit": change its content (owner and editors).
 * "own": delete it or decide who it is shared with (owner only).
 */
export type Access = "view" | "edit" | "own";
export type AccessLevel = Story["access"];

const RANK: Record<AccessLevel, number> = { view: 1, edit: 2, own: 3 };

/**
 * Loads a story with the user's access level. Admins can read any story, so they can review
 * publication requests. Anything not allowed answers "not found", so other stories cannot be discovered.
 */
export async function loadStory(id: string, user: SessionUser, need: Access): Promise<Story> {
  const [story] = await query<Story>(
    `select s.*, u.display_name as owner_name,
       case
         when s.owner_id = $2 then 'own'
         when sh.role = 'editor' then 'edit'
         else 'view'
       end as access,
       (s.owner_id = $2) as is_owner,
       (sh.user_id is not null) as shared_with_me,
       coalesce((
         select jsonb_agg(jsonb_build_object('kind', r.kind, 'version_id', r.version_id))
         from public.access_requests r
         where r.story_id = s.id and r.requester_id = $2 and r.status = 'pending'
       ), '[]'::jsonb) as my_pending_requests
     from public.stories s
     join public.users u on u.id = s.owner_id
     left join public.story_shares sh on sh.story_id = s.id and sh.user_id = $2
     where s.id = $1 and (s.owner_id = $2 or sh.user_id is not null or $3)`,
    [id, user.id, user.role === "admin"],
  );
  if (!story || RANK[story.access] < RANK[need]) throw new ApiError(404, "Story not found.");
  return story;
}

/** Older captures kept HTML codes in their titles. The stored source stays as captured; only the display is cleaned. */
export async function loadSources(storyId: string): Promise<Source[]> {
  const sources = await query<Source>("select * from public.sources where story_id = $1 order by label", [storyId]);
  return sources.map((source) => ({ ...source, title: cleanText(source.title) }));
}

export function loadVersions(storyId: string): Promise<Version[]> {
  return query<Version>("select * from public.versions where story_id = $1 order by created_at", [storyId]);
}

/** Loads a version after checking access to its story. */
export async function loadVersion(id: string, user: SessionUser, access: Access): Promise<Version> {
  const [version] = await query<Version>("select * from public.versions where id = $1", [id]);
  if (!version) throw new ApiError(404, "Version not found.");
  await loadStory(version.story_id, user, access);
  return version;
}

const JSON_COLUMNS = new Set(["content", "review"]);

/** Column names come from the calling code, never from a request. */
export async function updateVersion(id: string, fields: Record<string, unknown>): Promise<Version> {
  const entries = Object.entries(fields);
  const assignments = entries.map(([column], i) => `${column} = $${i + 2}`).join(", ");
  const values = entries.map(([column, value]) => (JSON_COLUMNS.has(column) ? JSON.stringify(value) : value));
  const [version] = await query<Version>(`update public.versions set ${assignments} where id = $1 returning *`, [id, ...values]);
  if (!version) throw new ApiError(404, "Version not found.");
  return version;
}

export const uuid = z.string().uuid();

/** For pages: the signed-in user, or a redirect to sign in. */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
