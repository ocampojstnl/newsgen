"use client";

import { motion } from "motion/react";
import { Loader2, Pencil, ShieldCheck, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { initialsOf } from "@/components/current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import type { AdminUserRow } from "@/lib/users";
import { cn } from "@/lib/utils";


async function send(url: string, method: string, body: object): Promise<AdminUserRow[]> {
  const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  return data.users;
}

type Roles = { reporter: boolean; admin: boolean };

const ROLE_OPTIONS: { id: keyof Roles; label: string; text: string }[] = [
  { id: "reporter", label: "Reporter", text: "Writes stories and versions." },
  { id: "admin", label: "Admin", text: "Manages users and approves public links." },
];

/** Tick one role or both. At least one is required. */
function RolePicker({ value, onChange }: { value: Roles; onChange: (roles: Roles) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {ROLE_OPTIONS.map((option) => (
        <Label
          key={option.id}
          className="flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 font-normal transition-colors hover:border-primary/40 has-data-checked:border-primary has-data-checked:bg-primary/8"
        >
          <Checkbox className="mt-0.5" checked={value[option.id]} onCheckedChange={(checked) => onChange({ ...value, [option.id]: checked === true })} />
          <span>
            <span className="block text-sm font-medium">{option.label}</span>
            <span className="block text-xs text-muted-foreground">{option.text}</span>
          </span>
        </Label>
      ))}
    </div>
  );
}

function CreateUserDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved: (users: AdminUserRow[]) => void }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<Roles>({ reporter: true, admin: false });
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      onSaved(await send("/api/admin/users", "POST", { username, displayName, password, roles }));
      toast.success(`Account created. Give ${displayName} their username and password.`);
      setUsername("");
      setDisplayName("");
      setPassword("");
      setRoles({ reporter: true, admin: false });
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The account could not be created.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New user</DialogTitle>
            <DialogDescription>They sign in with this username and password. Share the password with them privately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Full name (used as the byline)</Label>
            <Input id="new-name" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-username">Username</Label>
            <Input id="new-username" required autoCapitalize="none" spellCheck={false} placeholder="juan.delacruz" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} />
            <p className="text-xs text-muted-foreground">3 to 32 letters, numbers, dots, dashes or underscores.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Password</Label>
            <Input id="new-password" type="text" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Roles</Label>
            <RolePicker value={roles} onChange={setRoles} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving || (!roles.admin && !roles.reporter)}>
              {saving && <Loader2 className="animate-spin" />} Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  isSelf,
  onClose,
  onSaved,
}: {
  user: AdminUserRow;
  isSelf: boolean;
  onClose: () => void;
  onSaved: (users: AdminUserRow[]) => void;
}) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [roles, setRoles] = useState<Roles>({ reporter: user.is_reporter, admin: user.role === "admin" });
  const [disabled, setDisabled] = useState(user.disabled);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      onSaved(
        await send(`/api/admin/users/${user.id}`, "PATCH", {
          displayName,
          roles,
          disabled,
          ...(password ? { password } : {}),
        }),
      );
      toast.success(password ? "Saved. The new password signs them out everywhere." : "Saved.");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The changes could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit @{user.username}</DialogTitle>
            <DialogDescription>Usernames cannot be changed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Full name</Label>
            <Input id="edit-name" required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Roles</Label>
            <RolePicker value={roles} onChange={setRoles} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-password">New password</Label>
            <Input id="edit-password" type="text" minLength={8} autoComplete="new-password" placeholder="Leave empty to keep the current one" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <Label className={cn("items-start gap-2.5 font-normal", isSelf && "opacity-50")}>
            <Checkbox checked={disabled} onCheckedChange={(checked) => setDisabled(checked === true)} disabled={isSelf} className="mt-0.5" />
            <span>
              Disable this account
              <span className="block text-xs text-muted-foreground">They are signed out and cannot sign in. Their stories stay.</span>
            </span>
          </Label>
          <DialogFooter>
            <Button type="submit" disabled={saving || (!roles.admin && !roles.reporter)}>
              {saving && <Loader2 className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersAdmin({ initialUsers, currentUserId }: { initialUsers: AdminUserRow[]; currentUserId: string }) {
  const [users, setUsers] = useState(initialUsers);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUserRow | null>(null);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-gradient text-3xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create accounts for your reporters. Each person owns their stories and can share them with others.</p>
        </div>
        <Button className="shadow-lg shadow-primary/25" onClick={() => setCreating(true)}>
          <UserPlus /> New user
        </Button>
      </div>

      <ul className="divide-y overflow-hidden rounded-lg border bg-card/70 backdrop-blur">
        {users.map((user, index) => (
          <motion.li
            key={user.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index, 10) * 0.03 }}
            className={cn("flex flex-wrap items-center gap-3 p-4", user.disabled && "opacity-60")}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-sm font-semibold text-primary">{initialsOf(user.display_name)}</span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {user.display_name}
                {user.id === currentUserId && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                {user.is_reporter && <Badge variant="outline">Reporter</Badge>}
                {user.role === "admin" && (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="size-3" /> Admin
                  </Badge>
                )}
                {user.disabled && <Badge variant="outline">Disabled</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">
                @{user.username} · {user.story_count} {user.story_count === 1 ? "story" : "stories"} · Added {formatDateTime(user.created_at)}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditing(user)}>
              <Pencil /> Edit
            </Button>
          </motion.li>
        ))}
      </ul>

      <CreateUserDialog open={creating} onOpenChange={setCreating} onSaved={setUsers} />
      {editing && <EditUserDialog key={editing.id} user={editing} isSelf={editing.id === currentUserId} onClose={() => setEditing(null)} onSaved={setUsers} />}
    </div>
  );
}
