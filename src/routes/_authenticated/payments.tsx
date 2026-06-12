import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, Receipt, AlertCircle, CheckCircle2,
  Loader2, Search, CreditCard, TrendingUp, Users, Clock,
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

// ── Course definitions ─────────────────────────────────────────────────────
const COURSES: Record<string, { label: string; fee: number; levels: string[] }> = {
  english:          { label: "English",           fee: 150000, levels: ["Zero Level", "Pre Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"] },
  computer:         { label: "Computer",          fee: 120000, levels: ["Beginner", "Intermediate", "Advanced"] },
  computer_english: { label: "Computer & English", fee: 200000, levels: ["Zero Level", "Pre Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"] },
  french:           { label: "French",            fee: 150000, levels: ["Beginner", "Intermediate", "Advanced"] },
  kiswahili:        { label: "Kiswahili",         fee: 150000, levels: ["Beginner", "Intermediate", "Advanced"] },
  private_class:    { label: "Private Class",     fee: 250000, levels: ["Private"] },
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
  const [y, m] = my.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-UG", {
    month: "long", year: "numeric",
  });
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
  status: string; note?: string;
};

type PaymentForm = {
  student_id: string; student_name: string; reg_no: string;
  course: string; level: string;
  amount_due: number; amount_paid: string;
  method: string; payment_date: string; month_year: string; note: string;
};

const emptyForm = (): PaymentForm => ({
  student_id: "", student_name: "", reg_no: "",
  course: "english", level: "",
  amount_due: 0, amount_paid: "",
  method: "cash",
  payment_date: new Date().toISOString().slice(0, 10),
  month_year: currentMonthYear(),
  note: "",
});

