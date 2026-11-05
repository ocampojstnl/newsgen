import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireUser } from "@/lib/api";
import { query } from "@/lib/db";
import { listFeedback } from "@/lib/feedback";

const body = z.object({
  kind: z.enum(["bug", "feature"]),
  title: z.string().trim().min(3, "Give it a short title.").max(140),
  description: z.string().trim().min(1, "Describe the problem or idea.").max(5000),
  page: z.string().trim().max(300).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ items: await listFeedback(user) });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Anyone signed in can file a bug or a feature request. It starts as "New" for a developer to triage. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = body.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400 });
    const input = parsed.data;
    const [row] = await query<{ number: number }>(
      `insert into public.feedback (kind, title, description, page, priority, reporter_id)
       values ($1, $2, $3, $4, $5, $6) returning number`,
      [input.kind, input.title, input.description, input.page || null, input.priority, user.id],
    );
    // The reporter counts as the first "me too".
    await query("insert into public.feedback_votes (feedback_id, user_id) select id, $2 from public.feedback where number = $1", [row.number, user.id]);
    return NextResponse.json({ number: row.number });
  } catch (error) {
    return errorResponse(error);
  }
}
