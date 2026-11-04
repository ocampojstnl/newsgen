import { ApprovedList } from "@/components/approved-list";
import { requirePageUser } from "@/lib/api";
import { listApprovedVersions } from "@/lib/stories";

export default async function ApprovedPage() {
  return <ApprovedList versions={await listApprovedVersions(await requirePageUser())} />;
}
