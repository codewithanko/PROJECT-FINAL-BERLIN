import { type ReactNode, useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid, Users, UserPlus, Wallet, BarChart3, FileText,
  ClipboardEdit, CalendarCheck, GraduationCap, Settings,
  UserCog, LogOut, Bell, Search, Moon, Sun, ChevronLeft, ChevronRight, Sparkles,
  Loader2, User, MessageSquare, Briefcase, Upload, CalendarDays, Plus, AlertTriangle, KeyRound, CheckCircle2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentRole } from "@/hooks/use-role";
import { canAccess, ROLE_LABELS, getFirstAllowedRoute } from "@/lib/roles";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const mainItems = [
  { label: "Dashboard", icon: LayoutGrid, to: "/dashboard" },
  { label: "Students", icon: Users, to: "/students" },
  { label: "Admissions", icon: UserPlus, to: "/admissions" },
  { label: "Payments & Finance", icon: Wallet, to: "/payments" },
  { label: "Accounts", icon: BarChart3, to: "/accounts" },
  { label: "Communications", icon: MessageSquare, to: "/communications" },
  { label: "Staff Management", icon: Briefcase, to: "/staff-management" },
  { label: "Reports", icon: FileText, to: "/reports" },
  { label: "Marks Assessment", icon: ClipboardEdit, to: "/marks" },
  { label: "Attendance", icon: CalendarCheck, to: "/attendance" },
  { label: "Calendar", icon: CalendarDays, to: "/calendar" },
  { label: "Graduates", icon: GraduationCap, to: "/graduates" },
  { label: "AI Assistant", icon: Sparkles, to: "/assistant" },
  { label: "Import Students", icon: Upload, to: "/import-students" },
  { label: "Import Accounts", icon: Upload, to: "/import-accounts" },
] as const;

