import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SharedArticle } from "@/components/shared-article";
import { loadSharedVersion } from "@/lib/shared";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const shared = await loadSharedVersion((await params).token);
  return {
    title: shared?.content.headline.text ?? "Shared news article",
    description: shared?.content.dek?.text,
    robots: { index: false, follow: false },
  };
}

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shared = await loadSharedVersion(token);
  if (!shared) notFound();
  return <SharedArticle shared={shared} token={token} />;
}
