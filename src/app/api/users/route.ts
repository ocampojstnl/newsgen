import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/api";
import { query } from "@/lib/db";

/** People a story can be shared with: every other active account. */
export async function GET() {
  try {
    const user = await requireUser();
    const users = await query<{ id: string; username: string; display_name: string }>(
      "select id, username, display_name from public.users where not disabled and id <> $1 order by display_name",
      [user.id],
    );
    return NextResponse.json({ users });
  } catch (error) {
    return errorResponse(error);
  }
}
