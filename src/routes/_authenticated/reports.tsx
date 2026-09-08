import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { 
  Users, Wallet, Receipt, GraduationCap, Download, FileText, 
  Loader2, Briefcase, TrendingUp, TrendingDown, AlertCircle,
  BarChart as BarChartIcon, Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Sandstone School" }] }),
  component: ReportsPage,
});

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", 
  "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#64748b",
];

const COURSES: Record<string, { label: string }> = {
  english: { label: "English" }, 
  computer: { label: "Computer" },
  computer_english: { label: "Computer & English" }, 
  french: { label: "French" },
  kiswahili: { label: "Kiswahili" }, 
  german: { label: "German" },
  private_class: { label: "Private Class" },
  private_class_2: { label: "Private Class 2" },
};

const fmtUGX = (n: number) => `UGX ${Number(n).toLocaleString("en-UG")}`;
type ReportKey = "students" | "finance" | "academic" | "graduation" | "staff";

const actions: { key: ReportKey; label: string; icon: any; tint: string; desc: string }[] = [
  { key: "students", label: "Student Report", icon: Users, tint: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400", desc: "Enrolment, courses & balances" },
  { key: "finance", label: "Finance Report", icon: Wallet, tint: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400", desc: "Income, expenses & cashflow" },
  { key: "academic", label: "Academic Report", icon: Receipt, tint: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400", desc: "Attendance & performance" },
  { key: "graduation", label: "Graduation Report", icon: GraduationCap, tint: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400", desc: "Completion rates & alumni" },
  { key: "staff", label: "Staff & Payroll", icon: Briefcase, tint: "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400", desc: "Payroll, advances & net pay" },
];

function ReportsPage() {
  const [selected, setSelected] = useState<ReportKey>("students");
  const [exporting, setExporting] = useState(false);
  const [financeView, setFinanceView] = useState<"all" | "income" | "expense">("all");
  
  const [reportYear, setReportYear] = useState<string>("all");
  const [reportMonth, setReportMonth] = useState<string>("all");

  const [studentRows, setStudentRows] = useState<any[]>([]);
  const [topDebtors, setTopDebtors] = useState<any[]>([]);
  const [studentsByCourse, setStudentsByCourse] = useState<any[]>([]);
  const [financeMonthly, setFinanceMonthly] = useState<any[]>([]);
  const [financeRows, setFinanceRows] = useState<any[]>([]);
  const [expenseCategories, setExpenseCategories] = useState<any[]>([]);
  const [graduationRows, setGraduationRows] = useState<any[]>([]);
  const [staffPayroll, setStaffPayroll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const current = actions.find((a) => a.key === selected)!;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // 1. Fetch Students
      const { data: studentsData } = await supabase.from("students").select("*");
      if (studentsData) {
        // ✅ NEW: Filter out "archived" students for active operational reports
        const activeStudents = studentsData.filter(s => s.status !== "archived");

        const sRows = activeStudents.map(s => ({
          name: s.name || "N/A", 
          reg: s.reg_no || "N/A",
          course: COURSES[s.course]?.label || s.course || "Unknown",
          status: s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : "Unknown",
          balance: Number(s.balance) || 0,
        }));
        setStudentRows(sRows);

        // ✅ NEW: Top 5 Debtors now only checks active/promoted students
        const debtors = [...sRows]
          .filter(s => s.balance > 0)
          .sort((a, b) => b.balance - a.balance)
          .slice(0, 5);
        setTopDebtors(debtors);

        const courseCounts: Record<string, number> = {};
        activeStudents.forEach(s => {
          const label = COURSES[s.course]?.label || s.course || "Unknown";
          courseCounts[label] = (courseCounts[label] || 0) + 1;
        });
        setStudentsByCourse(Object.entries(courseCounts).map(([course, students]) => ({ course, students })));

        // Graduation logic remains accurate using the full dataset
        const graduatedCount = studentsData.filter(s => s.status === "graduated").length;
        const activeCount = activeStudents.filter(s => s.status === "active" || s.status === "promoted").length;
        setGraduationRows([{ year: "Current", intake: activeCount + graduatedCount, graduated: graduatedCount }]);
      }

      // 2. Fetch Transactions for Finance
      const { data: transData } = await supabase.from("transactions").select("*").order("date", { ascending: false });
      if (transData) {
        processFinanceData(transData);
      }

      // 3. Fetch Staff Payroll
      try {
        const { data: payrollData } = await supabase.from("staff_payroll_payments").select(`
          id, period_label, base_amount, advance_deduction, net_pay, paid,
          staff_members ( full_name, role )
        `);
        if (payrollData) {
          setStaffPayroll(payrollData.map((p: any) => ({
            name: p.staff_members?.full_name || "Unknown",
            role: p.staff_members?.role || "Staff",
            period: p.period_label,
            base: Number(p.base_amount),
            advance: Number(p.advance_deduction),
            net: Number(p.net_pay),
            paid: p.paid
          })));
        }
      } catch (e) {
        console.log("Payroll table not found or not ready yet.");
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  const processFinanceData = (transData: any[]) => {
    const monthly: Record<string, { income: number; expenses: number }> = {};
    const categories: Record<string, number> = {};

    transData.forEach(t => {
      const date = new Date(t.date);
      const tYear = String(date.getFullYear());
      const tMonth = String(date.getMonth() + 1).padStart(2, "0");
      const monthKey = date.toLocaleString("default", { month: "short" });

      if (reportYear !== "all" && tYear !== reportYear) return;
      if (reportMonth !== "all" && tMonth !== reportMonth) return;

      if (!monthly[monthKey]) monthly[monthKey] = { income: 0, expenses: 0 };
      
      const amt = Number(t.amount);
      if (t.type === "income") {
        monthly[monthKey].income += amt;
      } else if (t.type === "expense") {
        monthly[monthKey].expenses += amt;
        const cat = t.description?.split("|")[0]?.trim() || "Uncategorized";
        categories[cat] = (categories[cat] || 0) + amt;
      }
    });
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const fMonthly = months.map(m => ({ month: m, income: monthly[m]?.income || 0, expenses: monthly[m]?.expenses || 0 })).filter(m => m.income > 0 || m.expenses > 0);
    
    setFinanceMonthly(fMonthly);
    setFinanceRows(fMonthly.map(m => ({ ...m, net: m.income - m.expenses })));
    setExpenseCategories(Object.entries(categories).map(([name, value]) => ({ name, value })));
  };

  useEffect(() => {
    const reFetch = async () => {
      const { data: transData } = await supabase.from("transactions").select("*");
      if (transData) processFinanceData(transData);
    };
    reFetch();
  }, [reportYear, reportMonth]);

  async function exportDocx() {
    setExporting(true);
    try {
      const { head, rows } = getTableData(selected, studentRows, financeRows, [], graduationRows, staffPayroll);
      let tableHtml = `<table border="1" style="border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; font-size: 12px;">`;
      tableHtml += `<tr style="background-color: #0f172a; color: white;">${head.map(h => `<th style="padding: 10px; text-align: left;">${h}</th>`).join('')}</tr>`;
      rows.forEach((row: any) => {
        tableHtml += `<tr>${row.map((cell: any) => `<td style="padding: 10px; border: 1px solid #e2e8f0;">${cell}</td>`).join('')}</tr>`;
      });
      tableHtml += `</table>`;

      const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Export HTML to Word Document</title></head><body>${tableHtml}</body></html>`;
      const blob = new Blob([html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Sandstone_${current.label.replace(/\s/g, '_')}_${new Date().toISOString().slice(0,10)}.doc`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Document exported successfully!");
    } catch (e: any) {
      toast.error("Failed to export document: " + e.message);
    } finally {
      setExporting(false);
    }
  }

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    const currentY = new Date().getFullYear();
    for (let i = currentY; i >= currentY - 3; i--) years.add(String(i));
    return Array.from(years);
  }, []);

  const availableMonths = [
    { value: "01", label: "January" }, { value: "02", label: "February" },
    { value: "03", label: "March" }, { value: "04", label: "April" },
    { value: "05", label: "May" }, { value: "06", label: "June" },
    { value: "07", label: "July" }, { value: "08", label: "August" },
    { value: "09", label: "September" }, { value: "10", label: "October" },
    { value: "11", label: "November" }, { value: "12", label: "December" },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Generate, visualise and export comprehensive school reports</p>
        </div>
        <Button onClick={exportDocx} disabled={exporting} className="bg-primary text-primary-foreground hover:bg-primary/90">
          {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Export .doc
        </Button>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {actions.map((a) => {
          const Icon = a.icon;
          const active = a.key === selected;
          return (
            <button key={a.key} onClick={() => setSelected(a.key)} className={cn(
              "rounded-2xl border bg-card p-5 text-left transition-all duration-300 hover:shadow-md",
              active && "border-primary ring-2 ring-primary/30 shadow-lg",
            )}>
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center mb-3", a.tint)}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="font-semibold text-sm">{a.label}</p>
              <p className="text-xs text-muted-foreground mt-1">{a.desc}</p>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" /> Loading report data from Supabase...
        </div>
      ) : (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="p-5 border-b flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-lg">{current.label} — Visual Summary</h2>
            </div>
            
            {selected === "finance" && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={reportYear} onValueChange={setReportYear}>
                  <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={reportMonth} onValueChange={setReportMonth}>
                  <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {availableMonths.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          
          <div className="p-5">
            <ReportChart 
              kind={selected} 
              studentsByCourse={studentsByCourse} 
              financeMonthly={financeMonthly} 
              expenseCategories={expenseCategories} 
              graduationRows={graduationRows} 
              staffPayroll={staffPayroll}
              financeView={financeView}
              setFinanceView={setFinanceView}
              topDebtors={topDebtors}
            />
          </div>
          
          <div className="border-t">
            <ReportTable kind={selected} studentRows={studentRows} financeRows={financeRows} academicRows={[]} graduationRows={graduationRows} staffPayroll={staffPayroll} />
          </div>
        </div>
      )}
    </div>
  );
}

function ReportChart({ kind, studentsByCourse, financeMonthly, expenseCategories, graduationRows, staffPayroll, financeView, setFinanceView, topDebtors }: any) {
  if (kind === "finance") {
    return (
      <div className="space-y-6">
        <div className="flex gap-2 p-1 bg-muted/30 rounded-lg w-fit">
          <Button variant={financeView === "all" ? "default" : "ghost"} size="sm" onClick={() => setFinanceView("all")}>
            <BarChartIcon className="h-4 w-4 mr-2" /> Full Finance
          </Button>
          <Button variant={financeView === "income" ? "default" : "ghost"} size="sm" className={financeView === "income" ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""} onClick={() => setFinanceView("income")}>
            <TrendingUp className="h-4 w-4 mr-2" /> Income Only
          </Button>
          <Button variant={financeView === "expense" ? "default" : "ghost"} size="sm" className={financeView === "expense" ? "bg-rose-600 text-white hover:bg-rose-700" : ""} onClick={() => setFinanceView("expense")}>
            <TrendingDown className="h-4 w-4 mr-2" /> Expenses Only
          </Button>
        </div>

        <div className="h-80">
          {financeMonthly.length > 0 ? (
            <ResponsiveContainer>
              <BarChart data={financeMonthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`} />
                <Tooltip formatter={(v: number) => fmtUGX(v)} />
                <Legend />
                {(financeView === "all" || financeView === "income") && (
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[6, 6, 0, 0]} />
                )}
                {(financeView === "all" || financeView === "expense") && (
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[6, 6, 0, 0]} />
                )}
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-full flex items-center justify-center text-muted-foreground">No finance data for this period</div>}
        </div>

        {(financeView === "all" || financeView === "expense") && expenseCategories.length > 0 && (
          <div className="h-64">
            <p className="text-sm font-medium mb-2 text-muted-foreground">Expense Breakdown by Category</p>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={expenseCategories} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {expenseCategories.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmtUGX(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    );
  }

  if (kind === "students") {
    return (
      <div className="space-y-6">
        {topDebtors.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400">Top 5 Outstanding Balances</h3>
            </div>
            <div className="space-y-2">
              {topDebtors.map((s: any, i: number) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <span className="font-medium">{s.name} <span className="text-muted-foreground text-xs">({s.reg})</span></span>
                  <span className="font-bold text-destructive">{fmtUGX(s.balance)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-80">
          <p className="text-sm font-medium mb-2">Enrolment by Course</p>
          {studentsByCourse.length > 0 ? (
            <ResponsiveContainer>
              <BarChart data={studentsByCourse}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="course" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="students" name="Students" radius={[6, 6, 0, 0]}>
                  {studentsByCourse.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-full flex items-center justify-center text-muted-foreground">No student data yet</div>}
        </div>
      </div>
    );
  }

  if (kind === "staff") {
    return (
      <div className="h-80">
        <p className="text-sm font-medium mb-2">Payroll Distribution (Net Pay)</p>
        {staffPayroll.length > 0 ? (
          <ResponsiveContainer>
            <BarChart data={staffPayroll}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(1)}M`} />
              <Tooltip formatter={(v: number) => fmtUGX(v)} />
              <Bar dataKey="net" name="Net Pay" radius={[6, 6, 0, 0]}>
                {staffPayroll.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="h-full flex items-center justify-center text-muted-foreground">No payroll data recorded yet.</div>}
      </div>
    );
  }

  return (
    <div className="h-80">
      <p className="text-sm font-medium mb-2">Intake vs Graduates</p>
      {graduationRows.length > 0 ? (
        <ResponsiveContainer>
          <BarChart data={graduationRows}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="year" /><YAxis /><Tooltip /><Legend />
            <Bar dataKey="intake" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            <Bar dataKey="graduated" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : <div className="h-full flex items-center justify-center text-muted-foreground">No graduation data yet</div>}
    </div>
  );
}

function ReportTable({ kind, studentRows, financeRows, academicRows, graduationRows, staffPayroll }: any) {
  const { head, rows } = getTableData(kind, studentRows, financeRows, academicRows, graduationRows, staffPayroll);
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
        <tr>{head.map((h: any) => <th key={h} className="text-left font-medium px-5 py-3">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={head.length} className="text-center py-8 text-muted-foreground">No records found.</td></tr>
        ) : (
          rows.map((r: any, i: number) => (
            <tr key={i} className="border-t hover:bg-accent/50 transition-colors">
              {r.map((c: any, j: number) => <td key={j} className="px-5 py-3">{c}</td>)}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function getTableData(kind: string, studentRows: any[], financeRows: any[], academicRows: any[], graduationRows: any[], staffPayroll: any[]) {
  if (kind === "students") return {
    head: ["Name", "Reg No.", "Course", "Status", "Balance"],
    rows: studentRows.map((s) => [s.name, s.reg, s.course, s.status, fmtUGX(s.balance)]),
  };
  if (kind === "finance") return {
    head: ["Month", "Income", "Expenses", "Net"],
    rows: financeRows.map((f) => [f.month, fmtUGX(f.income), fmtUGX(f.expenses), fmtUGX(f.net)]),
  };
  if (kind === "staff") return {
    head: ["Staff Name", "Role", "Period", "Base Amount", "Advance", "Net Pay", "Status"],
    rows: staffPayroll.map((s) => [s.name, s.role, s.period, fmtUGX(s.base), fmtUGX(s.advance), fmtUGX(s.net), s.paid ? "Paid" : "Pending"]),
  };
  return {
    head: ["Year", "Intake", "Graduated", "Rate"],
    rows: graduationRows.map((g) => [String(g.year), String(g.intake), String(g.graduated), `${g.intake > 0 ? Math.round((g.graduated / g.intake) * 100) : 0}%`]),
  };
}