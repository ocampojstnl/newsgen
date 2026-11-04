import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, loadSources, loadStory, requireUser, uuid } from "@/lib/api";
import { query } from "@/lib/db";
import { captureForStory, insertSource, pastedRow, sourceRequest } from "@/lib/sources";

const body = sourceRequest.extend({
  pastedText: z.string().max(100_000).optional(),
  replacesPendingUrl: z.string().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = uuid.parse((await params).id);
    const input = body.parse(await request.json());
    const story = await loadStory(id, user, "edit");
    const existing = await loadSources(id);

    let row;
    if (input.pastedText !== undefined) {
      row = pastedRow({
        url: input.url,
        title: input.title?.trim() || input.url,
        text: input.pastedText,
        outletId: input.outletId,
      });
    } else {
      const capture = await captureForStory(input);
      if (!capture.row) throw new ApiError(422, capture.pending.reason);
      row = capture.row;
    }

    const source = await insertSource(id, existing, row);
    const pending = story.pending_sources.filter(
      (p) => p.url !== (input.replacesPendingUrl ?? input.url) && p.url !== source.url,
    );
    // New evidence changes the fact base, so facts are rebuilt on the next generation.
    await query("update public.stories set pending_sources = $2, facts = null, conflicts = '[]' where id = $1", [
      id,
      JSON.stringify(pending),
    ]);
    return NextResponse.json({ source, pending });
  } catch (error) {
    return errorResponse(error);
  }
}
