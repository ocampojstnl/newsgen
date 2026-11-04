import { z } from "zod";
import { ApiError, errorResponse, loadSources, loadStory, loadVersions, requireUser, uuid } from "@/lib/api";
import { query } from "@/lib/db";
import { LANGUAGES, MAX_VERSIONS, TONES, type LanguageId, type ToneId } from "@/lib/options";
import { extractFacts, generateVersion } from "@/lib/pipeline";
import type { GenerationEvent, Version } from "@/lib/types";

export const maxDuration = 300;

const body = z.object({
  label: z.string().min(1).max(80),
  targetWords: z.number().int().min(50).max(3000).nullable(),
  tone: z.enum(Object.keys(TONES) as [ToneId, ...ToneId[]]),
  language: z.enum(Object.keys(LANGUAGES) as [LanguageId, ...LanguageId[]]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let setup;
  try {
    const user = await requireUser();
    const id = uuid.parse((await params).id);
    const input = body.parse(await request.json());
    const [story, sources, versions] = await Promise.all([loadStory(id, user, "edit"), loadSources(id), loadVersions(id)]);
    if (sources.length === 0) throw new ApiError(400, "Add at least one source first.");
    if (versions.length >= MAX_VERSIONS) {
      throw new ApiError(400, `A story can have up to ${MAX_VERSIONS} versions. Delete one to make another.`);
    }
    setup = { id, input, story, sources };
  } catch (error) {
    return errorResponse(error);
  }

  const { id, input, sources } = setup;
  let { story } = setup;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: GenerationEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        if (!story.facts) {
          send({ type: "progress", message: "Extracting facts and matching them to source passages" });
          const extracted = await extractFacts(sources);
          if (extracted.facts.length === 0) {
            throw new Error("No verifiable facts could be matched to the sources, so nothing was written.");
          }
          await query("update public.stories set facts = $2, conflicts = $3 where id = $1", [
            id,
            JSON.stringify(extracted.facts),
            JSON.stringify(extracted.conflicts),
          ]);
          story = { ...story, facts: extracted.facts, conflicts: extracted.conflicts };
        }

        const result = await generateVersion({
          facts: story.facts!,
          conflicts: story.conflicts,
          sources,
          targetWords: input.targetWords,
          tone: input.tone,
          language: input.language,
          progress: (message) => send({ type: "progress", message }),
        });

        const [version] = await query<Version>(
          `insert into public.versions (story_id, label, target_words, tone, language, content, review, word_count)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           returning *`,
          [
            id,
            input.label,
            input.targetWords,
            input.tone,
            input.language,
            JSON.stringify(result.content),
            JSON.stringify(result.review),
            result.wordCount,
          ],
        );
        send({ type: "done", version, facts: story.facts!, conflicts: story.conflicts });
      } catch (error) {
        console.error(error);
        send({ type: "error", message: error instanceof Error ? error.message : "The version could not be generated." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
