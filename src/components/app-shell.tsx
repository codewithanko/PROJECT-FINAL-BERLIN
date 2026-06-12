import { type ReactNode, useEffect, useState, useRef } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutGrid, Users, UserPlus, Wallet, BarChart3, FileText,
  ClipboardEdit, CalendarCheck, GraduationCap, Settings,
  UserCog, LogOut, Bell, Search, Moon, Sun, ChevronLeft, ChevronRight, Sparkles,
  Loader2, User, // Added User icon for search results
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

const mainItems = [
  { label: "Dashboard", icon: LayoutGrid, to: "/dashboard" },
  { label: "Students", icon: Users, to: "/students" },
  { label: "Admissions", icon: UserPlus, to: "/admissions" },
  { label: "Payments & Finance", icon: Wallet, to: "/payments" },
  { label: "Accounts", icon: BarChart3, to: "/accounts" },
  { label: "Reports", icon: FileText, to: "/reports" },
  { label: "Marks Assessment", icon: ClipboardEdit, to: "/marks" },
  { label: "Attendance", icon: CalendarCheck, to: "/attendance" },
  { label: "Graduates", icon: GraduationCap, to: "/graduates" },
  { label: "AI Assistant", icon: Sparkles, to: "/assistant" },
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

  // Debounced Supabase Search (waits 300ms after typing stops)
  useEffect(() => {
    const timeout = setTimeout(async () => {
      const q = searchQuery.trim();
      if (q.length < 2) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }
      setIsSearching(true);
      setShowDropdown(true);
      
      // Fetch matching students from Supabase
      const { data: students } = await supabase
        .from("students")
        .select("id, name, reg_no, course, level")
        .or(`name.ilike.%${q}%,reg_no.ilike.%${q}%`)
        .limit(5);
      
      setSearchResults(students || []);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  // Close dropdown when clicking outside the search bar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle clicking a student in the dropdown
  const handleSearchSelect = (student: any) => {
    setShowDropdown(false);
    setSearchQuery("");
    // Navigate to students page and pass the name in the URL (?search=Name)
    navigate({ to: "/students", search: { search: student.name } });
  };

  // Force password change on first login
  useEffect(() => {
    if (roleInfo?.mustChangePassword && pathname !== "/change-password") {
      navigate({ to: "/change-password", replace: true });
    }
  }, [roleInfo?.mustChangePassword, pathname, navigate]);

  // Redirect away from forbidden routes
  useEffect(() => {
    if (roleLoading || !roleInfo || roleInfo.mustChangePassword) return;
    if (!canAccess(role, pathname)) {
      navigate({ to: getFirstAllowedRoute(role), replace: true });
    }
  }, [role, pathname, roleLoading, roleInfo, navigate]);

  const visibleMain = mainItems.filter((i) => canAccess(role, i.to));
  const visibleAdmin = adminItems.filter((i) => canAccess(role, i.to));

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  const handleLogout = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
          collapsed ? "w-20" : "w-64",
        )}
      >
        <div className="flex items-center gap-3 px-4 h-20 border-b border-white/5">
          <div className={cn(
            "shrink-0 rounded-xl bg-white/15 flex items-center justify-center font-bold text-sidebar-foreground tracking-tight transition-all",
            collapsed ? "h-10 w-10 text-sm" : "h-12 w-12 text-base",
          )}>SS</div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-semibold leading-tight text-sm truncate">Sandstone School</p>
              <p className="text-xs text-sidebar-muted leading-tight truncate">of Languages & Computer Studies</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleMain.map((item) => (
            <NavItem key={item.to} {...item} active={pathname === item.to} collapsed={collapsed} />
          ))}
          {visibleAdmin.length > 0 && (
            <div className="pt-6 pb-2">
              {!collapsed && <p className="px-3 text-[10px] tracking-[0.2em] text-sidebar-muted font-medium">ADMIN</p>}
            </div>
          )}
          {visibleAdmin.map((item) => (
            <NavItem key={item.to} {...item} active={pathname === item.to} collapsed={collapsed} />
          ))}
        </nav>

        <div className="p-3 border-t border-white/5">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground transition-all duration-300 hover:bg-white/10 hover:translate-x-1">
            <LogOut className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </div>

        <button onClick={() => setCollapsed((c) => !c)} className="absolute -right-3 top-24 h-7 w-7 rounded-full bg-card border shadow flex items-center justify-center text-foreground transition-all hover:scale-110" aria-label="Toggle sidebar">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </aside>

      {/* Main */}
      <div className={cn("flex-1 flex flex-col transition-all duration-300", collapsed ? "ml-20" : "ml-64")}>
        <header className="sticky top-0 z-20 h-16 bg-card/80 backdrop-blur border-b flex items-center gap-4 px-6">
          
          {/* ── SMART GLOBAL SEARCH ── */}
          <div className="relative flex-1 max-w-xl" ref={searchRef}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = searchQuery.trim();
                if (!q) return;
                // If exactly 1 result, go straight to it. Otherwise, go to Students page with the query.
                if (searchResults.length === 1) {
                  handleSearchSelect(searchResults[0]);
                } else {
                  navigate({ to: "/students", search: { search: q } });
                  setSearchQuery("");
                  setShowDropdown(false);
                }
              }}
              className="relative"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                placeholder="Search students by name or reg no..."
                className="w-full h-10 pl-10 pr-10 rounded-lg bg-muted border border-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:bg-card focus:border-input transition-all"
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </form>

            {/* Live Search Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-12 left-0 right-0 bg-card border rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="p-2 border-b bg-muted/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Students</p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {searchResults.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSearchSelect(s)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.reg_no} • {s.course} • {s.level}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* No Results Message */}
            {showDropdown && !isSearching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
              <div className="absolute top-12 left-0 right-0 bg-card border rounded-lg shadow-lg z-50 p-4 text-center">
                <p className="text-sm text-muted-foreground">No students found for "{searchQuery}"</p>
              </div>
            )}
          </div>

          <button onClick={toggleDark} className="h-10 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all" aria-label="Theme">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative h-10 w-10 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-all" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">1</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="flex flex-col items-start gap-0.5">
                <span className="text-sm font-medium">Welcome to Sandstone</span>
                <span className="text-xs text-muted-foreground">Your dashboard is ready.</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 pl-2 pr-3 h-10 rounded-lg hover:bg-muted transition-all">
                <div className="h-8 w-8 rounded-full bg-sidebar text-sidebar-foreground flex items-center justify-center">
                  <span className="text-sm font-semibold">{role ? role[0].toUpperCase() : "?"}</span>
                </div>
                <span className="text-sm font-medium hidden sm:block">{role ? ROLE_LABELS[role] : "—"}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
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

function NavItem({ to, label, icon: Icon, active, collapsed }: { to: string; label: string; icon: any; active: boolean; collapsed: boolean }) {
  return (
    <Link to={to} className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-300",
      active ? "bg-sidebar-active text-sidebar-foreground shadow-lg" : "text-sidebar-foreground/80 hover:bg-white/10 hover:text-sidebar-foreground hover:translate-x-1",
    )}>
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}