import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, requireUser } from "@/lib/api";
import { query } from "@/lib/db";
import { cleanText } from "@/lib/text";
import { captureForStory, insertSource, MAX_SOURCES, sourceRequest } from "@/lib/sources";
import type { PendingSource, Source } from "@/lib/types";

const body = z.object({ items: z.array(sourceRequest).min(1).max(MAX_SOURCES) });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const { items } = body.parse(await request.json());

    // Clicking the same headline again reopens its story instead of making a copy.
    if (items.length === 1) {
      const [existing] = await query<{ id: string }>(
        `select s.id from public.stories s
         where s.owner_id = $3
           and (s.pending_sources @> $2::jsonb
             or exists (select 1 from public.sources o where o.story_id = s.id and o.url = $1))
         order by s.created_at desc
         limit 1`,
        [items[0].url, JSON.stringify([{ url: items[0].url }]), user.id],
      );
      if (existing) return NextResponse.json({ id: existing.id });
    }

    const captures = await Promise.all(items.map(captureForStory));

    const pending: PendingSource[] = captures.flatMap((c) => (c.pending ? [c.pending] : []));
    const firstRow = captures.find((c) => c.row)?.row;
    const [story] = await query<{ id: string }>(
      "insert into public.stories (title, pending_sources, owner_id) values ($1, $2, $3) returning id",
      [cleanText(firstRow?.title ?? items[0].title ?? items[0].url), JSON.stringify(pending), user.id],
    );

    const saved: Source[] = [];
    for (const capture of captures) {
      if (capture.row && !saved.some((s) => s.url === capture.row.url)) {
        saved.push(await insertSource(story.id, saved, capture.row));
      }
    }
    return NextResponse.json({ id: story.id });
  } catch (error) {
    return errorResponse(error);
  }
}