// ── Page ───────────────────────────────────────────────────────────────────
function PaymentsPage() {
  const [students, setStudents]     = useState<Student[]>([]);
  const [payments, setPayments]     = useState<Payment[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [tab, setTab]                     = useState<"records" | "overdue">("records");
  const [courseFilter, setCourseFilter]   = useState("all");
  const [levelFilter, setLevelFilter]     = useState("all");
  const [monthFilter, setMonthFilter]     = useState(currentMonthYear());
  const [search, setSearch]               = useState("");

  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const [form, setForm]         = useState<PaymentForm>(emptyForm());

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from("students").select("*").eq("status", "active").order("name"),
      supabase.from("payments").select("*").order("payment_date", { ascending: false }),
    ]);
    setStudents((s ?? []) as Student[]);
    setPayments((p ?? []) as Payment[]);
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

  useEffect(() => { setLevelFilter("all"); }, [courseFilter]);

  const overdueStudents = useMemo(() => {
    const paidThisMonth = new Set(
      payments.filter(p => p.month_year === currentMonthYear() && p.status === "paid").map(p => p.student_id)
    );
    return students.filter(s => !paidThisMonth.has(s.id));
  }, [students, payments]);

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
      outstanding: thisMonth.reduce((s, p) => s + p.balance, 0),
      overdue:     overdueStudents.length,
    };
  }, [payments, overdueStudents]);

  const openNew = (student?: Student) => {
    setEditing(null);
    if (student) {
      const fee = COURSES[student.course]?.fee ?? 0;
      setForm({ ...emptyForm(), student_id: student.id, student_name: student.name,
        reg_no: student.reg_no, course: student.course, level: student.level, amount_due: fee });
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
      amount_due: p.amount_due, amount_paid: String(p.amount_paid),
      method: p.method, payment_date: p.payment_date,
      month_year: p.month_year, note: p.note ?? "",
    });
    setOpen(true);
  };

  const onStudentSelect = (studentId: string) => {
    const s = students.find(x => x.id === studentId);
    if (!s) return;
    const fee = COURSES[s.course]?.fee ?? 0;
    setForm(f => ({ ...f, student_id: s.id, student_name: s.name,
      reg_no: s.reg_no, course: s.course, level: s.level, amount_due: fee }));
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

    if (editing) {
      const { error } = await supabase.from("payments").update({
        amount_due: due, amount_paid: paid, balance,
        method: form.method, payment_date: form.payment_date,
        month_year: form.month_year, level: form.level, status, note: form.note,
      }).eq("id", editing.id);
      
      if (error) { toast.error("Update failed: " + error.message); setSubmitting(false); return; }
      toast.success("Payment updated");
    } else {
      const { error } = await supabase.from("payments").insert({
        student_id: form.student_id, student_name: form.student_name,
        reg_no: form.reg_no, course: form.course, level: form.level,
        amount_due: due, amount_paid: paid, balance,
        method: form.method, payment_date: form.payment_date,
        month_year: form.month_year, status, note: form.note,
      });
      
      if (error) { toast.error("Failed to record: " + error.message); setSubmitting(false); return; }

      // Update student balance + last_payment_date
      await supabase.from("students").update({
        balance,
        last_payment_date: form.payment_date,
      }).eq("id", form.student_id);

      if (paid > 0) {
        await supabase.from("transactions").insert({
          type: "income", amount: paid, date: form.payment_date,
          description: `Monthly payment — ${form.student_name} (${form.reg_no}) ${form.level ? `[${form.level}]` : ""} ${formatMonthYear(form.month_year)}`,
        });
      }

      toast.success("Payment recorded", {
        description: balance > 0
          ? `Balance of ${formatUGX(balance)} outstanding`
          : "Fully paid for this month",
      });
    }

    setOpen(false);
    setSubmitting(false);
    fetchAll();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("payments").delete().eq("id", deleting.id);
    if (error) { toast.error("Delete failed: " + error.message); return; }
    toast.success("Payment record removed");
    setDeleting(null);
    fetchAll();
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
          <h1 className="text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-muted-foreground mt-1">
            Monthly student fee collection — {formatMonthYear(currentMonthYear())}
          </p>
        </div>
        <Button onClick={() => openNew()}>
          <Plus className="h-4 w-4 mr-1" /> Record Payment
        </Button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Collected This Month"
          value={formatUGX(stats.collected)} color="text-green-600" />
        <StatCard icon={<CreditCard className="h-5 w-5" />} label="Outstanding This Month"
          value={formatUGX(stats.outstanding)}
          color={stats.outstanding > 0 ? "text-destructive" : "text-muted-foreground"} />
        <StatCard icon={<Users className="h-5 w-5" />} label="Yet to Pay This Month"
          value={`${stats.overdue} student${stats.overdue !== 1 ? "s" : ""}`}
          color={stats.overdue > 0 ? "text-amber-600" : "text-muted-foreground"} />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="records">Payment Records</TabsTrigger>
          <TabsTrigger value="overdue" className="gap-2">
            Awaiting Payment
            {stats.overdue > 0 && (
              <Badge variant="destructive" className="text-xs h-5 px-1.5">{stats.overdue}</Badge>
            )}
          </TabsTrigger>
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
              <span className="text-sm text-muted-foreground ml-auto">
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
                <p className="text-sm">Adjust filters or record a new payment</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Reg No</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Month</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{p.payment_date}</TableCell>
                      <TableCell className="font-medium">{p.student_name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.reg_no}</TableCell>
                      <TableCell>{COURSES[p.course]?.label ?? p.course}</TableCell>
                      <TableCell>
                        {p.level ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                            {p.level}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-sm">{formatMonthYear(p.month_year)}</TableCell>
                      <TableCell className="capitalize">{p.method.replace("_", " ")}</TableCell>
                      <TableCell className="text-right">{formatUGX(p.amount_due)}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">{formatUGX(p.amount_paid)}</TableCell>
                      <TableCell className={`text-right font-medium ${p.balance > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {p.balance > 0 ? formatUGX(p.balance) : "—"}
                      </TableCell>
                      <TableCell> <StatusBadge status={p.status} /> </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleting(p)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* ── Awaiting Tab ── */}
        <TabsContent value="overdue" className="mt-4">
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-sm">
                Students who have not paid for {formatMonthYear(currentMonthYear())}
              </span>
              <Badge variant="outline" className="ml-auto">{overdueStudents.length} students</Badge>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading...
              </div>
            ) : overdueStudents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
                <p className="font-medium text-green-600">All students are paid up this month!</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reg No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead className="text-right">Monthly Fee</TableHead>
                    <TableHead className="text-right">Carried Balance</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueStudents.map(s => (
                    <TableRow key={s.id} className="bg-amber-50/40 dark:bg-amber-950/10">
                      <TableCell className="font-mono text-xs">{s.reg_no}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{COURSES[s.course]?.label ?? s.course}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                          {s.level}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{formatUGX(COURSES[s.course]?.fee ?? 0)}</TableCell>
                      <TableCell className={`text-right font-medium ${s.balance > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                        {s.balance > 0 ? formatUGX(s.balance) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => { openNew(s); setTab("records"); }}>
                          <Plus className="h-3 w-3 mr-1" /> Record Payment
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Payment Dialog ── */}
      <Dialog open={open} onOpenChange={o => !o && setOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Payment" : "Record Payment"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {!editing ? (
              <div className="grid gap-2">
                <Label>Student <span className="text-destructive">*</span></Label>
                <Select value={form.student_id} onValueChange={onStudentSelect}>
                  <SelectTrigger> <SelectValue placeholder="Select a student..." /> </SelectTrigger>
                  <SelectContent>
                    {students.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {s.reg_no} ({COURSES[s.course]?.label ?? s.course})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                <span className="font-medium">{form.student_name}</span>
                <span className="text-muted-foreground ml-2">({form.reg_no})</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Course</Label>
                <Select value={form.course} onValueChange={v => {
                  const levels = COURSES[v]?.levels ?? [];
                  setForm(f => ({ ...f, course: v, level: levels[0] ?? "", amount_due: COURSES[v]?.fee ?? 0 }));
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

            <div className="grid gap-2">
              <Label>Payment Month</Label>
              <Input type="month" value={form.month_year}
                onChange={e => setForm(f => ({ ...f, month_year: e.target.value }))} />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Amount Due (UGX)</Label>
                <Input type="number" value={form.amount_due}
                  onChange={e => setForm(f => ({ ...f, amount_due: Number(e.target.value) }))} />
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
                {Number(form.amount_paid) >= form.amount_due
                  ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                  : <AlertCircle className="h-4 w-4 shrink-0" />}
                {Number(form.amount_paid) >= form.amount_due
                  ? "Full payment — no balance will remain"
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
                placeholder="e.g. partial payment, school fee waiver..." />
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

      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the payment of{" "}
              <strong>{deleting && formatUGX(deleting.amount_paid)}</strong> for{" "}
              <strong>{deleting?.student_name}</strong>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Record
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