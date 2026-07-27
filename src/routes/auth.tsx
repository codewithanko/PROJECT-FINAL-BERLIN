import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, GraduationCap, TrendingUp, Users, Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false); // ✅ NEW: Password visibility toggle
  const [loading, setLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const backgroundImages = [
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1920&q=80",
    "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1920&q=80",
    "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1920&q=80",
    "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1920&q=80",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
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
      navigate({ to: "/dashboard", replace: true });
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
      {/* ── Left Panel with Background Images ── */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0">
          {backgroundImages.map((img, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentImageIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              <img src={img} alt={`School management ${index + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-br from-sidebar/95 via-sidebar/90 to-oklch(0.22 0.10 277)/95" />
            </div>
          ))}
        </div>

        <div className="absolute top-20 right-10 space-y-3 z-10">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 shadow-xl">
            <div className="flex items-center gap-2 text-white">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-xs font-semibold">Revenue Tracking</span>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 shadow-xl">
            <div className="flex items-center gap-2 text-white">
              <Users className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-semibold">200+ Students</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-sidebar-foreground h-full">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center text-sidebar-foreground shadow-lg backdrop-blur-sm border border-white/20">
              <GraduationCap className="h-7 w-7" />
            </div>
            <div>
              <p className="font-bold text-lg leading-tight text-white">Sandstone School</p>
              <p className="text-xs text-white/80 leading-tight">of Languages & Computer Studies</p>
            </div>
          </div>

          <div className="space-y-8">
            <p className="text-xs tracking-[0.3em] text-white/70 font-medium">SCHOOL MANAGEMENT SYSTEM</p>
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight text-white">
              Run your school with confidence.
            </h1>
            <p className="text-white/80 max-w-md">
              One organised platform for students, staff, finance and performance — built for academic teams that move fast.
            </p>
            
            <ul className="space-y-4 pt-4">
              {features.map((f) => (
                <li key={f.title} className="flex items-start gap-3 transition-all duration-300 hover:translate-x-1 group">
                  <div className="h-8 w-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:bg-white/20 transition-colors">
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{f.title}</p>
                    <p className="text-sm text-white/70">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-white/60">© {new Date().getFullYear()} Sandstone School. All rights reserved.</p>
            <div className="flex gap-2">
              {backgroundImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === currentImageIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel (Login Form) ── */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex flex-col items-center justify-center mb-8 gap-2">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm">
              <GraduationCap className="h-9 w-9" />
            </div>
            <p className="font-bold text-xl text-foreground">Sandstone School</p>
            <p className="text-xs text-muted-foreground">Management System</p>
          </div>

          <h2 className="text-3xl font-bold">Welcome Back</h2>
          <p className="text-muted-foreground mt-1">Sign in with your assigned credentials.</p>

          <div className="mt-8 rounded-2xl border bg-card shadow-sm p-6 space-y-5 transition-all duration-300 hover:shadow-md">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                {/* ✅ REMOVED: All hints and examples for security */}
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
                </div>
                {/* ✅ ADDED: Working Show/Hide Password Toggle */}
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
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
              @kk Dev Tech Solutions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}