import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, loadSources, loadStory, requireUser, uuid } from "@/lib/api";
import { query } from "@/lib/db";
import { cleanText } from "@/lib/text";
import { isWebUrl, titlesMatch } from "@/lib/import";
import { insertSource, pastedRow } from "@/lib/sources";
import type { PendingSource } from "@/lib/types";

const body = z.object({
  url: z.string().max(2000).refine(isWebUrl),
  title: z.string().trim().min(1).max(500),
  paragraphs: z.array(z.string().max(20_000)).max(500),
  storyId: uuid.optional(),
  pendingUrl: z.string().max(2000).optional(),
});

async function attach(
  storyId: string,
  pendingSources: PendingSource[],
  row: ReturnType<typeof pastedRow>,
  isSameArticle: (p: PendingSource) => boolean,
) {
  await insertSource(storyId, await loadSources(storyId), row);
  // New evidence changes the fact base, so facts are rebuilt on the next generation.
  await query("update public.stories set pending_sources = $2, facts = null, conflicts = '[]' where id = $1", [
    storyId,
    JSON.stringify(pendingSources.filter((p) => !isSameArticle(p))),
  ]);
}

/** Saves an article read in the reporter's own browser, into the story waiting for it if there is one. */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = body.parse(await request.json());
    const row: ReturnType<typeof pastedRow> = {
      ...pastedRow({
        url: input.url,
        title: input.title,
        text: input.paragraphs.join("\n"),
      }),
      capture_method: "browser",
    };
    const sameTitle = (p: PendingSource) => titlesMatch(p.title, input.title);

    if (input.storyId) {
      const story = await loadStory(input.storyId, user, "edit");
      await attach(story.id, story.pending_sources, row, (p) => p.url === input.pendingUrl || sameTitle(p));
      return NextResponse.json({ id: story.id });
    }

    const [existing] = await query<{ story_id: string }>(
      `select o.story_id from public.sources o
       join public.stories s on s.id = o.story_id
       where o.url = $1 and s.owner_id = $2
       limit 1`,
      [input.url, user.id],
    );
    if (existing) return NextResponse.json({ id: existing.story_id });

    const waiting = await query<{
      id: string;
      pending_sources: PendingSource[];
    }>(
      `select id, pending_sources from public.stories
       where owner_id = $1 and jsonb_array_length(pending_sources) > 0
       order by created_at desc
       limit 200`,
      [user.id],
    );
    const match = waiting.find((story) => story.pending_sources.some(sameTitle));
    if (match) {
      await attach(match.id, match.pending_sources, row, sameTitle);
      return NextResponse.json({ id: match.id });
    }

    const [story] = await query<{ id: string }>("insert into public.stories (title, owner_id) values ($1, $2) returning id", [
      cleanText(input.title),
      user.id,
    ]);
    await insertSource(story.id, [], row);
    return NextResponse.json({ id: story.id });
  } catch (error) {
    return errorResponse(error);
  }
}
