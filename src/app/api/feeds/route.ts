import { NextResponse } from "next/server";
import { errorResponse, requireUser } from "@/lib/api";
import { loadAllFeeds } from "@/lib/feeds";

export async function GET() {
  try {
    await requireUser();
    return NextResponse.json(await loadAllFeeds());
  } catch (error) {
    return errorResponse(error);
  }
}
