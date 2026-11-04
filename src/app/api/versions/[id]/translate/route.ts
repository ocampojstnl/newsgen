import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse, loadSources, loadVersion, loadVersions, requireUser, uuid } from "@/lib/api";
import { query } from "@/lib/db";
import { LANGUAGES, MAX_VERSIONS, type LanguageId } from "@/lib/options";
import { translateVersion } from "@/lib/pipeline";
import type { Version } from "@/lib/types";

export const maxDuration = 120;

const body = z.object({ language: z.enum(Object.keys(LANGUAGES) as [LanguageId, ...LanguageId[]]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = uuid.parse((await params).id);
    const { language } = body.parse(await request.json());
    const version = await loadVersion(id, user, "edit");
    if (version.language === language) throw new ApiError(400, `This version is already in ${language}.`);

    // Checked first, so a full story never spends Gemini requests on a translation it cannot save.
    const existing = await loadVersions(version.story_id);
    if (existing.length >= MAX_VERSIONS) {
      throw new ApiError(400, `This story already has ${MAX_VERSIONS} versions. Delete one to make room for the translation.`);
    }

    const result = await translateVersion({
      content: version.content,
      sources: await loadSources(version.story_id),
      from: version.language,
      language,
    });
    const baseLabel = version.label.replace(/, (English|Filipino)$/, "");
    const [created] = await query<Version>(
      `insert into public.versions (story_id, label, target_words, tone, language, content, review, word_count)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [
        version.story_id,
        `${baseLabel}, ${language}`,
        version.target_words,
        version.tone,
        language,
        JSON.stringify(result.content),
        JSON.stringify(result.review),
        result.wordCount,
      ],
    );
    return NextResponse.json({ version: created });
  } catch (error) {
    return errorResponse(error);
  }
}
