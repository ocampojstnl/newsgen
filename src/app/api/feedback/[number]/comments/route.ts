import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireUser } from "@/lib/api";
import { query } from "@/lib/db";
import { loadFeedback, loadFeedbackComments } from "@/lib/feedback";

const body = z.object({ body: z.string().trim().min(1, "Write something first.").max(3000) });

export async function POST(request: Request, { params }: { params: Promise<{ number: string }> }) {
  try {
    const user = await requireUser();
    const item = await loadFeedback(z.coerce.number().int().positive().parse((await params).number), user);
    const parsed = body.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    await query("insert into public.feedback_comments (feedback_id, author_id, body) values ($1, $2, $3)", [item.id, user.id, parsed.data.body]);
    // A new comment moves the task to the top of everyone's list.
    await query("update public.feedback set updated_at = now() where id = $1", [item.id]);
    return NextResponse.json({ comments: await loadFeedbackComments(item.id) });
  } catch (error) {
    return errorResponse(error);
  }
}
