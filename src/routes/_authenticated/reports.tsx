import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { Users, Wallet, Receipt, GraduationCap, Download, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Sandstone School" }] }),
  component: ReportsPage,
});

// Local definitions to avoid import issues
const COURSES: Record<string, { label: string }> = {
  english: { label: "English" },
  computer: { label: "Computer" },
  computer_english: { label: "Computer & English" },
  french: { label: "French" },
  kiswahili: { label: "Kiswahili" },
  private_class: { label: "Private Class" },
};

const fmtUGX = (n: number) => `UGX ${Number(n).toLocaleString()}`;

type ReportKey = "students" | "finance" | "academic" | "graduation";

const actions: { key: ReportKey; label: string; icon: any; tint: string; desc: string }[] = [
  { key: "students",   label: "Student Report",    icon: Users,         tint: "bg-info/10 text-info",            desc: "Enrolment, courses & balances" },
  { key: "finance",    label: "Finance Report",    icon: Wallet,        tint: "bg-success/10 text-success",      desc: "Income, expenses & cashflow" },
  { key: "academic",   label: "Academic Report",   icon: Receipt,       tint: "bg-warning/15 text-warning-foreground", desc: "Attendance & performance" },
  { key: "graduation", label: "Graduation Report", icon: GraduationCap, tint: "bg-accent text-primary",          desc: "Completion rates & alumni" },
];

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--info))", "hsl(var(--warning))", "hsl(var(--destructive))"];

// Mocked Academic Data (Since there is no 'marks' table in Supabase yet)
const academicRows = [
  { student: "Kizza Alex",    course: "English",   avg: 78, grade: "B+", attendance: "94%" },
  { student: "Mutyaba Keith", course: "Computer",  avg: 85, grade: "A",  attendance: "98%" },
  { student: "Nakamya Sarah", course: "French",    avg: 71, grade: "B",  attendance: "89%" },
  { student: "Auma Grace",    course: "English",   avg: 66, grade: "C+", attendance: "82%" },
];
const academicTrend = [
  { week: "W1", avg: 62 }, { week: "W2", avg: 65 }, { week: "W3", avg: 70 }, { week: "W4", avg: 72 },
  { week: "W5", avg: 75 }, { week: "W6", avg: 76 }, { week: "W7", avg: 79 }, { week: "W8", avg: 81 },
];

