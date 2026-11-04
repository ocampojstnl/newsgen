import { ApiError, errorResponse, loadSources, loadVersion, requireUser, uuid } from "@/lib/api";
import { pdfResponse } from "@/lib/pdf";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const id = uuid.parse((await params).id);
    const version = await loadVersion(id, user, "view");
    if (version.status !== "reviewed") throw new ApiError(422, "Approve this version before downloading a PDF.");
    const sources = await loadSources(version.story_id);
    return await pdfResponse({
      content: version.content,
      byline: version.byline,
      reviewedAt: version.reviewed_at,
      wordCount: version.word_count,
      language: version.language,
      sources,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
