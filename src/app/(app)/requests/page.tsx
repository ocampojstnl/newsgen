import { RequestsList } from "@/components/requests-list";
import { requirePageUser } from "@/lib/api";
import { listIncomingRequests, listOutgoingRequests } from "@/lib/requests";

export default async function RequestsPage() {
  const user = await requirePageUser();
  const [incoming, outgoing] = await Promise.all([listIncomingRequests(user), listOutgoingRequests(user)]);
  return <RequestsList incoming={incoming} outgoing={outgoing} />;
}
