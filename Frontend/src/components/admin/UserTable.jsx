import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
const roleColor = {
  admin: "border-primary/40 bg-primary/10 text-primary",
  user: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
};
function initialsOf(user) {
  const source = user.displayName || user.email || "?";
  return source.slice(0, 2).toUpperCase();
}
/**
 * @param {{ users: Array<{ id: string, email: string|null, displayName: string|null, role: string, createdAt: string, lastSignInAt: string|null }> }} props
 */
export function UserTable({ users }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const filtered = useMemo(() => {
    return users.filter((u) => {
      const haystack = `${u.displayName ?? ""}${u.email ?? ""}`.toLowerCase();
      const matches = haystack.includes(q.toLowerCase());
      const matchesRole = role === "all" || u.role === role;
      return matches && matchesRole;
    });
  }, [users, q, role]);
  return (
    <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3 border-b border-border/60 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search users by name or email…"
            className="border-border/60 bg-background/40 pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["all", "admin", "user"].map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`rounded-lg border px-3 py-1.5 text-xs capitalize transition-colors ${
                role === r
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {r === "all" ? "All roles" : r}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-widest text-muted-foreground">
              <th className="p-3">User</th>
              <th className="p-3">Role</th>
              <th className="p-3">Joined</th>
              <th className="p-3 text-right">Last sign-in</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border border-primary/30">
                      <AvatarFallback className="bg-primary/10 text-xs text-primary">
                        {initialsOf(u)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{u.displayName ?? "—"}</div>
                      <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <Badge
                    variant="outline"
                    className={`text-[10px] uppercase tracking-widest ${roleColor[u.role] ?? roleColor.user}`}
                  >
                    {u.role}
                  </Badge>
                </td>
                <td className="p-3 text-xs text-muted-foreground">
                  {format(new Date(u.createdAt), "MMM d, yyyy")}
                </td>
                <td className="p-3 text-right text-xs text-muted-foreground">
                  {u.lastSignInAt ? format(new Date(u.lastSignInAt), "MMM d, yyyy HH:mm") : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border/60 p-3 text-xs text-muted-foreground">
        <div>
          Showing <span className="text-foreground">{filtered.length}</span> of{" "}
          <span className="text-foreground">{users.length}</span>
        </div>
      </div>
    </div>
  );
}
