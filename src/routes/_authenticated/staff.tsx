import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Copy, RefreshCw, Trash2, KeyRound, ShieldAlert, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createStaffUser, listStaffUsers, deleteStaffUser, resetStaffPassword } from "@/lib/admin.functions";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";
import { useCurrentRole } from "@/hooks/use-role";
import { buildUsername, defaultPasswordForRole } from "@/lib/username";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff Accounts — Sandstone School" }] }),
  component: StaffPage,
});

const ASSIGNABLE_ROLES: AppRole[] = ["admin", "accountant", "marks_officer", "receptionist"];

const roleCards: { role: AppRole; perms: string; tint: string }[] = [
  { role: "superadmin", perms: "Full access · All modules", tint: "bg-destructive/10 text-destructive border-destructive/30" },
  { role: "admin", perms: "All modules except Subscriptions", tint: "bg-primary/10 text-primary border-primary/30" },
  { role: "accountant", perms: "Dashboard · Accounts · Reports · AI", tint: "bg-success/10 text-success border-success/30" },
  { role: "marks_officer", perms: "Students · Marks · Attendance · Graduates · Reports · AI", tint: "bg-info/10 text-info border-info/30" },
  { role: "receptionist", perms: "Admissions · Payments · Students · Dashboard · Attendance · Reports · AI", tint: "bg-warning/15 text-warning-foreground border-warning/30" },
];

function StaffPage() {
  const { data: me, isLoading: meLoading } = useCurrentRole();
  const qc = useQueryClient();

  const createFn = useServerFn(createStaffUser);
  const listFn = useServerFn(listStaffUsers);
  const deleteFn = useServerFn(deleteStaffUser);
  const resetFn = useServerFn(resetStaffPassword);

  const isSuper = me?.role === "superadmin";

  const list = useQuery({
    queryKey: ["staff-users"],
    queryFn: () => listFn({}),
    enabled: isSuper,
  });

  const [name, setName] = useState("");
  const [role, setRole] = useState<AppRole>("receptionist");
  const [number, setNumber] = useState(1);
  const [lastIssued, setLastIssued] = useState<{ username: string; password: string } | null>(null);

  const username = useMemo(() => buildUsername(role, number), [role, number]);
  const password = useMemo(() => defaultPasswordForRole(role), [role]);

  const create = useMutation({
    mutationFn: () => createFn({ data: { fullName: name, username, role, password } }),
    onSuccess: () => {
      setLastIssued({ username, password });
      toast.success("User created — copy the credentials and send them manually");
      setName("");
      qc.invalidateQueries({ queryKey: ["staff-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create user"),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => { toast.success("User revoked"); qc.invalidateQueries({ queryKey: ["staff-users"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const reset = useMutation({
    mutationFn: (v: { userId: string; password: string }) => resetFn({ data: v }),
    onSuccess: (_d, v) => {
      const u = list.data?.find((u) => u.userId === v.userId);
      setLastIssued({ username: u?.username ?? "", password: v.password });
      toast.success("Password reset — copy the new password");
      qc.invalidateQueries({ queryKey: ["staff-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const copy = (v: string) => { navigator.clipboard.writeText(v); toast.success("Copied"); };

  if (meLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!isSuper) {
    return (
      <div className="max-w-xl mx-auto mt-12 rounded-2xl border bg-card p-8 text-center">
        <ShieldAlert className="h-10 w-10 mx-auto text-destructive" />
        <h1 className="text-xl font-bold mt-3">Superadmin only</h1>
        <p className="text-muted-foreground text-sm mt-1">Only the superadmin can manage staff accounts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Staff Access Management</h1>
        <p className="text-muted-foreground mt-1">
          Create staff accounts. Usernames follow <code>role + number</code> and the password is the capitalised role name + <code>2026</code>.
        </p>
      </header>

      <div className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Access Level Summary</h2>
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {roleCards.map((r) => (
            <div key={r.role} className={cn("rounded-xl border p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg", r.tint)}>
              <p className="font-semibold">{ROLE_LABELS[r.role]}</p>
              <p className="text-xs mt-1 opacity-80">{r.perms}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Create Staff Account</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Pick a role and a number. The username and password are auto-generated.
        </p>

        <div className="mt-6 grid sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Nansamba" />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as AppRole)}
              className="w-full h-10 px-3 rounded-md border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Number</Label>
            <Input
              type="number"
              min={1}
              max={99}
              value={number}
              onChange={(e) => setNumber(Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
            />
            <p className="text-xs text-muted-foreground">Used to allow multiple people in the same role.</p>
          </div>
          <div className="space-y-2">
            <Label>Generated credentials (preview)</Label>
            <div className="grid grid-cols-2 gap-2">
              <code className="px-3 py-2 rounded-md border bg-muted font-mono text-sm truncate">{username}</code>
              <code className="px-3 py-2 rounded-md border bg-muted font-mono text-sm truncate">{password}</code>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            disabled={create.isPending || !name}
            onClick={() => create.mutate()}
            className="bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg active:scale-[0.98] transition-all"
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
          </Button>
        </div>

        {lastIssued && (
          <div className="mt-6 rounded-xl border border-success/30 bg-success/5 p-4">
            <p className="text-sm font-medium text-success">Credentials ready to share</p>
            <div className="mt-3 grid sm:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono bg-card px-3 py-1.5 rounded-md border">{lastIssued.username}</code>
                <button onClick={() => copy(lastIssued.username)} className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center"><Copy className="h-4 w-4" /></button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono bg-card px-3 py-1.5 rounded-md border">{lastIssued.password}</code>
                <button onClick={() => copy(lastIssued.password)} className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center"><Copy className="h-4 w-4" /></button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Send these via WhatsApp/SMS. They can change the password later from Change Password.</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <h2 className="font-semibold">Registered Staff</h2>
        {list.isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <ul className="mt-4 divide-y">
            {(list.data ?? []).map((u) => (
              <li key={u.userId} className="flex flex-wrap items-center gap-4 py-3">
                <div className="flex-1 min-w-[200px]">
                  <p className="font-medium">{u.fullName || u.username}</p>
                  <p className="text-xs text-muted-foreground font-mono">@{u.username}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{ROLE_LABELS[u.role as AppRole] ?? u.role}</span>
                <ResetButton
                  onReset={() => reset.mutate({ userId: u.userId, password: defaultPasswordForRole(u.role as AppRole) })}
                  pending={reset.isPending}
                />
                <button
                  onClick={() => { if (confirm(`Revoke ${u.username}?`)) remove.mutate(u.userId); }}
                  disabled={u.userId === me?.userId}
                  className="h-8 px-3 rounded-md text-sm text-destructive hover:bg-destructive/10 disabled:opacity-30 flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="h-4 w-4" /> Revoke
                </button>
              </li>
            ))}
            {list.data?.length === 0 && <li className="py-6 text-sm text-muted-foreground text-center">No staff accounts yet.</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResetButton({ onReset, pending }: { onReset: () => void; pending: boolean }) {
  return (
    <button
      onClick={onReset}
      disabled={pending}
      className="h-8 px-3 rounded-md text-sm text-primary hover:bg-primary/10 flex items-center gap-1.5 transition-colors"
      title="Reset to default password for this role"
    >
      <RefreshCw className="h-4 w-4" /> <KeyRound className="h-4 w-4" /> Reset to default
    </button>
  );
}
