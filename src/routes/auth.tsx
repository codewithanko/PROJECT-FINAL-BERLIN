import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, GraduationCap, TrendingUp, Users, Eye, EyeOff, Sparkles, BookOpen, Calculator, ClipboardList } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Dynamic time-based greeting (no emojis)
  const [greeting, setGreeting] = useState("Welcome");
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

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
    <div className="min-h-screen grid lg:grid-cols-2 bg-white dark:bg-slate-950 relative overflow-hidden">
      
      {/* System-themed background with floating icons */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        {/* Floating system icons */}
        <div className="absolute top-20 left-[10%] text-blue-200/20 dark:text-blue-600/10 animate-float-slow">
          <GraduationCap className="w-16 h-16" />
        </div>
        <div className="absolute top-1/3 right-[15%] text-blue-200/20 dark:text-blue-600/10 animate-float-medium">
          <BookOpen className="w-12 h-12" />
        </div>
        <div className="absolute bottom-1/4 left-[20%] text-blue-200/20 dark:text-blue-600/10 animate-float-slow" style={{ animationDelay: '2s' }}>
          <Calculator className="w-14 h-14" />
        </div>
        <div className="absolute bottom-1/3 right-[25%] text-blue-200/20 dark:text-blue-600/10 animate-float-medium" style={{ animationDelay: '1s' }}>
          <ClipboardList className="w-12 h-12" />
        </div>
        
        {/* Soft blue orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-200/20 dark:bg-blue-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-blue-100/20 dark:bg-blue-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
      </div>

      {/* ── Left Panel with Background Images ── */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden z-10">
        <div className="absolute inset-0">
          {backgroundImages.map((img, index) => (
            <div
              key={index}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                index === currentImageIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              <img src={img} alt={`School management ${index + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-blue-950/95 via-blue-900/90 to-blue-800/40" />
            </div>
          ))}
        </div>

        {/* ✅ MOVED: Stat cards now at the bottom, above the footer */}
        <div className="absolute bottom-32 right-10 space-y-3 z-10">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-3 border border-white/20 shadow-2xl transition-transform hover:scale-105 duration-300">
            <div className="flex items-center gap-3 text-white">
              <div className="h-7 w-7 rounded-full bg-emerald-400/20 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
              </div>
              <div>
                <p className="text-[9px] text-white/70 uppercase tracking-wider font-semibold">Revenue</p>
                <p className="text-xs font-bold">Tracking Active</p>
              </div>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-3 border border-white/20 shadow-2xl transition-transform hover:scale-105 duration-300">
            <div className="flex items-center gap-3 text-white">
              <div className="h-7 w-7 rounded-full bg-blue-400/20 flex items-center justify-center">
                <Users className="h-3.5 w-3.5 text-blue-300" />
              </div>
              <div>
                <p className="text-[9px] text-white/70 uppercase tracking-wider font-semibold">Community</p>
                <p className="text-xs font-bold">200+ Students</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white h-full">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center shadow-lg backdrop-blur-md border border-white/20">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="font-bold text-xl leading-tight">Sandstone School</p>
              <p className="text-sm text-white/70 leading-tight">of Languages & Computer Studies</p>
            </div>
          </div>

          <div className="space-y-8 max-w-lg">
            <p className="text-xs tracking-[0.3em] text-blue-200 font-bold uppercase flex items-center gap-2">
              <Sparkles className="h-3 w-3" /> School Management System
            </p>
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
              Run your school with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">confidence.</span>
            </h1>
            <p className="text-blue-100/80 text-lg leading-relaxed">
              One organised platform for students, staff, finance and performance — built for academic teams that move fast.
            </p>
            
            <ul className="space-y-5 pt-2">
              {features.map((f) => (
                <li key={f.title} className="flex items-start gap-4 transition-all duration-300 hover:translate-x-1 group">
                  <div className="h-9 w-9 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10 group-hover:bg-white/20 group-hover:border-white/30 transition-all shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-blue-300" />
                  </div>
                  <div>
                    <p className="font-semibold text-white text-base">{f.title}</p>
                    <p className="text-sm text-blue-100/60 mt-0.5">{f.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between pt-8 border-t border-white/10">
            <p className="text-xs text-white/50">© {new Date().getFullYear()} Sandstone School. All rights reserved.</p>
            <div className="flex gap-2">
              {backgroundImages.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    index === currentImageIndex ? "w-8 bg-blue-300" : "w-1.5 bg-white/30 hover:bg-white/50"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel (Login Form) ── */}
      <div className="flex items-center justify-center p-6 sm:p-12 relative z-10">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center justify-center mb-8 gap-3">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <GraduationCap className="h-9 w-9" />
            </div>
            <div className="text-center">
              <p className="font-bold text-xl text-foreground">Sandstone School</p>
              <p className="text-xs text-muted-foreground">Management System</p>
            </div>
          </div>

          {/* ✅ UPDATED: Professional greeting with subtle animation (no emojis) */}
          <div className="text-center mb-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-2">
              <Sparkles className="h-3 w-3" />
              Secure Portal
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground animate-in fade-in slide-in-from-top-2 duration-500">
              <span className="inline-block animate-bounce-slow">{greeting}</span>.
            </h2>
            <p className="text-muted-foreground text-lg max-w-xs mx-auto leading-relaxed">
              Ready to manage Sandstone School today? Sign in with your assigned credentials.
            </p>
          </div>

          {/* Premium frosted-glass form card */}
          <div className="rounded-3xl border border-blue-100 dark:border-blue-900/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl shadow-2xl shadow-blue-900/5 dark:shadow-black/20 p-8 space-y-6 transition-all duration-300 hover:shadow-blue-900/10 dark:hover:shadow-black/30">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium ml-1">Username</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-base"
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors font-medium">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 rounded-xl bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-base pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 text-white font-semibold tracking-wide shadow-md shadow-blue-900/10 hover:shadow-blue-900/20 active:scale-[0.98] transition-all duration-200 mt-2 text-base"
                disabled={loading}
              >
                {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                {loading ? "Authenticating..." : "ACCESS SYSTEM"}
              </Button>
            </form>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-center text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1.5">
                Secured and optimized by <span className="font-semibold text-slate-700 dark:text-slate-300">@kk Dev Tech Solutions</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}