const adminItems = [
  { label: "Staff Accounts", icon: UserCog, to: "/staff" },
  { label: "Settings", icon: Settings, to: "/settings" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: roleInfo, isLoading: roleLoading } = useCurrentRole();
  const role = roleInfo?.role ?? null;

  // ── GLOBAL SEARCH STATES ──────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── REAL NOTIFICATIONS STATES ─────────────────────────────────────────────
  const [notifCount, setNotifCount] = useState(0);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      const q = searchQuery.trim();
      if (q.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
      setIsSearching(true);
      setShowDropdown(true);
      const { data: students } = await supabase.from("students").select("id, name, reg_no, course, level, balance").or(`name.ilike.%${q}%,reg_no.ilike.%${q}%`).limit(6);
      setSearchResults(students || []);
      setIsSearching(false);
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSelect = (student: any) => {
    setShowDropdown(false); setSearchQuery("");
    navigate({ to: "/students", search: { search: student.name } });
  };

  // ── FETCH REAL NOTIFICATIONS ──────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    setLoadingNotifs(true);
    try {
      const { count: overdueCount } = await supabase
        .from("students")
        .select("*", { count: "exact", head: true })
        .gt("balance", 0)
        .in("status", ["active", "promoted"]);

      let resetCount = 0;
      try {
        const { count } = await supabase
          .from("password_reset_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");
        resetCount = count || 0;
      } catch (e) { /* Ignore if table doesn't exist yet */ }

      const total = (overdueCount || 0) + resetCount;
      setNotifCount(total);

      const alerts: any[] = [];
      if (resetCount > 0) {
        alerts.push({
          id: "reset-1",
          title: "Pending Password Resets",
          desc: `${resetCount} staff member(s) requested a password reset.`,
          icon: KeyRound,
          color: "text-amber-600",
          action: () => navigate({ to: "/dashboard" })
        });
      }
      if (overdueCount > 0) {
        alerts.push({
          id: "overdue-1",
          title: "Outstanding Student Fees",
          desc: `${overdueCount} active student(s) have unpaid balances.`,
          icon: AlertTriangle,
          color: "text-destructive",
          action: () => navigate({ to: "/payments" })
        });
      }
      if (alerts.length === 0) {
        alerts.push({
          id: "all-good",
          title: "All Systems Normal",
          desc: "No pending alerts or overdue accounts.",
          icon: CheckCircle2,
          color: "text-emerald-600",
          action: () => {}
        });
      }
      setRecentAlerts(alerts);
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    } finally {
      setLoadingNotifs(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (roleInfo?.mustChangePassword && pathname !== "/change-password") navigate({ to: "/change-password", replace: true });
  }, [roleInfo?.mustChangePassword, pathname, navigate]);

  useEffect(() => {
    if (roleLoading || !roleInfo || roleInfo.mustChangePassword) return;
    if (!canAccess(role, pathname)) navigate({ to: getFirstAllowedRoute(role), replace: true });
  }, [role, pathname, roleLoading, roleInfo, navigate]);

  const visibleMain = mainItems.filter((i) => canAccess(role, i.to));
  const visibleAdmin = adminItems.filter((i) => canAccess(role, i.to));

  const canAddStudent = canAccess(role, "/admissions");
  const canRecordPayment = canAccess(role, "/payments");
  const canLogExpense = canAccess(role, "/accounts");
  const hasQuickActions = canAddStudent || canRecordPayment || canLogExpense;

  const toggleDark = () => { const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); };

  const handleLogout = async () => {
    await queryClient.cancelQueries(); queryClient.clear();
    await supabase.auth.signOut(); navigate({ to: "/auth", replace: true });
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* ✅ REDESIGNED: Rounded, Premium Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-30 flex flex-col bg-gradient-to-b from-sidebar to-sidebar/95 text-sidebar-foreground transition-all duration-300 ease-in-out shadow-2xl",
        collapsed ? "w-20" : "w-64",
        "border-r border-white/5"
      )}>
        {/* Header with Logo */}
        <div className="flex items-center gap-3 px-4 h-20 border-b border-white/5">
          <div className={cn(
            "shrink-0 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-700/20 border border-blue-500/30 flex items-center justify-center overflow-hidden transition-all duration-300 shadow-lg shadow-blue-500/10",
            collapsed ? "h-10 w-10" : "h-12 w-12"
          )}>
            <img src="/images/logo.png" alt="Sandstone School Logo" className="w-full h-full object-cover" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden flex-1">
              <p className="font-semibold leading-tight text-sm truncate">Sandstone School</p>
              <p className="text-xs text-sidebar-muted leading-tight truncate">of Languages & Computer Studies</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
          {visibleMain.map((item) => (
            <NavItem key={item.to} {...item} active={pathname === item.to} collapsed={collapsed} />
          ))}
          
          {visibleAdmin.length > 0 && (
            <div className="pt-6 pb-2">
              {!collapsed && (
                <div className="px-3 mb-2">
                  <p className="text-[10px] tracking-[0.2em] text-sidebar-muted font-semibold uppercase">Admin</p>
                  <div className="h-px bg-gradient-to-r from-white/10 to-transparent mt-1" />
                </div>
              )}
            </div>
          )}
          
          {visibleAdmin.map((item) => (
            <NavItem key={item.to} {...item} active={pathname === item.to} collapsed={collapsed} />
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/5 space-y-2">
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-sidebar-foreground/80 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 group"
          >
            <LogOut className="h-5 w-5 shrink-0 group-hover:rotate-12 transition-transform" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

        {/* Collapse Toggle Button */}
        <button 
          onClick={() => setCollapsed((c) => !c)} 
          className="absolute -right-3 top-24 h-7 w-7 rounded-full bg-card border-2 border-sidebar shadow-lg flex items-center justify-center text-foreground transition-all hover:scale-110 hover:bg-primary hover:text-primary-foreground hover:border-primary" 
          aria-label="Toggle sidebar"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      <div className={cn("flex-1 flex flex-col transition-all duration-300", collapsed ? "ml-20" : "ml-64")}>
        {/* Top Bar */}
        <header className="sticky top-0 z-20 h-16 bg-card/80 backdrop-blur-xl border-b border-border/50 flex items-center gap-4 px-6">
          
          {/* Global Search */}
          <div className="relative flex-1 max-w-xl" ref={searchRef}>
            <form onSubmit={(e) => {
              e.preventDefault(); const q = searchQuery.trim(); if (!q) return;
              if (searchResults.length === 1) handleSearchSelect(searchResults[0]);
              else { navigate({ to: "/students", search: { search: q } }); setSearchQuery(""); setShowDropdown(false); }
            }} className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)} 
                placeholder="Search students by name or reg no..." 
                className="w-full h-10 pl-10 pr-10 rounded-xl bg-muted/50 border border-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:bg-card focus:border-input focus:ring-2 focus:ring-primary/20 transition-all" 
              />
              {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            </form>
            
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-12 left-0 right-0 bg-card border rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="p-2 border-b bg-muted/50 flex justify-between items-center">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Students</p>
                  {searchResults.length >= 6 && (
                    <button onClick={() => { navigate({ to: "/students", search: { search: searchQuery } }); setShowDropdown(false); }} className="text-xs text-primary hover:underline">View all</button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {searchResults.slice(0, 5).map((s) => (
                    <button key={s.id} onClick={() => handleSearchSelect(s)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0"><User className="h-4 w-4" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.reg_no} • {s.course} • {s.level}</p>
                      </div>
                      {s.balance > 0 && <Badge variant="destructive" className="text-[10px] h-5 px-1.5">Owes</Badge>}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {showDropdown && !isSearching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
              <div className="absolute top-12 left-0 right-0 bg-card border rounded-xl shadow-xl z-50 p-4 text-center"><p className="text-sm text-muted-foreground">No students found for "{searchQuery}"</p></div>
            )}
          </div>

          {/* Quick Actions */}
          {hasQuickActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm" aria-label="Quick Actions">
                  <Plus className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {canAddStudent && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/admissions" })}>
                    <UserPlus className="h-4 w-4 mr-2 text-blue-600" /> Add New Student
                  </DropdownMenuItem>
                )}
                {canRecordPayment && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/payments" })}>
                    <Wallet className="h-4 w-4 mr-2 text-emerald-600" /> Record Payment
                  </DropdownMenuItem>
                )}
                {canLogExpense && (
                  <DropdownMenuItem onClick={() => navigate({ to: "/accounts" })}>
                    <BarChart3 className="h-4 w-4 mr-2 text-purple-600" /> Log Expense
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Notifications */}
          <DropdownMenu onOpenChange={(open) => { if (open) fetchNotifications(); }}>
            <DropdownMenuTrigger asChild>
              <button className="relative h-10 w-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                {notifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center ring-2 ring-background">
                    {notifCount > 9 ? "9+" : notifCount}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 rounded-xl max-h-[400px] overflow-y-auto">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                {loadingNotifs && <Loader2 className="h-3 w-3 animate-spin" />}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {recentAlerts.map((alert) => {
                const Icon = alert.icon;
                return (
                  <DropdownMenuItem key={alert.id} onClick={alert.action} className="flex items-start gap-3 py-3 cursor-pointer">
                    <div className={cn("h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0", alert.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none mb-1">{alert.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{alert.desc}</p>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle */}
          <button onClick={toggleDark} className="h-10 w-10 rounded-xl flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all" aria-label="Theme">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          {/* Profile Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 pl-2 pr-3 h-10 rounded-xl hover:bg-muted transition-all border border-transparent hover:border-border">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center shadow-md">
                  <span className="text-sm font-semibold">{role ? role[0].toUpperCase() : "?"}</span>
                </div>
                <span className="text-sm font-medium hidden sm:block">{role ? ROLE_LABELS[role] : "Account"}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuLabel>{role ? ROLE_LABELS[role] : "Account"}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}><Settings className="h-4 w-4 mr-2" /> Settings</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/change-password" })}><UserCog className="h-4 w-4 mr-2" /> Change Password</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive"><LogOut className="h-4 w-4 mr-2" /> Log out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        
        <main className="flex-1 p-6 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

// ✅ Enhanced NavItem with rounded corners and smooth transitions
// ✅ UPDATED: Active text is now crisp white, with a subtle blue background glow
function NavItem({ to, label, icon: Icon, active, collapsed }: { to: string; label: string; icon: any; active: boolean; collapsed: boolean }) {
  return (
    <Link 
      to={to} 
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group",
        active 
          ? "bg-gradient-to-r from-blue-500/20 to-blue-600/10 text-white shadow-lg shadow-blue-500/10 border border-blue-500/20" 
          : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-sidebar-foreground hover:border-white/10 border border-transparent"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0 transition-transform", active ? "scale-110" : "group-hover:scale-105")} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}