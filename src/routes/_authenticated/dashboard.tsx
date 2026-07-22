import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users, UserCheck, GraduationCap, DollarSign,
  CreditCard, TrendingUp, AlertTriangle, BookOpen,
  ArrowUp, ArrowDown, Loader2, CalendarDays, ChevronRight,
  Pencil, Trash2
} from "lucide-react";
import {
  PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatUGX } from "@/lib/courses";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Sandstone School" }] }),
  component: Dashboard,
});

type Stat = {
  title: string;
  value: string;
  icon: any;
  trend: { dir: "up" | "down"; value: string; label: string };
  tint: string;
  link: string;
};

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  is_holiday: boolean;
  color: string;
};

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stat[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [courseDistribution, setCourseDistribution] = useState<any[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const COLORS = [
    "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
    "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
  ];

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      
      const { data: students } = await supabase.from("students").select("id, status, course, balance");
      
      const totalStudents = students?.length ?? 0;
      
      const activeStudents = students?.filter(s => s.status === "active" || s.status === "promoted").length ?? 0;
      const graduated = students?.filter(s => s.status === "graduated").length ?? 0;
      
      const feeBalances = students
        ?.filter(s => s.status === "active" || s.status === "promoted")
        .reduce((sum, s) => sum + (Number(s.balance) || 0), 0) ?? 0;
        
      const activeCourses = new Set(
        students?.filter(s => s.status === "active" || s.status === "promoted").map(s => s.course)
      ).size;

      const courseCounts = students
        ?.filter(s => s.status === "active" || s.status === "promoted")
        .reduce((acc: Record<string, number>, s) => {
          const course = s.course || "Unknown";
          acc[course] = (acc[course] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) ?? {};
      
      const distributionData = Object.entries(courseCounts).map(([name, value]) => ({ name, value }));
      setCourseDistribution(distributionData);

      const { data: transactions } = await supabase.from("transactions").select("type, amount, date");
      
      let totalIncome = 0;
      let totalExpenses = 0;
      let thisMonthIncome = 0;
      let lastMonthIncome = 0;
      let thisMonthExpenses = 0;
      let lastMonthExpenses = 0;

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const revenueData = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const monthName = d.toLocaleString('default', { month: 'short' });
        let income = 0;
        let expense = 0;
        
        transactions?.forEach(t => {
          const tDate = new Date(t.date);
          if (tDate.getFullYear() === d.getFullYear() && tDate.getMonth() === d.getMonth()) {
            const amt = Number(t.amount) || 0;
            if (t.type === "income") income += amt;
            else if (t.type === "expense") expense += amt;
          }
        });
        
        return { name: monthName, Income: income, Expenses: expense };
      });
      setMonthlyRevenue(revenueData);

      transactions?.forEach(t => {
        const amt = Number(t.amount) || 0;
        const tDate = new Date(t.date);
        
        if (t.type === "income") {
          totalIncome += amt;
          if (tDate >= thisMonthStart) thisMonthIncome += amt;
          else if (tDate >= lastMonthStart && tDate <= lastMonthEnd) lastMonthIncome += amt;
        } else if (t.type === "expense") {
          totalExpenses += amt;
          if (tDate >= thisMonthStart) thisMonthExpenses += amt;
          else if (tDate >= lastMonthStart && tDate <= lastMonthEnd) lastMonthExpenses += amt;
        }
      });

      const netProfit = totalIncome - totalExpenses;

      const calcTrend = (current: number, previous: number) => {
        if (previous === 0) return { dir: "up" as const, value: current > 0 ? "100%" : "0%", label: "vs last month" };
        const change = ((current - previous) / previous) * 100;
        return {
          dir: change >= 0 ? "up" as const : "down" as const,
          value: `${Math.abs(change).toFixed(1)}%`,
          label: "vs last month"
        };
      };

      const incomeTrend = calcTrend(thisMonthIncome, lastMonthIncome);
      const expenseTrend = calcTrend(thisMonthExpenses, lastMonthExpenses);

      const todayStr = now.toISOString().split("T")[0];
      const { data: eventsData } = await supabase
        .from("events")
        .select("*")
        .gte("event_date", todayStr)
        .order("event_date", { ascending: true })
        .limit(3);
      setEvents(eventsData || []);

      const newStats: Stat[] = [
        { title: "Total Students", value: totalStudents.toString(), icon: Users, trend: { dir: "up", value: `${activeStudents}`, label: "active now" }, tint: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400", link: "/students" },
        { title: "Active Students", value: activeStudents.toString(), icon: UserCheck, trend: { dir: "up", value: `${totalStudents > 0 ? ((activeStudents/totalStudents)*100).toFixed(0) : 0}%`, label: "of total" }, tint: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400", link: "/students" },
        { title: "Graduated", value: graduated.toString(), icon: GraduationCap, trend: { dir: "up", value: "Alumni", label: "completed" }, tint: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400", link: "/students" },
        { title: "Total Income", value: formatUGX(totalIncome), icon: DollarSign, trend: incomeTrend, tint: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400", link: "/accounts" },
        { title: "Total Expenses", value: formatUGX(totalExpenses), icon: CreditCard, trend: expenseTrend, tint: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400", link: "/accounts" },
        { title: "Net Profit", value: formatUGX(netProfit), icon: TrendingUp, trend: { dir: netProfit >= 0 ? "up" : "down", value: netProfit >= 0 ? "Profit" : "Loss", label: "all time" }, tint: netProfit >= 0 ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400" : "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400", link: "/accounts" },
        { title: "Fee Balances", value: formatUGX(feeBalances), icon: AlertTriangle, trend: { dir: "down", value: "Outstanding", label: "unpaid fees" }, tint: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400", link: "/payments" },
        { title: "Courses Active", value: activeCourses.toString(), icon: BookOpen, trend: { dir: "up", value: "Programs", label: "running" }, tint: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400", link: "/students" },
      ];

      setStats(newStats);
      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  const handleEditClick = (event: EventItem) => {
    setEditingEvent(event.id);
    setEditTitle(event.title);
    setEditDescription(event.description || "");
  };

  const handleSaveEdit = async (eventId: string) => {
    if (!editTitle.trim()) {
      toast.error("Event title is required");
      return;
    }

    const { error } = await supabase
      .from("events")
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
      })
      .eq("id", eventId);

    if (error) {
      toast.error("Failed to update event");
      return;
    }

    toast.success("Event updated successfully");
    setEditingEvent(null);
    
    const { data: eventsData } = await supabase
      .from("events")
      .select("*")
      .gte("event_date", new Date().toISOString().split("T")[0])
      .order("event_date", { ascending: true })
      .limit(3);
    setEvents(eventsData || []);
  };

  const handleCancelEdit = () => {
    setEditingEvent(null);
    setEditTitle("");
    setEditDescription("");
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;

    const { error } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId);

    if (error) {
      toast.error("Failed to delete event");
      return;
    }

    toast.success("Event deleted successfully");
    
    const { data: eventsData } = await supabase
      .from("events")
      .select("*")
      .gte("event_date", new Date().toISOString().split("T")[0])
      .order("event_date", { ascending: true })
      .limit(3);
    setEvents(eventsData || []);
  };

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3 space-y-2">
          <p className="font-semibold text-sm text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-xs">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}:</span>
              <span className="font-semibold">{formatUGX(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold text-sm text-foreground">{payload[0].name}</p>
          <p className="text-xs text-muted-foreground">Students: <span className="font-semibold text-primary">{payload[0].value}</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-5">
        <div className="h-16 w-16 shrink-0 rounded-2xl bg-primary/10 flex items-center justify-center text-primary drop-shadow-sm">
          <GraduationCap className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back to Sandstone School Management</p>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <div className="col-span-full flex items-center justify-center py-10 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading live dashboard data...
          </div>
        ) : (
          stats.map((s) => (
            <StatCard 
              key={s.title} 
              stat={s} 
              onClick={() => navigate({ to: s.link as any })} 
            />
          ))
        )}
      </div>

      {/* Upcoming Events & Reminders Widget */}
      <div className="rounded-2xl bg-card border p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-accent">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Upcoming Events & Reminders
          </h3>
          <button onClick={() => navigate({ to: "/calendar" })} className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
            View Full Calendar <ChevronRight className="h-3 w-3" />
          </button>
        </div>
        <div className="space-y-3">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No upcoming events scheduled.</p>
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="flex items-start gap-3 p-3 rounded-lg bg-background border border-border/50 shadow-sm">
                <div className={`h-10 w-10 rounded-lg flex flex-col items-center justify-center shrink-0 ${ev.is_holiday ? "bg-red-100 text-red-600 dark:bg-red-900/30" : "bg-blue-100 text-blue-600 dark:bg-blue-900/30"}`}>
                  <span className="text-[10px] font-bold uppercase leading-none">
                    {new Date(ev.event_date).toLocaleString('default', { month: 'short' })}
                  </span>
                  <span className="text-lg font-bold leading-none mt-0.5">
                    {new Date(ev.event_date).getDate()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  {editingEvent === ev.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full text-sm font-semibold px-2 py-1 border rounded"
                        placeholder="Event title"
                        autoFocus
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full text-xs px-2 py-1 border rounded"
                        rows={2}
                        placeholder="Description (optional)"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleSaveEdit(ev.id)} className="h-6 text-xs">
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelEdit} className="h-6 text-xs">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{ev.title}</p>
                        {ev.is_holiday && <span className="bg-destructive/10 text-destructive text-[10px] px-1.5 py-0.5 rounded-full font-bold">Holiday</span>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{ev.description || "No description provided."}</p>
                    </>
                  )}
                </div>
                {editingEvent !== ev.id && (
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                      onClick={() => handleEditClick(ev)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteEvent(ev.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Live Charts */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Revenue Overview */}
        <div className="rounded-2xl bg-card border p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-accent">
          <div className="mb-6">
            <h2 className="font-bold text-xl flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Financial Performance
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Income vs expenses over the last 6 months</p>
          </div>
          <div className="h-80">
            {loading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyRevenue} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    className="text-xs" 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    dy={10}
                  />
                  <YAxis 
                    className="text-xs" 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                    dx={-10}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="round"
                    iconSize={10}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Income" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorIncome)" 
                    name="Income"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="Expenses" 
                    stroke="#ef4444" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorExpenses)" 
                    name="Expenses"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Course Distribution */}
        <div className="rounded-2xl bg-card border p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-accent">
          <div className="mb-6">
            <h2 className="font-bold text-xl flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Student Enrollment Distribution
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Active students by programme</p>
          </div>
          <div className="h-80">
            {loading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : courseDistribution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No active students to display
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={courseDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={110}
                    innerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {courseDistribution.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]}
                        stroke="hsl(var(--card))"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend 
                    layout="vertical" 
                    align="right" 
                    verticalAlign="middle"
                    wrapperStyle={{ paddingLeft: '20px' }}
                    iconType="circle"
                    iconSize={10}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ✅ Stat Card Component — WITH SUPER POWERFUL HOVER EFFECTS
function StatCard({ stat, onClick }: { stat: Stat; onClick: () => void }) {
  const Icon = stat.icon;
  const TrendIcon = stat.trend.dir === "up" ? ArrowUp : ArrowDown;
  return (
    <div 
      onClick={onClick}
      className="group rounded-2xl bg-card border-2 border-transparent p-6 cursor-pointer transition-all duration-500 ease-out hover:shadow-2xl hover:-translate-y-2 hover:bg-primary/5 hover:border-primary hover:scale-[1.02] active:scale-[0.98]"
    >
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
        <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center transition-all duration-500 ease-out group-hover:scale-125 group-hover:rotate-6 group-hover:shadow-lg", stat.tint)}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight">{stat.value}</p>
      <div className="mt-4 flex items-center gap-1.5 text-xs">
        <span className={cn("inline-flex items-center gap-0.5 font-semibold transition-colors duration-300 group-hover:text-primary", stat.trend.dir === "up" ? "text-emerald-600" : "text-rose-600")}>
          <TrendIcon className="h-3 w-3" />
          {stat.trend.value}
        </span>
        <span className="text-muted-foreground">{stat.trend.label}</span>
      </div>
    </div>
  );
}