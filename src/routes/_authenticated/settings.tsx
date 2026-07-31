import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Settings as SettingsIcon, KeyRound, Database, User, Bell, Palette,
  Download, Loader2, ShieldCheck, Mail, Users, School, Save,
  CheckCircle2, Clock, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useCurrentRole } from "@/hooks/use-role";
import { ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Sandstone School" }] }),
  component: SettingsPage,
});

type Tab = "profile" | "security" | "school" | "team" | "data" | "appearance" | "notifications";

const tabs: { key: Tab; label: string; icon: any }[] = [
  { key: "profile",       label: "Profile",       icon: User },
  { key: "security",      label: "Security",      icon: KeyRound },
  { key: "school",        label: "School Info",   icon: School },
  { key: "team",          label: "Team",          icon: Users },
  { key: "data",          label: "Data & Backup", icon: Database },
  { key: "appearance",    label: "Appearance",    icon: Palette },
  { key: "notifications", label: "Notifications", icon: Bell },
];

// ============================================================================
// EVERY table backups should know about. If you add a new table to the
// database later, add its name here too — this single list drives every
// backup card below, so there's only one place to keep in sync.
// ============================================================================
const ALL_TABLES = [
  "students",
  "payments",
  "transactions",
  "budgets",
  "marks",
  "attendance",
  "student_daily_progress",
  "events",
  "messages",
  "staff",
  "staff_members",
  "staff_advances",
  "staff_attendance",
  "profiles",
  "user_roles",
  "password_reset_requests",
  "school_settings",
] as const;

const BACKUP_CATEGORIES = [
  {
    key: "full",
    title: "Full Backup",
    desc: "Every table in the system — the complete safety net.",
    tables: [...ALL_TABLES],
    highlight: true,
  },
  {
    key: "students",
    title: "Students & Academics",
    desc: "Student profiles, marks, attendance, daily progress.",
    tables: ["students", "marks", "attendance", "student_daily_progress"],
  },
  {
    key: "finance",
    title: "Finance",
    desc: "Payments, ledger transactions, and weekly budgets.",
    tables: ["payments", "transactions", "budgets"],
  },
  {
    key: "staff",
    title: "Staff & HR",
    desc: "Staff records, advances, and staff attendance.",
    tables: ["staff", "staff_members", "staff_advances", "staff_attendance"],
  },
  {
    key: "comms",
    title: "Communication",
    desc: "Events and internal messages.",
    tables: ["events", "messages"],
  },
  {
    key: "system",
    title: "System & Access",
    desc: "User profiles, roles, password reset requests, school settings.",
    tables: ["profiles", "user_roles", "password_reset_requests", "school_settings"],
  },
] as const;

const LAST_BACKUP_KEY = "ssl.settings.lastFullBackupAt";

function SettingsPage() {
  const { data: me } = useCurrentRole();
  const [tab, setTab] = useState<Tab>("profile");
  const canManage = me?.role === "superadmin" || me?.role === "admin";

  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <SettingsIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">Manage your account, security and platform preferences</p>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[260px,1fr] gap-6">
        <aside className="rounded-2xl border bg-card p-3 h-fit">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  active ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </aside>

        <section className="rounded-2xl border bg-card p-8 min-h-[480px]">
          {tab === "profile" && <ProfilePanel role={me?.role ? ROLE_LABELS[me.role] : "—"} />}
          {tab === "security" && <SecurityPanel />}
          {tab === "school" && <SchoolInfoPanel canEdit={canManage} />}
          {tab === "team" && <TeamPanel canManage={canManage} />}
          {tab === "data" && <DataPanel canBackup={canManage} />}
          {tab === "appearance" && <AppearancePanel />}
          {tab === "notifications" && <NotificationsPanel />}
        </section>
      </div>
    </div>
  );
}

