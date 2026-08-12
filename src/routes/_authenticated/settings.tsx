import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon, KeyRound, Database, User, Bell, Palette,
  Download, Loader2, ShieldCheck, Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useCurrentRole } from "@/hooks/use-role";
import { ROLE_LABELS } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Sandstone School" }] }),
  component: SettingsPage,
});

type Tab = "profile" | "security" | "data" | "appearance" | "notifications";

const tabs: { key: Tab; label: string; icon: any }[] = [
  { key: "profile",       label: "Profile",       icon: User },
  { key: "security",      label: "Security",      icon: KeyRound },
  { key: "data",          label: "Data & Backup", icon: Database },
  { key: "appearance",    label: "Appearance",    icon: Palette },
  { key: "notifications", label: "Notifications", icon: Bell },
];

function SettingsPage() {
  const { data: me } = useCurrentRole();
  const [tab, setTab] = useState<Tab>("profile");

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
          {tab === "data" && <DataPanel canBackup={me?.role === "superadmin" || me?.role === "admin"} />}
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
      // Verify current password by re-authenticating
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

function DataPanel({ canBackup }: { canBackup: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);

  const backup = async (tables: string[], filename: string) => {
    setBusy(filename);
    try {
      const dump: Record<string, any[]> = {};
      for (const t of tables) {
        const { data, error } = await supabase.from(t as any).select("*");
        if (error) throw error;
        dump[t] = data ?? [];
      }
      const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), data: dump }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
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

  const cards = [
    { key: "full",     title: "Full Backup",       desc: "Students, staff, finance and academic records.", tables: ["students","staff","transactions","marks","user_roles","profiles"] },
    { key: "students", title: "Students Backup",   desc: "Student profiles and academic records.",         tables: ["students","marks"] },
    { key: "finance",  title: "Finance Backup",    desc: "All financial transactions.",                    tables: ["transactions"] },
  ];

  return (
    <div className="space-y-6">
      <SectionHead icon={Database} title="Data & Backup" desc="Download a snapshot of your platform data as JSON." />
      <div className="grid sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <div key={c.key} className="rounded-xl border bg-muted/30 p-5 hover:border-primary/40 hover:shadow-md transition-all">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
              <Database className="h-5 w-5" />
            </div>
            <p className="font-semibold">{c.title}</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">{c.desc}</p>
            <Button size="sm" onClick={() => backup(c.tables, c.key)} disabled={busy === c.key}>
              {busy === c.key ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Download
            </Button>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Tip: store backups in a secure offline location. Backups are scoped by your current access rights.</p>
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
      <Row title="Payment alerts" desc="Notify when a payment is received."><Switch defaultChecked /></Row>
      <Row title="New admissions" desc="Notify on new student admissions."><Switch defaultChecked /></Row>
      <Row title="Low attendance" desc="Notify when a student drops below 75%."><Switch /></Row>
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
