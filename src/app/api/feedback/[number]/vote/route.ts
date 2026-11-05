import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireUser } from "@/lib/api";
import { query } from "@/lib/db";
import { loadFeedback } from "@/lib/feedback";

/** "Me too": one vote per person, toggled on and off. Developers use votes to see what matters most. */
export async function POST(_request: Request, { params }: { params: Promise<{ number: string }> }) {
  try {
    const user = await requireUser();
    const item = await loadFeedback(z.coerce.number().int().positive().parse((await params).number), user);
    if (item.voted) await query("delete from public.feedback_votes where feedback_id = $1 and user_id = $2", [item.id, user.id]);
    else await query("insert into public.feedback_votes (feedback_id, user_id) values ($1, $2) on conflict do nothing", [item.id, user.id]);
    return NextResponse.json({ item: await loadFeedback(item.number, user) });
  } catch (error) {
    return errorResponse(error);
  }
}
