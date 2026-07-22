import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, Receipt, AlertCircle, CheckCircle2,
  Loader2, Search, CreditCard, TrendingUp, Users, Clock, Banknote, Calendar, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Payments — Sandstone School" }] }),
  component: PaymentsPage,
});

// ── Course definitions ─────────────────────────────────────────────
const COURSES: Record<string, { label: string; fee: number; levels: string[] }> = {
  english:          { label: "English",           fee: 130000, levels: ["Zero Level", "Pre Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"] },
  computer:         { label: "Computer",          fee: 150000, levels: ["Beginner", "Intermediate", "Advanced"] },
  computer_english: { label: "Computer & English", fee: 230000, levels: ["Zero Level", "Pre Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"] },
  french:           { label: "French",            fee: 150000, levels: ["Beginner", "Intermediate", "Advanced"] },
  kiswahili:        { label: "Kiswahili",         fee: 300000, levels: ["Beginner", "Intermediate", "Advanced"] },
  german:           { label: "German",            fee: 300000, levels: ["Beginner", "Intermediate", "Advanced"] },
  private_class:    { label: "Private Class",     fee: 300000, levels: ["Private"] },
  private_class_2:  { label: "Private Class 2",   fee: 500000, levels: ["Private"] },
};

const METHODS = [
  { value: "cash",         label: "Cash" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank",         label: "Bank Transfer" },
];

function formatUGX(n: number) {
  return `UGX ${Number(n).toLocaleString("en-UG")}`;
}

function currentMonthYear() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthYear(my: string) {
  if (!my) return "—";
  const [y, m] = my.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-UG", {
    month: "long", year: "numeric",
  });
}

