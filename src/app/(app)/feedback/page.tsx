import { FeedbackBoard } from "@/components/feedback-board";
import { requirePageUser } from "@/lib/api";
import { listFeedback } from "@/lib/feedback";

export default async function FeedbackPage() {
  return <FeedbackBoard items={await listFeedback(await requirePageUser())} />;
}
