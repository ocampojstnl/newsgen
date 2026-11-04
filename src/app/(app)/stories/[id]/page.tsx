import { notFound } from "next/navigation";
import { StoryWorkspace } from "@/components/story-workspace";
import { ApiError, loadSources, loadStory, loadVersions, requirePageUser, uuid } from "@/lib/api";
import type { SessionUser } from "@/lib/types";

async function loadBundle(id: string, user: SessionUser) {
  try {
    const story = await loadStory(id, user, "view");
    const [sources, versions] = await Promise.all([loadSources(id), loadVersions(id)]);
    return { story, sources, versions };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function StoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requirePageUser();
  const parsed = uuid.safeParse((await params).id);
  if (!parsed.success) notFound();

  const { version } = await searchParams;
  const { story, sources, versions } = await loadBundle(parsed.data, user);
  return (
    <StoryWorkspace
      key={story.id}
      story={story}
      sources={sources}
      versions={versions}
      initialVersionId={typeof version === "string" ? version : undefined}
    />
  );
}
