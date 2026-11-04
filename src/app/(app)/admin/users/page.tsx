import { notFound } from "next/navigation";
import { UsersAdmin } from "@/components/users-admin";
import { requirePageUser } from "@/lib/api";
import { listUsersForAdmin } from "@/lib/users";

export default async function UsersPage() {
  const user = await requirePageUser();
  if (user.role !== "admin") notFound();
  return <UsersAdmin initialUsers={await listUsersForAdmin()} currentUserId={user.id} />;
}
