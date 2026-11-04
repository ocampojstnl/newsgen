import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, loadSources, loadVersion, requireUser, updateVersion, uuid } from "@/lib/api";
import { query } from "@/lib/db";
import type { LanguageId } from "@/lib/options";
import { applyOutletRemoval, applyProofread, applyReporterEdit, blockingIssues } from "@/lib/pipeline";

export const maxDuration = 120;

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), sentenceId: z.string().max(50), text: z.string().max(3000) }),
  z.object({ action: z.literal("proofread") }),
  z.object({ action: z.literal("remove-outlets") }),
  z.object({
    action: z.literal("approve"),
    byline: z.string().trim().min(1).max(120),
    acknowledged: z.literal(true),
  }),
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = uuid.parse((await params).id);
    const input = body.parse(await request.json());
    const version = await loadVersion(id, user, "edit");

    let update: Record<string, unknown>;
    if (input.action === "edit") {
      const sources = await loadSources(version.story_id);
      const result = await applyReporterEdit({
        content: version.content,
        review: version.review,
        sentenceId: input.sentenceId,
        text: input.text,
        sources,
        language: version.language as LanguageId,
      });
      // Changed copy must be approved again, and any existing link stops serving until it is.
      update = {
        content: result.content,
        review: result.review,
        word_count: result.wordCount,
        status: "needs_review",
        reviewed_at: null,
      };
    } else if (input.action === "proofread" || input.action === "remove-outlets") {
      const sources = await loadSources(version.story_id);
      const apply = input.action === "proofread" ? applyProofread : applyOutletRemoval;
      const result = await apply({
        content: version.content,
        review: version.review,
        sources,
        language: version.language as LanguageId,
      });
      update = {
        content: result.content,
        review: result.review,
        word_count: result.wordCount,
        ...(result.changed ? { status: "needs_review", reviewed_at: null } : {}),
      };
    } else {
      const issues = blockingIssues(version.content, version.review);
      if (issues.length > 0) throw new ApiError(422, issues[0]);
      update = { status: "reviewed", byline: input.byline, reviewed_at: new Date().toISOString() };
    }

    return NextResponse.json({ version: await updateVersion(id, update) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = uuid.parse((await params).id);
    await loadVersion(id, user, "edit");
    await query("delete from public.versions where id = $1", [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