function getMonthsArray(startMonth: string, count: number) {
  const [y, m] = startMonth.split("-").map(Number);
  const months = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(y, m - 1 + i, 1);
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function getEndMonth(startMonth: string, count: number) {
  const [y, m] = startMonth.split("-").map(Number);
  const date = new Date(y, m - 1 + count - 1, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// ── Types ──────────────────────────────────────────────────────────────────
type Student = {
  id: string; name: string; reg_no: string;
  course: string; level: string; status: string; balance: number;
};

type Payment = {
  id: string; student_id: string; student_name: string;
  reg_no: string; course: string; level: string;
  amount_due: number; amount_paid: number; balance: number;
  method: string; payment_date: string; month_year: string;
  status: string; note?: string; months_covered?: number;
};

type PaymentForm = {
  student_id: string; student_name: string; reg_no: string;
  course: string; level: string;
  current_balance: number; 
  amount_due: number;
  amount_paid: string;
  method: string; payment_date: string; 
  start_month: string; 
  num_months: number;  
  note: string;
};

const emptyForm = (): PaymentForm => ({
  student_id: "", student_name: "", reg_no: "",
  course: "english", level: "",
  current_balance: 0, amount_due: 0, amount_paid: "",
  method: "cash",
  payment_date: new Date().toISOString().slice(0, 10),
  start_month: currentMonthYear(),
  num_months: 1,
  note: "",
});

// ── Page ───────────────────────────────────────────────────────────────────
function PaymentsPage() {
  const [students, setStudents]     = useState<Student[]>([]);
  const [payments, setPayments]     = useState<Payment[]>([]);
  const [otherIncome, setOtherIncome] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [tab, setTab]                     = useState<"records" | "overdue" | "other">("records");
  const [courseFilter, setCourseFilter]   = useState("all");
  const [levelFilter, setLevelFilter]     = useState("all");
  const [monthFilter, setMonthFilter]     = useState(currentMonthYear());
  const [search, setSearch]               = useState("");

  const [overdueCourseFilter, setOverdueCourseFilter] = useState("all");

  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const [form, setForm]         = useState<PaymentForm>(emptyForm());

  const [studentSearch, setStudentSearch] = useState("");
  const [studentCourseFilter, setStudentCourseFilter] = useState("all");
  const [studentLevelFilter, setStudentLevelFilter] = useState("all");

  const [otherIncomeOpen, setOtherIncomeOpen] = useState(false);
  const [otherIncomeForm, setOtherIncomeForm] = useState({
    source: "", amount: "", method: "cash", date: new Date().toISOString().slice(0, 10), note: ""
  });

  const fetchOtherIncome = async () => {
    const { data } = await supabase.from("transactions")
      .select("*")
      .like("description", "%Other Income:%")
      .order("date", { ascending: false });
    if (data) {
      setOtherIncome(data.map(t => {
        // ✅ Strip "Money In | " prefix if it exists, then parse
        const cleanDesc = (t.description || "").replace(/^Money In \| /, "");
        const parts = cleanDesc.replace("Other Income: ", "").split(" | ");
        return {
          id: t.id,
          source: parts[0] || "Unknown",
          method: parts[1]?.replace("Method: ", "") || "cash",
          note: parts[2]?.replace("Note: ", "") || "",
          amount: Number(t.amount),
          date: t.date,
        };
      }));
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from("students").select("*").eq("status", "active").order("name"),
      supabase.from("payments").select("*").order("payment_date", { ascending: false }),
    ]);
    setStudents((s ?? []) as Student[]);
    setPayments((p ?? []) as Payment[]);
    await fetchOtherIncome();
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const filterLevels = useMemo(() => {
    if (courseFilter === "all") {
      const all = new Set<string>();
      Object.values(COURSES).forEach(c => c.levels.forEach(l => all.add(l)));
      return Array.from(all);
    }
    return COURSES[courseFilter]?.levels ?? [];
  }, [courseFilter]);

  const dialogFilterLevels = useMemo(() => {
    if (studentCourseFilter === "all") {
      const all = new Set<string>();
      Object.values(COURSES).forEach(c => c.levels.forEach(l => all.add(l)));
      return Array.from(all);
    }
    return COURSES[studentCourseFilter]?.levels ?? [];
  }, [studentCourseFilter]);

  useEffect(() => { setLevelFilter("all"); }, [courseFilter]);

  const dialogFilteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchSearch = !studentSearch || 
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
        s.reg_no.toLowerCase().includes(studentSearch.toLowerCase());
      const matchCourse = studentCourseFilter === "all" || s.course === studentCourseFilter;
      const matchLevel = studentLevelFilter === "all" || s.level === studentLevelFilter;
      return matchSearch && matchCourse && matchLevel;
    });
  }, [students, studentSearch, studentCourseFilter, studentLevelFilter]);

  const overdueStudents = useMemo(() => {
    return students.filter(s => {
      if (s.balance > 0) {
        if (overdueCourseFilter !== "all" && s.course !== overdueCourseFilter) return false;
        return true;
      }
      return false;
    });
  }, [students, overdueCourseFilter]);

  const filteredPayments = useMemo(() => {
    return payments.filter(p => {
      const matchMonth  = !monthFilter || p.month_year === monthFilter;
      const matchCourse = courseFilter === "all" || p.course === courseFilter;
      const matchLevel  = levelFilter === "all" || p.level === levelFilter;
      const matchSearch = !search ||
        p.student_name.toLowerCase().includes(search.toLowerCase()) ||
        p.reg_no.toLowerCase().includes(search.toLowerCase());
      return matchMonth && matchCourse && matchLevel && matchSearch;
    });
  }, [payments, monthFilter, courseFilter, levelFilter, search]);

  const stats = useMemo(() => {
    const thisMonth = payments.filter(p => p.month_year === currentMonthYear());
    return {
      collected:   thisMonth.reduce((s, p) => s + p.amount_paid, 0),
      outstanding: students.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0),
      overdue:     overdueStudents.length,
    };
  }, [payments, students, overdueStudents]);

  const getNewDue = (f: PaymentForm) => {
    const courseFee = COURSES[f.course]?.fee ?? 0;
    if (editing) return courseFee * f.num_months;
    if (f.current_balance > 0 && f.num_months === 1) {
      return f.current_balance;
    }
    return f.current_balance + (courseFee * f.num_months);
  };

  const selectStudent = (s: Student) => {
    const courseFee = COURSES[s.course]?.fee ?? 0;
    const currentBalance = s.balance > 0 ? s.balance : 0;
    let initialDue = courseFee;
    if (currentBalance > 0) initialDue = currentBalance;

    setForm(f => ({
      ...f,
      student_id: s.id,
      student_name: s.name,
      reg_no: s.reg_no,
      course: s.course,
      level: s.level,
      current_balance: currentBalance,
      start_month: currentMonthYear(),
      num_months: 1,
      amount_due: initialDue,
      amount_paid: "",
    }));
    setStudentSearch("");
  };

  const openNew = (student?: Student) => {
    setEditing(null);
    setStudentSearch("");
    setStudentCourseFilter("all");
    setStudentLevelFilter("all");
    if (student) {
      const courseFee = COURSES[student.course]?.fee ?? 0;
      const currentBalance = student.balance > 0 ? student.balance : 0;
      let initialDue = courseFee;
      if (currentBalance > 0) initialDue = currentBalance;

      setForm({
        ...emptyForm(),
        student_id: student.id,
        student_name: student.name,
        reg_no: student.reg_no,
        course: student.course,
        level: student.level,
        current_balance: currentBalance,
        amount_due: initialDue,
      });
    } else {
      setForm(emptyForm());
    }
    setOpen(true);
  };

  const openEdit = (p: Payment) => {
    setEditing(p);
    setForm({
      student_id: p.student_id, student_name: p.student_name, reg_no: p.reg_no,
      course: p.course, level: p.level ?? "",
      current_balance: 0, 
      amount_due: p.amount_due,
      amount_paid: String(p.amount_paid),
      method: p.method, payment_date: p.payment_date,
      start_month: p.month_year,
      num_months: p.months_covered || 1,
      note: p.note ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.student_id)  return toast.error("Please select a student");
    if (!form.amount_paid) return toast.error("Enter amount paid");
    
    const paid    = Number(form.amount_paid);
    const due     = form.amount_due;
    const balance = Math.max(0, due - paid);
    const status  = paid >= due ? "paid" : paid > 0 ? "partial" : "pending";

    if (paid < 0)   return toast.error("Amount paid cannot be negative");
    if (paid > due) return toast.error(`Amount paid cannot exceed ${formatUGX(due)}`);

    setSubmitting(true);

    const paymentDate = new Date(form.payment_date);
    const paidUntilDate = new Date(paymentDate);
    paidUntilDate.setDate(paymentDate.getDate() + (form.num_months * 30));
    const paidUntilStr = paidUntilDate.toISOString().slice(0, 10);

    if (editing) {
      const { error } = await supabase.from("payments").update({
        amount_due: due, amount_paid: paid, balance,
        method: form.method, payment_date: form.payment_date,
        month_year: form.start_month,
        months_covered: form.num_months,
        status, note: form.note,
      }).eq("id", editing.id);
      
      if (error) { toast.error("Update failed: " + error.message); setSubmitting(false); return; }
      toast.success("Payment updated");
    } else {
      const { error } = await supabase.from("payments").insert({
        student_id: form.student_id, student_name: form.student_name,
        reg_no: form.reg_no, course: form.course, level: form.level,
        amount_due: due, amount_paid: paid, balance,
        method: form.method, payment_date: form.payment_date,
        month_year: form.start_month,
        months_covered: form.num_months,
        status, note: form.note,
      });
      
      if (error) { toast.error("Failed to record: " + error.message); setSubmitting(false); return; }

      const courseFee = COURSES[form.course]?.fee ?? 0;
      const shouldUpdatePaidUntil = paid >= courseFee;

      const studentUpdate: any = {
        balance,
        last_payment_date: form.payment_date,
      };

      if (shouldUpdatePaidUntil) {
        studentUpdate.paid_until = paidUntilStr;
      }

      await supabase.from("students").update(studentUpdate).eq("id", form.student_id);

      if (paid > 0) {
        const monthsArr = getMonthsArray(form.start_month, form.num_months);
        const endMonthStr = formatMonthYear(monthsArr[monthsArr.length - 1]);
        const startMonthStr = formatMonthYear(monthsArr[0]);
        
        await supabase.from("transactions").insert({
          type: "income", 
          amount: paid, 
          date: form.payment_date,
          description: `Money In | Payment — ${form.student_name} (${form.reg_no}) ${form.level ? `[${form.level}]` : ""} ${startMonthStr} to ${endMonthStr} (${form.num_months} month${form.num_months > 1 ? "s" : ""})`,
        });
      }

      toast.success("Payment recorded", {
        description: balance > 0
          ? `Balance of ${formatUGX(balance)} still outstanding`
          : `Student is fully paid until ${paidUntilDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}!`,
      });
    }

    setOpen(false);
    setSubmitting(false);
    fetchAll();
  };

  const saveOtherIncome = async () => {
    if (!otherIncomeForm.source.trim()) return toast.error("Source is required");
    if (!otherIncomeForm.amount) return toast.error("Amount is required");
    
    // ✅ FIX: Added "Money In | " prefix so Accounts page recognizes it as income
    const desc = `Money In | Other Income: ${otherIncomeForm.source} | Method: ${otherIncomeForm.method} | Note: ${otherIncomeForm.note}`;
    
    const { error } = await supabase.from("transactions").insert({
      type: "income",
      amount: Number(otherIncomeForm.amount),
      date: otherIncomeForm.date,
      description: desc
    });
    
    if (error) return toast.error("Failed: " + error.message);
    toast.success("Other income recorded");
    setOtherIncomeOpen(false);
    setOtherIncomeForm({ source: "", amount: "", method: "cash", date: new Date().toISOString().slice(0, 10), note: "" });
    fetchAll();
  };

  const deleteOtherIncome = async (id: string) => {
    if (!confirm("Delete this income record?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) return toast.error("Failed: " + error.message);
    toast.success("Income record deleted");
    fetchAll();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    
    if (deleting.amount_paid > 0) {
      await supabase
        .from("transactions")
        .delete()
        .eq("type", "income")
        .eq("amount", deleting.amount_paid)
        .eq("date", deleting.payment_date)
        .like("description", `%${deleting.student_name}%`)
        .like("description", `%${deleting.reg_no}%`);
    }

    const { error } = await supabase.from("payments").delete().eq("id", deleting.id);
    if (error) { 
      toast.error("Delete failed: " + error.message); 
      return; 
    }
    
    toast.success("Payment record and transaction removed");
    setDeleting(null);
    fetchAll();
  };

  // ✅ NEW: Export Filtered Payments to CSV
  const exportFilteredCSV = () => {
    const headers = ["Date", "Student", "Reg No", "Course", "Level", "Period", "Method", "Due", "Paid", "Balance", "Status", "Note"];
    const rows = filteredPayments.map(p => {
      const monthsCovered = p.months_covered || 1;
      const endMonth = getEndMonth(p.month_year, monthsCovered);
      const period = monthsCovered > 1 ? `${formatMonthYear(p.month_year)} to ${formatMonthYear(endMonth)} (${monthsCovered} mos)` : formatMonthYear(p.month_year);
      return [
        p.payment_date,
        `"${p.student_name.replace(/"/g, '""')}"`,
        p.reg_no,
        COURSES[p.course]?.label ?? p.course,
        p.level || "—",
        `"${period}"`,
        p.method.replace("_", " "),
        p.amount_due,
        p.amount_paid,
        p.balance,
        p.status,
        `"${(p.note || "").replace(/"/g, '""')}"`
      ].join(",");
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `payments_filtered_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Filtered payments exported successfully");
  };

  // ✅ NEW: Export ALL Payments to CSV (Full Backup)
  const exportAllCSV = () => {
    const headers = ["Date", "Student", "Reg No", "Course", "Level", "Period", "Method", "Due", "Paid", "Balance", "Status", "Note"];
    const rows = payments.map(p => {
      const monthsCovered = p.months_covered || 1;
      const endMonth = getEndMonth(p.month_year, monthsCovered);
      const period = monthsCovered > 1 ? `${formatMonthYear(p.month_year)} to ${formatMonthYear(endMonth)} (${monthsCovered} mos)` : formatMonthYear(p.month_year);
      return [
        p.payment_date,
        `"${p.student_name.replace(/"/g, '""')}"`,
        p.reg_no,
        COURSES[p.course]?.label ?? p.course,
        p.level || "—",
        `"${period}"`,
        p.method.replace("_", " "),
        p.amount_due,
        p.amount_paid,
        p.balance,
        p.status,
        `"${(p.note || "").replace(/"/g, '""')}"`
      ].join(",");
    });
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `payments_all_data_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("All payments data exported successfully");
  };

  const availableMonths = useMemo(() => {
    const months = [...new Set(payments.map(p => p.month_year))].sort().reverse();
    if (!months.includes(currentMonthYear())) months.unshift(currentMonthYear());
    return months;
  }, [payments]);

  const formLevels = useMemo(() => COURSES[form.course]?.levels ?? [], [form.course]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments & Revenue</h1>
          <p className="text-muted-foreground mt-1">
            Manage student fees and other income sources — {formatMonthYear(currentMonthYear())}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOtherIncomeOpen(true)}>
            <Banknote className="h-4 w-4 mr-1" /> Record Other Income
          </Button>
          <Button onClick={() => openNew()}>
            <Plus className="h-4 w-4 mr-1" /> Record Student Payment
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Collected This Month"
          value={formatUGX(stats.collected)} color="text-green-600" />
        <StatCard icon={<CreditCard className="h-5 w-5" />} label="Total Debt Owed"
          value={formatUGX(stats.outstanding)}
          color={stats.outstanding > 0 ? "text-destructive" : "text-muted-foreground"} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Students with Debt"
          value={`${stats.overdue} student${stats.overdue !== 1 ? "s" : ""}`}
          color={stats.overdue > 0 ? "text-amber-600" : "text-muted-foreground"} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="records">Student Payments</TabsTrigger>
          <TabsTrigger value="overdue" className="gap-2">
            Clear Debts
            {stats.overdue > 0 && (
              <Badge variant="destructive" className="text-xs h-5 px-1.5">{stats.overdue}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="other">Other Income</TabsTrigger>
        </TabsList>

        {/* ── Records Tab ── */}
        <TabsContent value="records" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search student or reg no..." className="pl-9" />
              </div>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="w-[175px]"> <SelectValue placeholder="Month" /> </SelectTrigger>
                <SelectContent>
                  {availableMonths.map(m => (
                    <SelectItem key={m} value={m}>{formatMonthYear(m)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger className="w-[175px]"> <SelectValue placeholder="Course" /> </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {Object.entries(COURSES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-[155px]"> <SelectValue placeholder="Level" /> </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  {filterLevels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              
              {/* ✅ NEW: Export Buttons */}
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={exportFilteredCSV}>
                  <Download className="h-4 w-4 mr-1" /> Export Filtered
                </Button>
                <Button variant="default" size="sm" onClick={exportAllCSV}>
                  <Download className="h-4 w-4 mr-1" /> Export All
                </Button>
              </div>
              <span className="text-sm text-muted-foreground ml-2">
                {filteredPayments.length} record{filteredPayments.length !== 1 ? "s" : ""}
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading payments...
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Receipt className="h-8 w-8" />
                <p className="font-medium">No payment records found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Reg No</TableHead><TableHead>Course</TableHead><TableHead>Level</TableHead><TableHead>Period</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Due</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead><TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map(p => {
                    const monthsCovered = p.months_covered || 1;
                    const endMonth = getEndMonth(p.month_year, monthsCovered);
                    
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{p.payment_date}</TableCell>
                        <TableCell className="font-medium">{p.student_name}</TableCell>
                        <TableCell className="font-mono text-xs">{p.reg_no}</TableCell>
                        <TableCell>{COURSES[p.course]?.label ?? p.course}</TableCell>
                        <TableCell>{p.level ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">{p.level}</span> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                        <TableCell className="text-sm">
                          {monthsCovered > 1 ? (
                            <>
                              <div>{formatMonthYear(p.month_year)}</div>
                              <div className="text-xs text-muted-foreground">to {formatMonthYear(endMonth)} ({monthsCovered} mos)</div>
                            </>
                          ) : (
                            formatMonthYear(p.month_year)
                          )}
                        </TableCell>
                        <TableCell className="capitalize">{p.method.replace("_", " ")}</TableCell>
                        <TableCell className="text-right">{formatUGX(p.amount_due)}</TableCell>
                        <TableCell className="text-right text-green-600 font-medium">{formatUGX(p.amount_paid)}</TableCell>
                        <TableCell className={`text-right font-medium ${p.balance > 0 ? "text-destructive" : "text-muted-foreground"}`}>{p.balance > 0 ? formatUGX(p.balance) : "—"}</TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleting(p)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* ── Clear Debts Tab ── */}
        <TabsContent value="overdue" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-sm">Students with Outstanding Balances</span>
                <Badge variant="outline" className="ml-2">{overdueStudents.length} students</Badge>
              </div>
              <Select value={overdueCourseFilter} onValueChange={setOverdueCourseFilter}>
                <SelectTrigger className="w-[180px]"> <SelectValue placeholder="Filter Course" /> </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {Object.entries(COURSES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>
            ) : overdueStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2"><CheckCircle2 className="h-8 w-8 text-green-500" /><p className="font-medium text-green-600">All students are fully paid up! No outstanding debts.</p></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reg No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-right">Amount Demanded</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueStudents.map(s => (
                    <TableRow key={s.id} className="bg-amber-50/40 dark:bg-amber-950/10">
                      <TableCell className="font-mono text-xs">{s.reg_no}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{COURSES[s.course]?.label ?? s.course}</TableCell>
                      <TableCell><span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">{s.level}</span></TableCell>
                      <TableCell className="text-right font-bold text-destructive text-lg">{formatUGX(s.balance)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => { openNew(s); setTab("records"); }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                          <Plus className="h-3 w-3 mr-1" /> Clear Debt
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* ── Other Income Tab ── */}
        <TabsContent value="other" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-emerald-500" />
                <span className="font-semibold">Other Income Sources</span>
              </div>
              <Badge variant="outline">{otherIncome.length} records</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherIncome.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No other income recorded yet. Click "Record Other Income" to add.</TableCell></TableRow>
                ) : (
                  otherIncome.map(inc => (
                    <TableRow key={inc.id}>
                      <TableCell className="font-mono text-xs">{inc.date}</TableCell>
                      <TableCell className="font-medium">{inc.source}</TableCell>
                      <TableCell className="capitalize">{inc.method.replace("_", " ")}</TableCell>
                      <TableCell className="text-muted-foreground">{inc.note || "—"}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">{formatUGX(inc.amount)}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteOtherIncome(inc.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Student Payment Dialog ── */}
      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Payment" : "Record Student Payment"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {!editing ? (
              <div className="grid gap-2">
                <Label>Search Student <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={studentCourseFilter} onValueChange={setStudentCourseFilter}>
                    <SelectTrigger><SelectValue placeholder="Filter Course" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Courses</SelectItem>
                      {Object.entries(COURSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={studentLevelFilter} onValueChange={setStudentLevelFilter}>
                    <SelectTrigger><SelectValue placeholder="Filter Level" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      {dialogFilterLevels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    className="pl-9"
                    placeholder="Type name or reg no..." 
                    value={studentSearch} 
                    onChange={e => setStudentSearch(e.target.value)}
                  />
                </div>
                {studentSearch && (
                  <div className="border rounded-md max-h-48 overflow-y-auto bg-card shadow-lg z-50 relative">
                    {dialogFilteredStudents.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground text-center">No students found</div>
                    ) : (
                      dialogFilteredStudents.map(s => (
                        <button 
                          key={s.id} 
                          type="button"
                          onClick={() => selectStudent(s)} 
                          className="w-full text-left p-3 hover:bg-accent border-b last:border-0 transition-colors"
                        >
                          <div className="font-medium text-sm">{s.name}</div>
                          <div className="text-xs text-muted-foreground">{s.reg_no} • {COURSES[s.course]?.label} • {s.level}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
                <div>
                  <span className="font-medium">{form.student_name}</span>
                  <span className="text-muted-foreground ml-2">({form.reg_no})</span>
                </div>
              </div>
            )}

            {form.student_id && (
              <div className="rounded-lg border bg-primary/5 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Selected: {form.student_name}</span>
                  {!editing && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, student_id: "", student_name: "", reg_no: "", current_balance: 0, amount_due: 0 }))}>
                      Change
                    </Button>
                  )}
                </div>
                {form.current_balance > 0 && !editing && (
                  <div className="text-sm text-destructive font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Outstanding Balance: {formatUGX(form.current_balance)}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Start Month</Label>
                <Input 
                  type="month" 
                  value={form.start_month}
                  onChange={e => setForm(f => ({ ...f, start_month: e.target.value, amount_due: getNewDue({...f, start_month: e.target.value}) }))} 
                />
              </div>
              <div className="grid gap-2">
                <Label>Number of Months</Label>
                <Select value={String(form.num_months)} onValueChange={v => {
                  const num = parseInt(v);
                  setForm(f => ({ ...f, num_months: num, amount_due: getNewDue({...f, num_months: num}) }));
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} Month{n > 1 ? "s" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.student_id && form.num_months > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg border border-dashed">
                <span className="text-xs font-semibold text-muted-foreground w-full mb-1 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Covering:
                </span>
                {getMonthsArray(form.start_month, form.num_months).map(m => (
                  <Badge key={m} variant="outline" className="text-xs">{formatMonthYear(m)}</Badge>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Course</Label>
                <Select value={form.course} onValueChange={v => {
                  const levels = COURSES[v]?.levels ?? [];
                  setForm(f => ({ ...f, course: v, level: levels[0] ?? "", amount_due: getNewDue({...f, course: v}) }));
                }}>
                  <SelectTrigger> <SelectValue /> </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COURSES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Level</Label>
                <Select value={form.level} onValueChange={v => setForm(f => ({ ...f, level: v }))}>
                  <SelectTrigger> <SelectValue placeholder="Select level..." /> </SelectTrigger>
                  <SelectContent>
                    {formLevels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Total Amount Due (UGX)</Label>
                <Input type="number" value={form.amount_due} readOnly className="bg-muted font-bold" />
              </div>
              <div className="grid gap-2">
                <Label>Amount Paid (UGX) <span className="text-destructive">*</span></Label>
                <Input type="number" value={form.amount_paid} min={0} max={form.amount_due}
                  onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))}
                  placeholder="0" />
              </div>
            </div>

            {form.amount_paid !== "" && (
              <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm border ${
                Number(form.amount_paid) >= form.amount_due
                  ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300"
                  : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300"
              }`}>
                {Number(form.amount_paid) >= form.amount_due ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                {Number(form.amount_paid) >= form.amount_due 
                  ? `Full payment — student is covered for ${form.num_months * 30} days!` 
                  : `Balance of ${formatUGX(form.amount_due - Number(form.amount_paid))} will remain on account`}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Payment Method</Label>
                <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                  <SelectTrigger> <SelectValue /> </SelectTrigger>
                  <SelectContent>
                    {METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Payment Date</Label>
                <Input type="date" value={form.payment_date}
                  onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Note (optional)</Label>
              <Input value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="e.g. clearing admission balance, school fee waiver..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Save Changes" : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Other Income Dialog ── */}
      <Dialog open={otherIncomeOpen} onOpenChange={setOtherIncomeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Other Income</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Source / Description <span className="text-destructive">*</span></Label>
              <Input 
                value={otherIncomeForm.source} 
                onChange={e => setOtherIncomeForm({...otherIncomeForm, source: e.target.value})} 
                placeholder="e.g. Donation, Event Income, Sale of Books..." 
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Amount (UGX) <span className="text-destructive">*</span></Label>
                <Input type="number" value={otherIncomeForm.amount} onChange={e => setOtherIncomeForm({...otherIncomeForm, amount: e.target.value})} placeholder="0" />
              </div>
              <div className="grid gap-2">
                <Label>Date</Label>
                <Input type="date" value={otherIncomeForm.date} onChange={e => setOtherIncomeForm({...otherIncomeForm, date: e.target.value})} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Payment Method</Label>
              <Select value={otherIncomeForm.method} onValueChange={v => setOtherIncomeForm({...otherIncomeForm, method: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Note (optional)</Label>
              <Input value={otherIncomeForm.note} onChange={e => setOtherIncomeForm({...otherIncomeForm, note: e.target.value})} placeholder="Additional details..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtherIncomeOpen(false)}>Cancel</Button>
            <Button onClick={saveOtherIncome}>Record Income</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the payment of{" "}
              <strong>{deleting && formatUGX(deleting.amount_paid)}</strong> for{" "}
              <strong>{deleting?.student_name}</strong> and remove it from the Accounts ledger. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Record & Transaction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string; color: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
        <div className={`h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid")    return <Badge className="bg-green-600 text-white text-xs">Paid</Badge>;
  if (status === "partial") return <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">Partial</Badge>;
  return <Badge variant="destructive" className="text-xs">Pending</Badge>;
}