function ProfilePanel({ role }: { role: string }) {
  const [user, setUser] = useState<{ email: string; username: string } | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const meta = (data.user.user_metadata as any) ?? {};
        setUser({ email: data.user.email ?? "", username: meta.username ?? (data.user.email?.split("@")[0] ?? "") });
      }
    });
  }, []);
  return (
    <div className="space-y-6 max-w-xl">
      <SectionHead icon={User} title="Profile" desc="Your account identity within Sandstone SMS." />
      <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center text-2xl font-bold">
          {(user?.username?.[0] ?? "?").toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-lg">{user?.username ?? "—"}</p>
          <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{user?.email ?? "—"}</p>
          <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            <ShieldCheck className="h-3 w-3" />{role}
          </span>
        </div>
      </div>
      <div className="space-y-3">
        <Field label="Username" value={user?.username ?? ""} disabled />
        <Field label="Email" value={user?.email ?? ""} disabled />
        <Field label="Role" value={role} disabled />
      </div>
      <p className="text-xs text-muted-foreground">Need to change your username or role? Ask your Super Admin.</p>
    </div>
  );
}

function SecurityPanel() {
  const [current, setCurrent] = useState("");
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("Password must be at least 8 characters");
    if (pwd !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (u.user?.email) {
        const { error: signErr } = await supabase.auth.signInWithPassword({ email: u.user.email, password: current });
        if (signErr) throw new Error("Current password is incorrect");
      }
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      toast.success("Password updated");
      setCurrent(""); setPwd(""); setConfirm("");
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <SectionHead icon={KeyRound} title="Change Password" desc="Use a strong password you don't use elsewhere." />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Current password" type="password" value={current} onChange={setCurrent} required />
        <Field label="New password" type="password" value={pwd} onChange={setPwd} required />
        <Field label="Confirm new password" type="password" value={confirm} onChange={setConfirm} required />
        <Button type="submit" disabled={loading} className="w-full sm:w-auto">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
          Update password
        </Button>
      </form>

      <div className="border-t pt-6 space-y-3">
        <SectionHead icon={ShieldCheck} title="Session" desc="Sign out of this device." />
        <Button
          variant="outline"
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }}
        >Sign out everywhere</Button>
      </div>
    </div>
  );
}

// ============================================================================
// NEW: School Info panel — backed by a single-row `school_settings` table.
// ============================================================================
type SchoolSettingsRow = {
  id: string;
  school_name: string;
  currency_code: string;
  currency_symbol: string;
  registration_fee: number;
  address: string | null;
  phone: string | null;
  email: string | null;
};

