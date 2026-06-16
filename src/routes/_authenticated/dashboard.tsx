import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Users, UserCheck, GraduationCap, DollarSign,
  CreditCard, TrendingUp, AlertTriangle, BookOpen,
  ArrowUp, ArrowDown, Loader2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from "recharts";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { formatUGX } from "@/lib/courses";

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

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stat[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [courseDistribution, setCourseDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ── FIXED: Explicit Hex Colors for SVG Charts (Guarantees they render correctly) ──
  const COLORS = [
    "#3b82f6", // Blue
    "#10b981", // Emerald Green
    "#f59e0b", // Amber
    "#ef4444", // Red
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#f97316", // Orange
  ];

  // ── Fetch Live Data from Supabase ──────────────────────────────────────────
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      
      // 1. Fetch Students Data
      const { data: students } = await supabase.from("students").select("id, status, course, balance");
      const totalStudents = students?.length ?? 0;
      const activeStudents = students?.filter(s => s.status === "active").length ?? 0;
      const graduated = students?.filter(s => s.status === "graduated").length ?? 0;
      const feeBalances = students?.reduce((sum, s) => sum + (Number(s.balance) || 0), 0) ?? 0;
      const activeCourses = new Set(students?.filter(s => s.status === "active").map(s => s.course)).size;

      // Calculate Course Distribution for Pie Chart
      const courseCounts = students?.filter(s => s.status === "active").reduce((acc: Record<string, number>, s) => {
        const course = s.course || "Unknown";
        acc[course] = (acc[course] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) ?? {};
      
      const distributionData = Object.entries(courseCounts).map(([name, value]) => ({ name, value }));
      setCourseDistribution(distributionData);

      // 2. Fetch Transactions Data
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

      // Calculate Monthly Revenue for Bar Chart (Last 6 Months)
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

      // Calculate Totals and Trends
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

      // 3. Map Data to UI Stats
      const newStats: Stat[] = [
        { title: "Total Students", value: totalStudents.toString(), icon: Users, trend: { dir: "up", value: `${activeStudents}`, label: "active now" }, tint: "bg-info/10 text-info", link: "/students" },
        { title: "Active Students", value: activeStudents.toString(), icon: UserCheck, trend: { dir: "up", value: `${totalStudents > 0 ? ((activeStudents/totalStudents)*100).toFixed(0) : 0}%`, label: "of total" }, tint: "bg-success/10 text-success", link: "/students" },
        { title: "Graduated", value: graduated.toString(), icon: GraduationCap, trend: { dir: "up", value: "Alumni", label: "completed" }, tint: "bg-accent text-primary", link: "/graduates" },
        { title: "Total Income", value: formatUGX(totalIncome), icon: DollarSign, trend: incomeTrend, tint: "bg-success/10 text-success", link: "/accounts" },
        { title: "Total Expenses", value: formatUGX(totalExpenses), icon: CreditCard, trend: expenseTrend, tint: "bg-destructive/10 text-destructive", link: "/accounts" },
        { title: "Net Profit", value: formatUGX(netProfit), icon: TrendingUp, trend: { dir: netProfit >= 0 ? "up" : "down", value: netProfit >= 0 ? "Profit" : "Loss", label: "all time" }, tint: netProfit >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive", link: "/accounts" },
        { title: "Fee Balances", value: formatUGX(feeBalances), icon: AlertTriangle, trend: { dir: "down", value: "Outstanding", label: "unpaid fees" }, tint: "bg-warning/15 text-warning-foreground", link: "/payments" },
        { title: "Courses Active", value: activeCourses.toString(), icon: BookOpen, trend: { dir: "up", value: "Programs", label: "running" }, tint: "bg-accent text-primary", link: "/students" },
      ];

      setStats(newStats);
      setLoading(false);
    };

    fetchDashboardData();
  }, []);

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

      {/* ── Stats Grid ── */}
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

      {/* ── Live Charts ── */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Revenue Overview Bar Chart */}
        <div className="rounded-2xl bg-card border p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-accent">
          <h2 className="font-semibold text-lg">Revenue Overview</h2>
          <p className="text-sm text-muted-foreground mt-1">Income vs expenses over the last 6 months</p>
          <div className="mt-6 h-72">
            {loading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(value: number) => formatUGX(value)}
                  />
                  <Legend />
                  {/* FIXED: Using explicit Hex codes for SVG bars */}
                  <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Course Distribution Pie Chart */}
        <div className="rounded-2xl bg-card border p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-accent">
          <h2 className="font-semibold text-lg">Course Distribution</h2>
          <p className="text-sm text-muted-foreground mt-1">Active students by programme</p>
          <div className="mt-6 h-72">
            {loading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : courseDistribution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No active students to display</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={courseDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={90}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {/* FIXED: Mapping explicit Hex colors to every slice */}
                    {courseDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                    formatter={(value: number) => [`${value} students`, "Count"]} 
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Interactive Stat Card ────────────────────────────────────────────────────
function StatCard({ stat, onClick }: { stat: Stat; onClick: () => void }) {
  const Icon = stat.icon;
  const TrendIcon = stat.trend.dir === "up" ? ArrowUp : ArrowDown;
  return (
    <div 
      onClick={onClick}
      className="group stat-card-premium rounded-2xl bg-card border p-6 cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-accent"
    >
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground font-medium">{stat.title}</p>
        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110", stat.tint)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-2xl font-bold tracking-tight">{stat.value}</p>
      <div className="mt-4 flex items-center gap-1.5 text-xs">
        <span className={cn("inline-flex items-center gap-0.5 font-semibold", stat.trend.dir === "up" ? "text-success" : "text-destructive")}>
          <TrendIcon className="h-3 w-3" />
          {stat.trend.value}
        </span>
        <span className="text-muted-foreground">{stat.trend.label}</span>
      </div>
    </div>
  );
}