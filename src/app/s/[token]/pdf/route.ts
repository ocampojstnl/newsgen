import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { pdfResponse } from "@/lib/pdf";
import { loadSharedVersion } from "@/lib/shared";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const shared = await loadSharedVersion((await params).token);
    if (!shared) return NextResponse.json({ error: "This link is not available." }, { status: 404 });
    return await pdfResponse({
      content: shared.content,
      byline: shared.byline,
      reviewedAt: shared.reviewed_at,
      wordCount: shared.word_count,
      language: shared.language,
      sources: shared.sources,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