function SchoolInfoPanel({ canEdit }: { canEdit: boolean }) {
  const [row, setRow] = useState<SchoolSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("school_settings").select("*").limit(1).single();
    if (error) {
      toast.error("Could not load school settings: " + error.message);
    } else {
      setRow(data as SchoolSettingsRow);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSettings(); }, []);

  const save = async () => {
    if (!row) return;
    setSaving(true);
    const { error } = await supabase.from("school_settings").update({
      school_name: row.school_name,
      currency_code: row.currency_code,
      currency_symbol: row.currency_symbol,
      registration_fee: row.registration_fee,
      address: row.address,
      phone: row.phone,
      email: row.email,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    setSaving(false);
    if (error) { toast.error("Save failed: " + error.message); return; }
    toast.success("School settings updated");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading school settings...
      </div>
    );
  }

  if (!row) {
    return (
      <div className="space-y-4">
        <SectionHead icon={School} title="School Info" desc="Basic details used across the platform." />
        <div className="p-6 rounded-xl border border-dashed text-center text-muted-foreground text-sm">
          No school settings row found. Run the SQL script in Supabase, then reload this page.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      <SectionHead icon={School} title="School Info" desc="These values are used across the platform — e.g. the default registration fee shown at Admissions." />
      {!canEdit && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Only Admin and Super Admin can edit these settings.
        </div>
      )}
      <div className="space-y-3">
        <Field label="School Name" value={row.school_name} onChange={v => setRow({ ...row, school_name: v })} disabled={!canEdit} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency Code" value={row.currency_code} onChange={v => setRow({ ...row, currency_code: v })} disabled={!canEdit} />
          <Field label="Currency Symbol / Prefix" value={row.currency_symbol} onChange={v => setRow({ ...row, currency_symbol: v })} disabled={!canEdit} />
        </div>
        <Field
          label="Default Registration Fee"
          type="number"
          value={String(row.registration_fee)}
          onChange={v => setRow({ ...row, registration_fee: Number(v) || 0 })}
          disabled={!canEdit}
        />
        <Field label="Address" value={row.address ?? ""} onChange={v => setRow({ ...row, address: v })} disabled={!canEdit} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" value={row.phone ?? ""} onChange={v => setRow({ ...row, phone: v })} disabled={!canEdit} />
          <Field label="Email" value={row.email ?? ""} onChange={v => setRow({ ...row, email: v })} disabled={!canEdit} />
        </div>
      </div>
      {canEdit && (
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Changes
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        Note: The Admissions page currently uses a hardcoded registration fee. We can wire it to read from this setting in a future update.
      </p>
    </div>
  );
}

// ============================================================================
// NEW: Team panel — read-only roster of everyone with access, and their role.
// ============================================================================
type TeamMember = {
  id: string;
  username: string | null;
  email: string | null;
  role: string | null;
};

function TeamPanel({ canManage }: { canManage: boolean }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      // ✅ FIXED: Changed select("") to select specific columns to prevent Supabase errors
      const [{ data: profiles, error: profErr }, { data: roles, error: roleErr }] = await Promise.all([
        supabase.from("profiles").select("id, username, email, full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      if (profErr || roleErr) {
        setError((profErr ?? roleErr)?.message ?? "Failed to load team");
        setLoading(false);
        return;
      }

      const roleByUserId = new Map((roles ?? []).map((r: any) => [r.user_id ?? r.id, r.role]));
      const merged: TeamMember[] = (profiles ?? []).map((p: any) => ({
        id: p.id,
        username: p.username ?? p.full_name ?? null,
        email: p.email ?? null,
        role: roleByUserId.get(p.id) ?? null,
      }));
      setMembers(merged);
      setLoading(false);
    };
    load();
  }, []);

  if (!canManage) {
    return (
      <div className="space-y-4">
        <SectionHead icon={Users} title="Team" desc="Who has access to this system." />
        <div className="p-6 rounded-xl border border-dashed text-center text-muted-foreground text-sm">
          Only Admin and Super Admin can view the team roster.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHead icon={Users} title="Team" desc="Everyone with an account on this system." />
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading team...
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
          Couldn't load the team list: {error}
          <p className="text-xs text-muted-foreground mt-1">
            This usually means the `profiles` or `user_roles` table column names differ from
            what this panel expects. Ask KAIRO to adjust the query to match your actual schema.
          </p>
        </div>
      ) : members.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed text-center text-muted-foreground text-sm">
          No team members found.
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map(m => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.username ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{m.email ?? "—"}</TableCell>
                  <TableCell>
                    {m.role ? (
                      <Badge variant="outline" className="text-xs capitalize">{ROLE_LABELS[m.role as keyof typeof ROLE_LABELS] ?? m.role}</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No role assigned</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        To add or remove team members, or change someone's role, do it from your Supabase
        Auth dashboard for now — a full invite/manage flow can be added here later if you want it.
      </p>
    </div>
  );
}

// ============================================================================
// FIXED: Data & Backup — now covers every known table, split into meaningful 
// categories, plus a "last backed up" reminder.
// ============================================================================
function DataPanel({ canBackup }: { canBackup: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  useEffect(() => {
    setLastBackupAt(localStorage.getItem(LAST_BACKUP_KEY));
  }, []);

  const daysSinceBackup = useMemo(() => {
    if (!lastBackupAt) return null;
    const diff = Date.now() - new Date(lastBackupAt).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }, [lastBackupAt]);

  const backup = async (tables: readonly string[], filename: string, isFull: boolean) => {
    setBusy(filename);
    try {
      const dump: Record<string, any[]> = {};
      const failedTables: string[] = [];

      for (const t of tables) {
        const { data, error } = await supabase.from(t as any).select("*");
        if (error) {
          failedTables.push(t);
          continue;
        }
        dump[t] = data ?? [];
      }

      const blob = new Blob(
        [JSON.stringify({ exportedAt: new Date().toISOString(), tables: Object.keys(dump), failedTables, data: dump }, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      if (failedTables.length > 0) {
        toast.warning(`Backup downloaded, but couldn't read: ${failedTables.join(", ")}`, {
          description: "Those table names may not match your database — check for typos.",
        });
      } else {
        toast.success("Backup downloaded");
      }

      if (isFull) {
        const now = new Date().toISOString();
        localStorage.setItem(LAST_BACKUP_KEY, now);
        setLastBackupAt(now);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Backup failed");
    } finally {
      setBusy(null);
    }
  };

  if (!canBackup) {
    return (
      <div className="space-y-4">
        <SectionHead icon={Database} title="Data & Backup" desc="Only Super Admin and Admin can export backups." />
        <div className="p-6 rounded-xl border border-dashed text-center text-muted-foreground">
          You don't have permission to access backups.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHead icon={Database} title="Data & Backup" desc="Download a snapshot of your platform data as JSON — every table, not just a subset." />
      
      {daysSinceBackup === null ? (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> No full backup has been taken from this browser yet. Run one below.
        </div>
      ) : daysSinceBackup > 7 ? (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <Clock className="h-4 w-4 shrink-0" /> Last full backup was {daysSinceBackup} days ago — consider running a fresh one.
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Last full backup: {daysSinceBackup === 0 ? "today" : `${daysSinceBackup} day${daysSinceBackup > 1 ? "s" : ""} ago`}
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {BACKUP_CATEGORIES.map((c) => (
          <div
            key={c.key}
            className={cn(
              "rounded-xl border p-5 hover:border-primary/40 hover:shadow-md transition-all",
              c.highlight ? "bg-primary/5 border-primary/30 sm:col-span-2" : "bg-muted/30"
            )}
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Database className="h-5 w-5" />
            </div>
            <p className="font-semibold">{c.title}</p>
            <p className="text-sm text-muted-foreground mt-1 mb-2">{c.desc}</p>
            <p className="text-[10px] text-muted-foreground mb-4 font-mono">{c.tables.join(", ")}</p>
            <Button size="sm" onClick={() => backup(c.tables, c.key, !!c.highlight)} disabled={busy === c.key}>
              {busy === c.key ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Download
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Tip: store backups in a secure offline location (not just this laptop) — e.g. Google
        Drive, a USB drive, or emailed to yourself. Backups are scoped by your current access rights.
      </p>
    </div>
  );
}

function AppearancePanel() {
  const [dark, setDark] = useState(document.documentElement.classList.contains("dark"));
  return (
    <div className="space-y-6 max-w-xl">
      <SectionHead icon={Palette} title="Appearance" desc="Personalise how the platform looks." />
      <Row title="Dark mode" desc="Use a darker palette across the platform.">
        <Switch checked={dark} onCheckedChange={(v) => { setDark(v); document.documentElement.classList.toggle("dark", v); }} />
      </Row>
      <Row title="Compact density" desc="Tighter spacing in tables and cards.">
        <Switch />
      </Row>
    </div>
  );
}

function NotificationsPanel() {
  return (
    <div className="space-y-6 max-w-xl">
      <SectionHead icon={Bell} title="Notifications" desc="Choose what triggers alerts." />
      <Row title="Payment alerts" desc="Notify when a payment is received."> <Switch defaultChecked /> </Row>
      <Row title="New admissions" desc="Notify on new student admissions."> <Switch defaultChecked /> </Row>
      <Row title="Low attendance" desc="Notify when a student drops below 75%."> <Switch /> </Row>
    </div>
  );
}

// ---------- shared bits ----------
function SectionHead({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="font-semibold text-lg">{title}</h2>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", disabled, required }: { label: string; value: string; onChange?: (v: string) => void; type?: string; disabled?: boolean; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange?.(e.target.value)} disabled={disabled} required={required} />
    </div>
  );
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4 rounded-xl border bg-muted/30 hover:border-primary/40 transition-all">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  );
}