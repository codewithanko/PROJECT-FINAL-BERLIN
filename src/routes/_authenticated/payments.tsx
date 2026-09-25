import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, Receipt, AlertCircle, CheckCircle2,
  Loader2, Search, CreditCard, TrendingUp, Users, Clock, Banknote, Calendar, Download, Award
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
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-UG", { month: "long", year: "numeric" });
}

type Student = {
  id: string; name: string; reg_no: string;
  course: string; level: string; status: string; balance: number;
  agreed_fee?: number | null;
};

type Payment = {
  id: string; student_id: string; student_name: string;
  reg_no: string; course: string; level: string;
  amount_due: number; amount_paid: number; balance: number;
  method: string; payment_date: string; month_year: string;
  status: string; note?: string; months_covered?: number;
  transaction_id?: string | null;
  category?: "tuition" | "certificate";
};

type PaymentForm = {
  student_id: string; student_name: string; reg_no: string;
  course: string; level: string;
  current_balance: number; 
  amount_due: number; // ✅ NEW: Total amount due for this specific transaction
  amount_paid: string;
  method: string; payment_date: string; 
  start_month: string; 
  num_months: number;  
  note: string;
  category: "tuition" | "certificate";
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
  category: "tuition",
});

function PaymentsPage() {
  const [students, setStudents]     = useState<Student[]>([]);
  const [payments, setPayments]     = useState<Payment[]>([]);
  const [otherIncome, setOtherIncome] = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [tab, setTab]                     = useState<"records" | "overdue" | "other" | "certificates">("records");
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

  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().slice(0,10));
  const dailyStats = useMemo(() => {
    const dayPayments = payments.filter(p => p.payment_date === dailyDate);
    const dayOther = otherIncome.filter(o => o.date === dailyDate);
    return {
      income: dayPayments.reduce((s,p)=>s+p.amount_paid,0) + dayOther.reduce((s,o)=>s+o.amount,0),
      count: dayPayments.length + dayOther.length,
    };
  }, [payments, otherIncome, dailyDate]);

  const fetchOtherIncome = async () => {
    const { data } = await supabase.from("transactions").select("*").like("description", "%Other Income:%").order("date", { ascending: false });
    if (data) {
      setOtherIncome(data.map(t => {
        const cleanDesc = (t.description || "").replace(/^Money In \| /, "");
        const parts = cleanDesc.replace("Other Income: ", "").split(" | ");
        return {
          id: t.id, source: parts[0] || "Unknown", method: parts[1]?.replace("Method: ", "") || "cash",
          note: parts[2]?.replace("Note: ", "") || "", amount: Number(t.amount), date: t.date,
        };
      }));
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from("students").select("*").in("status", ["active", "promoted"]).order("name"),
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
      const matchSearch = !studentSearch || s.name.toLowerCase().includes(studentSearch.toLowerCase()) || s.reg_no.toLowerCase().includes(studentSearch.toLowerCase());
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
      const matchSearch = !search || p.student_name.toLowerCase().includes(search.toLowerCase()) || p.reg_no.toLowerCase().includes(search.toLowerCase());
      return matchMonth && matchCourse && matchLevel && matchSearch;
    });
  }, [payments, monthFilter, courseFilter, levelFilter, search]);

  const stats = useMemo(() => {
    const ym = currentMonthYear();
    const collected = payments.filter(p => p.payment_date?.slice(0,7) === ym).reduce((s,p)=>s+p.amount_paid,0) + otherIncome.filter(o => o.date?.slice(0,7) === ym).reduce((s,o)=>s+o.amount,0);
    return { 
      collected, 
      outstanding: students.reduce((sum, s) => sum + (s.balance > 0 ? s.balance : 0), 0),
      overdue: overdueStudents.length 
    };
  }, [payments, otherIncome, students, overdueStudents]);

  const selectStudent = (s: Student) => {
    const monthlyFee = s.agreed_fee ?? COURSES[s.course]?.fee ?? 0;
    const oldBalance = s.balance > 0 ? s.balance : 0;
    
    // ✅ NEW: Automatically calculate Total Due = Old Balance + 1 Month Fee
    const totalDue = oldBalance + monthlyFee;

    setForm(f => ({
      ...f,
      student_id: s.id,
      student_name: s.name,
      reg_no: s.reg_no,
      course: s.course,
      level: s.level,
      current_balance: oldBalance,
      amount_due: totalDue, // ✅ Set the total due for this transaction
      amount_paid: "",
      start_month: currentMonthYear(),
      num_months: 1,
      note: "",
    }));
    setStudentSearch("");
  };

  const openNew = (student?: Student) => {
    setEditing(null);
    setStudentSearch("");
    setStudentCourseFilter("all");
    setStudentLevelFilter("all");
    if (student) {
      const monthlyFee = student.agreed_fee ?? COURSES[student.course]?.fee ?? 0;
      const oldBalance = student.balance > 0 ? student.balance : 0;
      const totalDue = oldBalance + monthlyFee;

      setForm({
        ...emptyForm(),
        student_id: student.id,
        student_name: student.name,
        reg_no: student.reg_no,
        course: student.course,
        level: student.level,
        current_balance: oldBalance,
        amount_due: totalDue,
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
      current_balance: p.balance + p.amount_paid, 
      amount_due: p.amount_due,
      amount_paid: String(p.amount_paid),
      method: p.method, payment_date: p.payment_date,
      start_month: p.month_year,
      num_months: p.months_covered || 1,
      note: p.note ?? "",
      category: (p.category as "tuition" | "certificate") || "tuition",
    });
    setOpen(true);
  };

  // ✅ BULLETPROOF MATH: New Balance = Total Amount Due - Amount Paid
  const save = async () => {
    if (!form.student_id) return toast.error("Please select a student");
    if (!form.amount_paid || Number(form.amount_paid) <= 0) return toast.error("Enter a valid amount paid");
    
    const paid = Number(form.amount_paid);
    // ✅ The magic math: Total Due (Old Balance + New Month) minus what they just paid
    const newBalance = Math.max(0, form.amount_due - paid);
    const status = newBalance === 0 ? "paid" : paid > 0 ? "partial" : "pending";

    setSubmitting(true);

    const desc = form.category === "certificate" 
      ? `Money In | Certificate Fee — ${form.student_name} (${form.reg_no})${form.note ? ` | ${form.note}` : ""}`
      : `Money In | Tuition Payment — ${form.student_name} (${form.reg_no}) ${form.level ? `[${form.level}]` : ""} (${form.num_months} month${form.num_months > 1 ? "s" : ""})`;

    if (editing) {
      const { error } = await supabase.from("payments").update({
        amount_due: form.amount_due, amount_paid: paid, balance: newBalance,
        method: form.method, payment_date: form.payment_date,
        month_year: form.start_month, months_covered: form.num_months,
        status, note: form.note, category: form.category
      }).eq("id", editing.id);
      
      if (error) { toast.error("Update failed: " + error.message); setSubmitting(false); return; }

      const existingTxId = (editing as any).transaction_id;
      if (paid > 0) {
        if (existingTxId) {
          await supabase.from("transactions").update({ amount: paid, date: form.payment_date, description: desc }).eq("id", existingTxId);
        } else {
          const { data: txData } = await supabase.from("transactions").insert({ type: "income", amount: paid, date: form.payment_date, description: desc }).select().single();
          if (txData) await supabase.from("payments").update({ transaction_id: txData.id }).eq("id", editing.id);
        }
      } else if (existingTxId) {
        await supabase.from("transactions").delete().eq("id", existingTxId);
        await supabase.from("payments").update({ transaction_id: null }).eq("id", editing.id);
      }

      // Revert old payment, apply new payment
      const balanceDiff = paid - editing.amount_paid;
      const { data: currentStudent } = await supabase.from("students").select("balance, last_payment_date").eq("id", form.student_id).single();
      const finalBalance = (currentStudent?.balance || 0) - balanceDiff;
      
      await supabase.from("students").update({ 
        balance: Math.max(0, finalBalance),
        last_payment_date: paid > 0 ? form.payment_date : (currentStudent?.last_payment_date || null)
      }).eq("id", form.student_id);
      
      toast.success("Payment updated");
    } else {
      let transactionId: string | null = null;
      if (paid > 0) {
        const { data: txData } = await supabase.from("transactions").insert({ type: "income", amount: paid, date: form.payment_date, description: desc }).select().single();
        if (txData) transactionId = txData.id;
      }

      await supabase.from("payments").insert({
        student_id: form.student_id, student_name: form.student_name, reg_no: form.reg_no,
        course: form.course, level: form.level, amount_due: form.amount_due, amount_paid: paid, balance: newBalance,
        method: form.method, payment_date: form.payment_date, month_year: form.start_month,
        months_covered: form.num_months, status, note: form.note, transaction_id: transactionId, category: form.category
      });

      // Only update student balance for TUITION.
      if (form.category === "tuition") {
        await supabase.from("students").update({ 
          balance: newBalance,
          last_payment_date: form.payment_date
        }).eq("id", form.student_id);
      }

      toast.success(form.category === "certificate" ? "Certificate payment recorded" : "Payment recorded", {
        description: form.category === "tuition" ? `Remaining balance: ${formatUGX(newBalance)}` : undefined
      });
    }

    setOpen(false);
    setSubmitting(false);
    fetchAll();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const txId = (deleting as any).transaction_id;
    if (txId) await supabase.from("transactions").delete().eq("id", txId);

    if (deleting.category !== "certificate") {
      const balanceDiff = 0 - deleting.amount_paid;
      const { data: currentStudent } = await supabase.from("students").select("balance").eq("id", deleting.student_id).single();
      await supabase.from("students").update({ balance: Math.max(0, (currentStudent?.balance || 0) - balanceDiff) }).eq("id", deleting.student_id);
    }

    const { error } = await supabase.from("payments").delete().eq("id", deleting.id);
    if (error) { toast.error("Delete failed: " + error.message); return; }
    
    toast.success("Record removed");
    setDeleting(null);
    fetchAll();
  };

  const saveOtherIncome = async () => {
    if (!otherIncomeForm.source.trim() || !otherIncomeForm.amount) return toast.error("Source and amount required");
    const desc = `Money In | Other Income: ${otherIncomeForm.source} | Method: ${otherIncomeForm.method} | Note: ${otherIncomeForm.note}`;
    const { error } = await supabase.from("transactions").insert({ type: "income", amount: Number(otherIncomeForm.amount), date: otherIncomeForm.date, description: desc });
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

  const exportAllCSV = () => {
    if (payments.length === 0) return toast.error("No data to export");
    const headers = ["Date", "Student", "Reg No", "Course", "Level", "Method", "Amount Paid", "Remaining Balance", "Category", "Note"];
    const rows = payments.map(p => [
      p.payment_date, `"${p.student_name.replace(/"/g, '""')}"`, p.reg_no, COURSES[p.course]?.label ?? p.course, p.level || "—",
      p.method.replace("_", " "), p.amount_paid, p.balance, p.category || "tuition", `"${(p.note || "").replace(/"/g, '""')}"`
    ].join(","));
    const blob = new Blob([["\uFEFF", headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.setAttribute("download", `all_payments_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    toast.success("Exported successfully");
  };

  const formLevels = useMemo(() => COURSES[form.course]?.levels ?? [], [form.course]);
  const monthlyFee = useMemo(() => students.find(s => s.id === form.student_id)?.agreed_fee ?? COURSES[form.course]?.fee ?? 0, [students, form.student_id, form.course]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments & Revenue</h1>
          <p className="text-muted-foreground mt-1">Manage tuition, certificates, and other income with bulletproof balance tracking.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setOtherIncomeOpen(true)}><Banknote className="h-4 w-4 mr-1" /> Other Income</Button>
          <Button onClick={() => openNew()}><Plus className="h-4 w-4 mr-1" /> Record Payment</Button>
        </div>
      </header>

      <Card className="p-5 border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs font-semibold">Daily Collections</Label>
          <Input type="date" value={dailyDate} onChange={e=>setDailyDate(e.target.value)} className="w-[150px] h-8" />
        </div>
        <p className="text-2xl font-bold text-emerald-600">{formatUGX(dailyStats.income)}</p>
        <p className="text-xs text-muted-foreground">{dailyStats.count} transaction{dailyStats.count!==1?"s":""} today</p>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Collected This Month" value={formatUGX(stats.collected)} color="text-green-600" />
        <StatCard icon={<CreditCard className="h-5 w-5" />} label="Total Debt Owed" value={formatUGX(stats.outstanding)} color={stats.outstanding > 0 ? "text-destructive" : "text-muted-foreground"} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Students with Debt" value={`${stats.overdue} student${stats.overdue !== 1 ? "s" : ""}`} color={stats.overdue > 0 ? "text-amber-600" : "text-muted-foreground"} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="records">Tuition Payments</TabsTrigger>
          <TabsTrigger value="overdue" className="gap-2">Clear Debts {stats.overdue > 0 && <Badge variant="destructive" className="text-xs h-5 px-1.5">{stats.overdue}</Badge>}</TabsTrigger>
          <TabsTrigger value="certificates" className="gap-2"><Award className="h-4 w-4" /> Certificates</TabsTrigger>
          <TabsTrigger value="other">Other Income</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student..." className="pl-9" />
              </div>
              <Select value={monthFilter} onValueChange={setMonthFilter}>
                <SelectTrigger className="w-[175px]"> <SelectValue placeholder="Month" /> </SelectTrigger>
                <SelectContent>{[...new Set(payments.map(p => p.month_year))].sort().reverse().map(m => (<SelectItem key={m} value={m}>{formatMonthYear(m)}</SelectItem>))}</SelectContent>
              </Select>
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="default" size="sm" onClick={exportAllCSV}><Download className="h-4 w-4 mr-1" /> Export All</Button>
              </div>
            </div>
            {loading ? (<div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>) : filteredPayments.filter(p => p.category !== "certificate").length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2"><Receipt className="h-8 w-8" /><p className="font-medium">No tuition records found</p></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Reg No</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Remaining Balance</TableHead><TableHead>Status</TableHead><TableHead className="w-20">Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.filter(p => p.category !== "certificate").map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{p.payment_date}</TableCell>
                      <TableCell className="font-medium">{p.student_name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.reg_no}</TableCell>
                      <TableCell className="capitalize">{p.method.replace("_", " ")}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">{formatUGX(p.amount_paid)}</TableCell>
                      <TableCell className={`text-right font-medium ${p.balance > 0 ? "text-destructive" : "text-muted-foreground"}`}>{p.balance > 0 ? formatUGX(p.balance) : "Cleared"}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleting(p)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="overdue" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1"><Clock className="h-4 w-4 text-amber-500" /><span className="font-semibold text-sm">Students with Outstanding Balances</span><Badge variant="outline" className="ml-2">{overdueStudents.length} students</Badge></div>
              <Select value={overdueCourseFilter} onValueChange={setOverdueCourseFilter}>
                <SelectTrigger className="w-[180px]"> <SelectValue placeholder="Filter Course" /> </SelectTrigger>
                <SelectContent><SelectItem value="all">All Courses</SelectItem>{Object.entries(COURSES).map(([k, v]) => (<SelectItem key={k} value={k}>{v.label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            {loading ? (<div className="flex items-center justify-center py-16 gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading...</div>) : overdueStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2"><CheckCircle2 className="h-8 w-8 text-green-500" /><p className="font-medium text-green-600">All students are fully paid up!</p></div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Reg No</TableHead><TableHead>Name</TableHead><TableHead>Course</TableHead><TableHead className="text-right">Total Balance Owed</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {overdueStudents.map(s => (
                    <TableRow key={s.id} className="bg-amber-50/40 dark:bg-amber-950/10">
                      <TableCell className="font-mono text-xs">{s.reg_no}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{COURSES[s.course]?.label ?? s.course}</TableCell>
                      <TableCell className="text-right font-bold text-destructive text-lg">{formatUGX(s.balance)}</TableCell>
                      <TableCell className="text-right"><Button size="sm" onClick={() => { openNew(s); setTab("records"); }} className="bg-emerald-600 hover:bg-emerald-700 text-white"><Plus className="h-3 w-3 mr-1" /> Record Payment</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="certificates" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" /><span className="font-semibold">Certificate Fees Collected</span></div>
              <Badge variant="outline" className="text-sm font-semibold">Total Revenue: {formatUGX(payments.filter(p => p.category === "certificate").reduce((sum, p) => sum + p.amount_paid, 0))}</Badge>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Student</TableHead><TableHead>Reg No</TableHead><TableHead>Method</TableHead><TableHead>Note</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
              <TableBody>
                {payments.filter(p => p.category === "certificate").length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No certificate fees recorded yet.</TableCell></TableRow>
                ) : (
                  payments.filter(p => p.category === "certificate").map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{p.payment_date}</TableCell>
                      <TableCell className="font-medium">{p.student_name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.reg_no}</TableCell>
                      <TableCell className="capitalize">{p.method.replace("_", " ")}</TableCell>
                      <TableCell className="text-muted-foreground">{p.note || "—"}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">{formatUGX(p.amount_paid)}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleting(p)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="other" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2"><Banknote className="h-5 w-5 text-emerald-500" /><span className="font-semibold">Other Income Sources</span></div>
              <Badge variant="outline">{otherIncome.length} records</Badge>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Method</TableHead><TableHead>Note</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
              <TableBody>
                {otherIncome.length === 0 ? (<TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No other income recorded yet.</TableCell></TableRow>) : (
                  otherIncome.map(inc => (
                    <TableRow key={inc.id}>
                      <TableCell className="font-mono text-xs">{inc.date}</TableCell>
                      <TableCell className="font-medium">{inc.source}</TableCell>
                      <TableCell className="capitalize">{inc.method.replace("_", " ")}</TableCell>
                      <TableCell className="text-muted-foreground">{inc.note || "—"}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">{formatUGX(inc.amount)}</TableCell>
                      <TableCell><Button size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteOtherIncome(inc.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Payment" : "Record Payment"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            {!editing ? (
              <div className="grid gap-2">
                <Label>Search Student <span className="text-destructive">*</span></Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={studentCourseFilter} onValueChange={setStudentCourseFilter}>
                    <SelectTrigger><SelectValue placeholder="Filter Course" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Courses</SelectItem>{Object.entries(COURSES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={studentLevelFilter} onValueChange={setStudentLevelFilter}>
                    <SelectTrigger><SelectValue placeholder="Filter Level" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All Levels</SelectItem>{dialogFilterLevels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Type name or reg no..." value={studentSearch} onChange={e => setStudentSearch(e.target.value)} />
                </div>
                {studentSearch && (
                  <div className="border rounded-md max-h-48 overflow-y-auto bg-card shadow-lg z-50 relative">
                    {dialogFilteredStudents.length === 0 ? (<div className="p-3 text-sm text-muted-foreground text-center">No students found</div>) : (
                      dialogFilteredStudents.map(s => (
                        <button key={s.id} type="button" onClick={() => selectStudent(s)} className="w-full text-left p-3 hover:bg-accent border-b last:border-0 transition-colors">
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
                <div><span className="font-medium">{form.student_name}</span><span className="text-muted-foreground ml-2">({form.reg_no})</span></div>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Payment Type</Label>
              <Select value={form.category} onValueChange={(v: any) => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tuition">Tuition / Course Fees</SelectItem>
                  <SelectItem value="certificate">Certificate Fee</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.student_id && (
              <div className="rounded-lg border bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Selected: {form.student_name}</span>
                  {!editing && form.category === "tuition" && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setForm(f => ({ ...f, student_id: "", student_name: "", reg_no: "", current_balance: 0, amount_due: 0, amount_paid: "" }))}>Change</Button>
                  )}
                </div>
                
                {form.category === "tuition" ? (
                  <>
                    {/* ✅ NEW: Visual Math Breakdown */}
                    <div className="space-y-2 p-3 bg-background rounded-md border">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Outstanding from before:</span>
                        <span className="font-medium text-destructive">{formatUGX(form.current_balance)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Current month fee ({form.num_months} mo):</span>
                        <span className="font-medium">{formatUGX(monthlyFee * form.num_months)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-sm font-bold text-primary">
                        <span>Total Amount Due:</span>
                        <span>{formatUGX(form.amount_due)}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between items-center p-3 bg-background rounded-md border">
                    <span className="text-sm text-muted-foreground">Certificate Fee (Negotiable Amount)</span>
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label>Amount Paying Now (UGX) <span className="text-destructive">*</span></Label>
              <Input type="number" value={form.amount_paid} min={0} onChange={e => setForm(f => ({ ...f, amount_paid: e.target.value }))} placeholder="Enter amount" />
            </div>

            {form.amount_paid !== "" && form.category === "tuition" && (
              <div className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium border ${
                Number(form.amount_paid) >= form.amount_due
                  ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300"
                  : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300"
              }`}>
                <span>Remaining Balance After This Payment:</span>
                <span className="text-lg font-bold">{formatUGX(Math.max(0, form.amount_due - Number(form.amount_paid)))}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Payment Method</Label>
                <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                  <SelectTrigger> <SelectValue /> </SelectTrigger>
                  <SelectContent>{METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2"><Label>Payment Date</Label><Input type="date" value={form.payment_date} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} /></div>
            </div>

            <div className="grid gap-2">
              <Label>Note (optional)</Label>
              <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder={form.category === "certificate" ? "e.g. Hard copy, laminated..." : "e.g. clearing admission balance..."} />
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

      <Dialog open={otherIncomeOpen} onOpenChange={setOtherIncomeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Other Income</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Source / Description <span className="text-destructive">*</span></Label><Input value={otherIncomeForm.source} onChange={e => setOtherIncomeForm({...otherIncomeForm, source: e.target.value})} placeholder="e.g. Donation, Event Income..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2"><Label>Amount (UGX) <span className="text-destructive">*</span></Label><Input type="number" value={otherIncomeForm.amount} onChange={e => setOtherIncomeForm({...otherIncomeForm, amount: e.target.value})} placeholder="0" /></div>
              <div className="grid gap-2"><Label>Date</Label><Input type="date" value={otherIncomeForm.date} onChange={e => setOtherIncomeForm({...otherIncomeForm, date: e.target.value})} /></div>
            </div>
            <div className="grid gap-2"><Label>Payment Method</Label>
              <Select value={otherIncomeForm.method} onValueChange={v => setOtherIncomeForm({...otherIncomeForm, method: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Note (optional)</Label><Input value={otherIncomeForm.note} onChange={e => setOtherIncomeForm({...otherIncomeForm, note: e.target.value})} placeholder="Additional details..." /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOtherIncomeOpen(false)}>Cancel</Button><Button onClick={saveOtherIncome}>Record Income</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this payment record?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the payment of <strong>{deleting && formatUGX(deleting.amount_paid)}</strong> for <strong>{deleting?.student_name}</strong> and restore the student's balance. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Record</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string; }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div><p className="text-xs text-muted-foreground">{label}</p><p className={`text-xl font-bold mt-1 ${color}`}>{value}</p></div>
        <div className={`h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center ${color}`}>{icon}</div>
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "paid") return <Badge className="bg-green-600 text-white text-xs">Paid</Badge>;
  if (status === "partial") return <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">Partial</Badge>;
  return <Badge variant="destructive" className="text-xs">Pending</Badge>;
}