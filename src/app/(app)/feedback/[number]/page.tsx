import { notFound } from "next/navigation";
import { FeedbackDetail } from "@/components/feedback-detail";
import { ApiError, requirePageUser } from "@/lib/api";
import { loadFeedback, loadFeedbackComments } from "@/lib/feedback";
import type { SessionUser } from "@/lib/types";

async function loadTask(number: number, user: SessionUser) {
  try {
    const item = await loadFeedback(number, user);
    return { item, comments: await loadFeedbackComments(item.id) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function FeedbackTaskPage({ params }: { params: Promise<{ number: string }> }) {
  const user = await requirePageUser();
  const number = Number((await params).number);
  if (!Number.isInteger(number) || number < 1) notFound();
  const { item, comments } = await loadTask(number, user);
  return <FeedbackDetail key={item.id} item={item} comments={comments} />;
}