function ReportsPage() {
  const [selected, setSelected] = useState<ReportKey>("students");
  const chartRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  
  // Live Data States
  const [studentRows, setStudentRows] = useState<any[]>([]);
  const [studentsByCourse, setStudentsByCourse] = useState<any[]>([]);
  const [financeMonthly, setFinanceMonthly] = useState<any[]>([]);
  const [financeRows, setFinanceRows] = useState<any[]>([]);
  const [graduationRows, setGraduationRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const current = actions.find((a) => a.key === selected)!;

  // ── Fetch Data from Supabase ──────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      
      // 1. Fetch Students
      const { data: studentsData } = await supabase.from("students").select("*");
      if (studentsData) {
        const sRows = studentsData.map(s => ({
          name: s.name || "N/A",
          reg: s.reg_no || "N/A",
          course: COURSES[s.course]?.label || s.course || "Unknown",
          status: s.status ? s.status.charAt(0).toUpperCase() + s.status.slice(1) : "Unknown",
          balance: Number(s.balance) || 0,
        }));
        setStudentRows(sRows);

        const courseCounts: Record<string, number> = {};
        studentsData.forEach(s => {
          const label = COURSES[s.course]?.label || s.course || "Unknown";
          courseCounts[label] = (courseCounts[label] || 0) + 1;
        });
        setStudentsByCourse(Object.entries(courseCounts).map(([course, students]) => ({ course, students })));

        // Graduation stats
        const graduatedCount = studentsData.filter(s => s.status === "graduated").length;
        const activeCount = studentsData.filter(s => s.status === "active").length;
        setGraduationRows([
          { year: "Current", intake: activeCount + graduatedCount, graduated: graduatedCount }
        ]);
      }

      // 2. Fetch Transactions for Finance
      const { data: transData } = await supabase.from("transactions").select("*");
      if (transData) {
        const monthly: Record<string, { income: number; expenses: number }> = {};
        transData.forEach(t => {
          const date = new Date(t.date);
          const monthKey = date.toLocaleString("default", { month: "short" });
          if (!monthly[monthKey]) monthly[monthKey] = { income: 0, expenses: 0 };
          if (t.type === "income") monthly[monthKey].income += Number(t.amount);
          else if (t.type === "expense") monthly[monthKey].expenses += Number(t.amount);
        });
        
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const fMonthly = months.map(m => ({
          month: m,
          income: monthly[m]?.income || 0,
          expenses: monthly[m]?.expenses || 0,
        })).filter(m => m.income > 0 || m.expenses > 0); // Only show months with data
        
        setFinanceMonthly(fMonthly);
        setFinanceRows(fMonthly.map(m => ({ ...m, net: m.income - m.expenses })));
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  // ── Robust PDF Export ─────────────────────────────────────────────────────
  async function exportPdf() {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();

      // Header
      doc.setFillColor(20, 25, 55);
      doc.rect(0, 0, pageW, 70, "F");
      doc.setTextColor(255);
      doc.setFontSize(18);
      doc.text("Sandstone School of Languages & Computer Studies", 40, 32);
      doc.setFontSize(12);
      doc.text(current.label, 40, 54);
      doc.setTextColor(220);
      doc.setFontSize(9);
      doc.text(new Date().toLocaleString(), pageW - 40, 54, { align: "right" });

      // Chart image (with fallback if html2canvas fails on SVG)
      let tableTop = 90;
      try {
        const canvas = await html2canvas(chartRef.current, { 
          backgroundColor: "#ffffff", 
          useCORS: true,
          logging: false,
          scale: 1 
        });
        const img = canvas.toDataURL("image/png");
        const imgW = pageW - 80;
        const imgH = (canvas.height * imgW) / canvas.width;
        doc.addImage(img, "PNG", 40, 90, imgW, Math.min(imgH, 280));
        tableTop = 90 + Math.min(imgH, 280) + 20;
      } catch (imgErr) {
        console.warn("Chart capture failed, exporting table only.", imgErr);
        doc.setTextColor(200, 0, 0);
        doc.setFontSize(10);
        doc.text("Note: Chart visual could not be captured. See table below for data.", 40, 90);
        doc.setTextColor(20, 25, 55);
        tableTop = 110;
      }

      // Table (FIXED: Passing data arrays directly into the function)
      doc.setTextColor(20, 25, 55);
      doc.setFontSize(13);
      doc.text("Detailed Records", 40, tableTop);

      const { head, body, foot } = buildTable(selected, studentRows, financeRows, academicRows, graduationRows);
      autoTable(doc, {
        head,
        body,
        foot,
        startY: tableTop + 10,
        styles: { fontSize: 9, cellPadding: 6 },
        headStyles: { fillColor: [37, 47, 99], textColor: 255 },
        footStyles: { fillColor: [240, 242, 255], textColor: [20, 25, 55], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 249, 253] },
        margin: { left: 40, right: 40 },
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(
          `Generated by Sandstone SMS  ·  Page ${i} of ${pageCount}`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 20,
          { align: "center" },
        );
      }

      doc.save(`sandstone-${selected}-report-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Report exported successfully");
    } catch (e: any) {
      console.error("PDF Export Error:", e);
      toast.error(e.message ?? "Failed to export report");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">Generate, visualise and export school reports</p>
        </div>
        <Button onClick={exportPdf} disabled={exporting} className="bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-lg active:scale-95 transition-all">
          {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          Export {current.label}
        </Button>
      </header>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => {
          const Icon = a.icon;
          const active = a.key === selected;
          return (
            <button
              key={a.key}
              onClick={() => setSelected(a.key)}
              className={cn(
                "stat-card-premium rounded-2xl border bg-card p-6 text-left transition-all duration-300",
                active && "border-primary ring-2 ring-primary/30 shadow-lg",
              )}
            >
              <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center mb-4", a.tint)}>
                <Icon className="h-6 w-6" />
              </div>
              <p className="font-semibold">{a.label}</p>
              <p className="text-sm text-muted-foreground mt-1">{a.desc}</p>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" /> Loading report data from Supabase...
        </div>
      ) : (
        <div ref={chartRef} className="rounded-2xl border bg-card overflow-hidden">
          <div className="p-5 border-b flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">{current.label} — Visual Summary</h2>
          </div>
          <div className="p-5">
            <ReportChart 
              kind={selected} 
              studentsByCourse={studentsByCourse} 
              studentRows={studentRows} 
              financeMonthly={financeMonthly} 
              graduationRows={graduationRows} 
            />
          </div>
          <div className="border-t">
            <ReportTable 
              kind={selected} 
              studentRows={studentRows} 
              financeRows={financeRows} 
              academicRows={academicRows}
              graduationRows={graduationRows} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Chart Component ─────────────────────────────────────────────────────────
function ReportChart({ kind, studentsByCourse, studentRows, financeMonthly, graduationRows }: any) {
  if (kind === "students") {
    return (
      <div className="grid md:grid-cols-2 gap-6">
        <div className="h-72">
          <p className="text-sm font-medium mb-2">Enrolment by Course</p>
          {studentsByCourse.length > 0 ? (
            <ResponsiveContainer>
              <BarChart data={studentsByCourse}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="course" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="students" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">No student data yet</div>
          )}
        </div>
        <div className="h-72">
          <p className="text-sm font-medium mb-2">Status Mix</p>
          {studentRows.length > 0 ? (
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={[
                    { name: "Active", value: studentRows.filter((s: any) => s.status === "Active").length },
                    { name: "Graduated", value: studentRows.filter((s: any) => s.status === "Graduated").length },
                  ].filter(d => d.value > 0)}
                  dataKey="value" nameKey="name" outerRadius={90} label
                >
                  {COLORS.map((c, i) => <Cell key={i} fill={c} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">No student data yet</div>
          )}
        </div>
      </div>
    );
  }
  if (kind === "finance") {
    return (
      <div className="h-80">
        <p className="text-sm font-medium mb-2">Income vs Expenses (UGX)</p>
        {financeMonthly.length > 0 ? (
          <ResponsiveContainer>
            <BarChart data={financeMonthly}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}M`} />
              <Tooltip formatter={(v: number) => fmtUGX(v)} />
              <Legend />
              <Bar dataKey="income" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">No finance data yet</div>
        )}
      </div>
    );
  }
  if (kind === "academic") {
    return (
      <div className="h-80">
        <p className="text-sm font-medium mb-2">Class Average Trend (8 Weeks)</p>
        <ResponsiveContainer>
          <LineChart data={academicTrend}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="week" />
            <YAxis domain={[50, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div className="h-80">
      <p className="text-sm font-medium mb-2">Intake vs Graduates</p>
      {graduationRows.length > 0 && graduationRows[0].graduated > 0 ? (
        <ResponsiveContainer>
          <BarChart data={graduationRows}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="year" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="intake" fill="hsl(var(--info))" radius={[6, 6, 0, 0]} />
            <Bar dataKey="graduated" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-muted-foreground">No graduation data yet</div>
      )}
    </div>
  );
}

// ── Table Component ─────────────────────────────────────────────────────────
function ReportTable({ kind, studentRows, financeRows, academicRows, graduationRows }: any) {
  const { head, rows } = uiTable(kind, studentRows, financeRows, academicRows, graduationRows);
  return (
    <table className="w-full text-sm">
      <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
        <tr>{head.map((h) => <th key={h} className="text-left font-medium px-5 py-3">{h}</th>)}</tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={head.length} className="text-center py-8 text-muted-foreground">No records found.</td></tr>
        ) : (
          rows.map((r, i) => (
            <tr key={i} className="border-t hover:bg-accent/50 transition-colors">
              {r.map((c, j) => <td key={j} className="px-5 py-3">{c}</td>)}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

// ── Data Mappers ────────────────────────────────────────────────────────────
function uiTable(kind: ReportKey, studentRows: any[], financeRows: any[], academicRows: any[], graduationRows: any[]): { head: string[]; rows: (string | number)[][] } {
  if (kind === "students") return {
    head: ["Name", "Reg No.", "Course", "Status", "Balance"],
    rows: studentRows.map((s) => [s.name, s.reg, s.course, s.status, fmtUGX(s.balance)]),
  };
  if (kind === "finance") return {
    head: ["Month", "Income", "Expenses", "Net"],
    rows: financeRows.map((f) => [f.month, fmtUGX(f.income), fmtUGX(f.expenses), fmtUGX(f.net)]),
  };
  if (kind === "academic") return {
    head: ["Student", "Course", "Average", "Grade", "Attendance"],
    rows: academicRows.map((a) => [a.student, a.course, String(a.avg), a.grade, a.attendance]),
  };
  return {
    head: ["Year", "Intake", "Graduated", "Rate"],
    rows: graduationRows.map((g) => [String(g.year), String(g.intake), String(g.graduated), `${Math.round((g.graduated / g.intake) * 100)}%`]),
  };
}

// FIXED: Added data arrays as arguments so it doesn't crash on export
function buildTable(kind: ReportKey, studentRows: any[], financeRows: any[], academicRows: any[], graduationRows: any[]): { head: any[][]; body: any[][]; foot?: any[][] } {
  const { head, rows } = uiTable(kind, studentRows, financeRows, academicRows, graduationRows);
  
  // Sanitize data to prevent jspdf-autotable from crashing on undefined/null
  const safeRows = rows.map(row => row.map(cell => cell ?? ""));

  if (kind === "finance") {
    const totals = financeRows.reduce((a, r) => ({ income: a.income + r.income, expenses: a.expenses + r.expenses, net: a.net + r.net }), { income: 0, expenses: 0, net: 0 });
    return {
      head: [head],
      body: safeRows,
      foot: [["Total", fmtUGX(totals.income), fmtUGX(totals.expenses), fmtUGX(totals.net)]],
    };
  }
  return { head: [head], body: safeRows };
}