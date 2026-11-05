import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, requireUser } from "@/lib/api";
import { query } from "@/lib/db";
import { loadFeedback, loadFeedbackComments } from "@/lib/feedback";
import { statusMeta, type FeedbackStatus } from "@/lib/feedback-meta";

const number = z.coerce.number().int().positive();

const body = z.object({
  // Reporters can correct their own task while it is still new.
  title: z.string().trim().min(3).max(140).optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  // Triage, for admins only.
  status: z.enum(["new", "accepted", "in_progress", "done", "not_doable", "duplicate"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  developerNote: z.string().trim().max(2000).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ number: string }> }) {
  try {
    const user = await requireUser();
    const item = await loadFeedback(number.parse((await params).number), user);
    return NextResponse.json({ item, comments: await loadFeedbackComments(item.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ number: string }> }) {
  try {
    const user = await requireUser();
    const item = await loadFeedback(number.parse((await params).number), user);
    const input = body.parse(await request.json());
    const isAdmin = user.role === "admin";
    const triage = input.status !== undefined || input.priority !== undefined || input.developerNote !== undefined;
    const editsText = input.title !== undefined || input.description !== undefined;

    if (triage && !isAdmin) throw new ApiError(403, "Only a developer (admin) can change status, priority or the developer note.");
    if (editsText && !isAdmin && (item.reporter_id !== user.id || item.status !== "new")) {
      throw new ApiError(403, "You can edit your own task until a developer starts on it.");
    }

    const sets: string[] = [];
    const values: unknown[] = [item.id];
    const set = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };
    if (input.title !== undefined) set("title", input.title);
    if (input.description !== undefined) set("description", input.description);
    if (input.status !== undefined) set("status", input.status);
    if (input.priority !== undefined) set("priority", input.priority);
    if (input.developerNote !== undefined) set("developer_note", input.developerNote || null);
    if (sets.length > 0) await query(`update public.feedback set ${sets.join(", ")} where id = $1`, values);

    // Each status change is recorded in the thread, so everyone sees what happened and when.
    if (input.status !== undefined && input.status !== item.status) {
      await query(
        "insert into public.feedback_comments (feedback_id, author_id, body, status_change) values ($1, $2, $3, $4)",
        [item.id, user.id, `Moved to ${statusMeta(input.status as FeedbackStatus).label}`, input.status],
      );
    }
    const updated = await loadFeedback(item.number, user);
    return NextResponse.json({ item: updated, comments: await loadFeedbackComments(item.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ number: string }> }) {
  try {
    const user = await requireUser();
    const item = await loadFeedback(number.parse((await params).number), user);
    const ownNew = item.reporter_id === user.id && item.status === "new";
    if (user.role !== "admin" && !ownNew) throw new ApiError(403, "You can delete your own task until a developer starts on it.");
    await query("delete from public.feedback where id = $1", [item.id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
