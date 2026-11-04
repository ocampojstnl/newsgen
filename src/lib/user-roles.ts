/** "Reporter", "Admin" or "Reporter · Admin". Shared by server and browser code. */
export function roleLabel(user: { role: "admin" | "reporter"; is_reporter: boolean }): string {
  return [user.is_reporter && "Reporter", user.role === "admin" && "Admin"].filter(Boolean).join(" · ");
}
