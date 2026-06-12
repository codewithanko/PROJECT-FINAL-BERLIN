import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { usernameToEmail } from "@/lib/username";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — Sandstone School" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // UPDATED: Send to /students so the app-shell can route them based on their role
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/students", replace: true });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const email = usernameToEmail(username);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Welcome back!");
      
      // UPDATED: Send to /students so the app-shell can route them based on their role
      navigate({ to: "/students", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { title: "Stay Organised", desc: "Students, staff and admissions in one place." },
    { title: "Track Performance", desc: "8-week marks with automatic averages and grades." },
    { title: "Financial Clarity", desc: "Income, expenses and fee balances at a glance." },
    { title: "Role-Based Access", desc: "Each staff role sees only what they need." },
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Left Panel (Desktop) ── */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 text-sidebar-foreground"
        style={{ background: "linear-gradient(160deg, var(--sidebar) 0%, oklch(0.22 0.10 277) 100%)" }}
      >
        {/* Professional Text/Icon Logo */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center text-sidebar-foreground shadow-lg backdrop-blur-sm">
            <GraduationCap className="h-7 w-7" />
          </div>
          <div>
            <p className="font-bold text-lg leading-tight text-sidebar-foreground">Sandstone School</p>
            <p className="text-xs text-sidebar-muted leading-tight">of Languages & Computer Studies</p>
          </div>
        </div>

        <div className="space-y-8">
          <p className="text-xs tracking-[0.3em] text-sidebar-muted font-medium">SCHOOL MANAGEMENT SYSTEM</p>
          <h1 className="text-4xl xl:text-5xl font-bold leading-tight">Run your school with confidence.</h1>
          <p className="text-sidebar-muted max-w-md">
            One organised platform for students, staff, finance and performance — built for academic teams that move fast.
          </p>
          <ul className="space-y-4 pt-4">
            {features.map((f) => (
              <li key={f.title} className="flex items-start gap-3 transition-all duration-300 hover:translate-x-1">
                <CheckCircle2 className="h-5 w-5 text-success mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-sm text-sidebar-muted">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-sidebar-muted">© {new Date().getFullYear()} Sandstone School. All rights reserved.</p>
      </div>

      {/* ── Right Panel (Login Form) ── */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          
          {/* Mobile Logo (Clean & Centered) */}
          <div className="lg:hidden flex flex-col items-center justify-center mb-8 gap-2">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
              <GraduationCap className="h-9 w-9" />
            </div>
            <p className="font-bold text-xl text-foreground">Sandstone School</p>
            <p className="text-xs text-muted-foreground">Management System</p>
          </div>

          <h2 className="text-3xl font-bold">Welcome Back</h2>
          <p className="text-muted-foreground mt-1">Sign in with the username given to you by the admin.</p>

          <div className="mt-8 rounded-2xl border bg-card shadow-sm p-6 space-y-5 transition-all duration-300 hover:shadow-md">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder="e.g. receptionist1"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">Format: role + number (e.g. <code>admin1</code>, <code>accountant2</code>).</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-sidebar text-sidebar-foreground hover:bg-sidebar-active hover:shadow-lg active:scale-[0.98] transition-all"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Log in"}
              </Button>
            </form>

            <p className="text-center text-xs text-muted-foreground">
              Accounts are issued by the superadmin. Contact them to be added.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}