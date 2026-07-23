import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Pencil, GraduationCap, ArrowUpCircle, Plus, Search,
  Trash2, Loader2, Clock, AlertTriangle, CheckCircle2, Info,
  MoreVertical, ArrowUp, ArrowDown, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx"; // ✅ Professional Excel Export

export const Route = createFileRoute("/_authenticated/students")({
  validateSearch: (search) => ({
    search: (search.search as string) || "",
  }),
  head: () => ({ meta: [{ title: "Students — Sandstone School" }] }),
  component: StudentsPage,
});

// ── COURSES ──
export const COURSES: Record<string, { label: string; fee: number; levels: string[] }> = {
  english: { label: "English", fee: 130000, levels: ["Zero Level", "Pre Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"] },
  computer: { label: "Computer", fee: 150000, levels: ["Beginner", "Intermediate", "Advanced"] },
  computer_english: { label: "Computer & English", fee: 230000, levels: ["Zero Level", "Pre Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"] },
  french: { label: "French", fee: 150000, levels: ["Beginner", "Intermediate", "Advanced"] },
  kiswahili: { label: "Kiswahili", fee: 300000, levels: ["Beginner", "Intermediate", "Advanced"] },
  german: { label: "German", fee: 300000, levels: ["Beginner", "Intermediate", "Advanced"] },
  private_class: { label: "Private Class", fee: 300000, levels: ["Private"] },
  private_class_2: { label: "Private Class 2", fee: 500000, levels: ["Private"] },
};
export type CourseKey = keyof typeof COURSES;

export function formatUGX(amount: number) {
  return `UGX ${amount.toLocaleString("en-UG")}`;
}

type Status = "active" | "promoted" | "graduated";
type Student = {
  id: string;
  name: string;
  reg_no: string;
  course: CourseKey;
  level: string;
  status: Status;
  balance: number;
  last_payment_date: string | null;
  payment_cycle_days: number;
  paid_until: string | null;
  enrolled_date: string | null;
  created_at: string;
};

type PaymentRecord = {
  id: string;
  student_id: string;
  amount_due: number;
  amount_paid: number;
  balance: number;
  method: string;
  payment_date: string;
  month_year: string;
  months_covered?: number;
  status: string;
  note?: string;
};

const statusVariant = (s: Status): "secondary" | "default" | "outline" =>
  s === "graduated" ? "secondary" : s === "promoted" ? "default" : "outline";

function getTenure(enrolledDate: string | null, createdAt: string) {
  const start = new Date(enrolledDate ?? createdAt);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  let days = now.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) { months = 0; days = 0; }
  const parts: string[] = [];
  if (months > 0) parts.push(`${months} month${months !== 1 ? "s" : ""}`);
  parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  return parts.join(", ");
}

function NextPaymentInfo({ student }: { student: Student }) {
  if (student.status === "graduated") return <span className="text-muted-foreground text-xs">—</span>;
  
  let nextDue: Date | null = null;
  if (student.paid_until) nextDue = new Date(student.paid_until);
  else if (student.last_payment_date) {
    const last = new Date(student.last_payment_date);
    const cycleDays = student.payment_cycle_days ?? 30;
    nextDue = new Date(last);
    nextDue.setDate(nextDue.getDate() + cycleDays);
  }

  if (!nextDue) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive font-medium">
        <AlertTriangle className="h-3 w-3" /> Awaiting First Payment
      </span>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  nextDue.setHours(0, 0, 0, 0);
  
  const days = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formattedDate = nextDue.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  if (days < 0) {
    return (
      <div className="flex flex-col">
        <span className="inline-flex items-center gap-1 text-xs text-destructive font-semibold">
          <AlertTriangle className="h-3 w-3" /> Overdue ({Math.abs(days)}d)
        </span>
        <span className="text-[10px] text-muted-foreground">Was due {formattedDate}</span>
      </div>
    );
  }
  if (days === 0) {
    return (
      <div className="flex flex-col">
        <span className="inline-flex items-center gap-1 text-xs text-destructive font-semibold">
          <AlertTriangle className="h-3 w-3" /> Due Today
        </span>
        <span className="text-[10px] text-muted-foreground">{formattedDate}</span>
      </div>
    );
  }
  if (days <= 5) {
    return (
      <div className="flex flex-col">
        <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
          <Clock className="h-3 w-3" /> Due in {days}d
        </span>
        <span className="text-[10px] text-muted-foreground">Due {formattedDate}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
        <CheckCircle2 className="h-3 w-3" /> {days}d left
      </span>
      <span className="text-[10px] text-muted-foreground">Due {formattedDate}</span>
    </div>
  );
}

function formatMonthLabel(my: string) {
  if (!my) return "—";
  const [y, m] = my.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-UG", {
    month: "long", year: "numeric",
  });
}

function StudentsPage() {
  const navigate = useNavigate();
  const { search: urlSearch } = Route.useSearch(); 
  
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(urlSearch); 
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // ✅ NEW: Advanced Filters
  const [filterYear, setFilterYear] = useState<string>("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [balanceFilter, setBalanceFilter] = useState<string>("all"); // "all" or "owing"
  
  const [sortField, setSortField] = useState<'name' | 'reg_no' | 'balance'>('reg_no');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const [editing, setEditing] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState<Student[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [viewing, setViewing] = useState<Student | null>(null);
  const [viewingPayments, setViewingPayments] = useState<PaymentRecord[]>([]);
  const [viewingLoading, setViewingLoading] = useState(false);

  useEffect(() => { setQuery(urlSearch); }, [urlSearch]);

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("created_at", { ascending: true });
    
    if (error) toast.error("Failed to load students: " + error.message);
    else setStudents((data ?? []) as Student[]);
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, []);

  const renumberStudents = async (currentList: Student[]) => {
    const sorted = [...currentList].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    await Promise.all(
      sorted.map((student, index) => 
        supabase.from("students").update({ reg_no: `SSL-${String(index + 1).padStart(4, "0")}` }).eq("id", student.id)
      )
    );
    await fetchStudents();
  };

  const availableLevels = useMemo(() => {
    if (courseFilter === "all") {
      const all = new Set<string>();
      Object.values(COURSES).forEach(c => c.levels.forEach(l => all.add(l)));
      return Array.from(all);
    }
    return COURSES[courseFilter]?.levels ?? [];
  }, [courseFilter]);

  useEffect(() => { setLevelFilter("all"); }, [courseFilter]);

  // ✅ Derive available years and months from student data
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    students.forEach(s => {
      const date = new Date(s.created_at);
      years.add(String(date.getFullYear()));
    });
    return Array.from(years).sort().reverse();
  }, [students]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    students.forEach(s => {
      const date = new Date(s.created_at);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.add(monthStr);
    });
    return Array.from(months).sort().reverse();
  }, [students]);

  const overdueStudents = useMemo(() =>
    students.filter(s => {
      if (s.status === "graduated") return false;
      let nextDue: Date | null = null;
      if (s.paid_until) nextDue = new Date(s.paid_until);
      else if (s.last_payment_date) {
        const last = new Date(s.last_payment_date);
        nextDue = new Date(last);
        nextDue.setDate(nextDue.getDate() + (s.payment_cycle_days ?? 30));
      } else {
        return true; 
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      nextDue.setHours(0, 0, 0, 0);
      return nextDue <= today;
    }), [students]
  );

  const dueSoonStudents = useMemo(() =>
    students.filter(s => {
      if (s.status === "graduated") return false;
      let nextDue: Date | null = null;
      if (s.paid_until) nextDue = new Date(s.paid_until);
      else if (s.last_payment_date) {
        const last = new Date(s.last_payment_date);
        nextDue = new Date(last);
        nextDue.setDate(nextDue.getDate() + (s.payment_cycle_days ?? 30));
      } else {
        return false; 
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      nextDue.setHours(0, 0, 0, 0);
      const days = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return days > 0 && days <= 5;
    }), [students]
  );

  // ✅ UPDATED: Filtering with Year, Month, and Balance logic
  const filtered = useMemo(() => {
    let result = students.filter(s => {
      const matchQuery = s.name.toLowerCase().includes(query.toLowerCase()) || s.reg_no.toLowerCase().includes(query.toLowerCase());
      const matchCourse = courseFilter === "all" || s.course === courseFilter;
      const matchLevel = levelFilter === "all" || s.level === levelFilter;
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      
      const sDate = new Date(s.created_at);
      const sYear = String(sDate.getFullYear());
      const sMonth = `${sYear}-${String(sDate.getMonth() + 1).padStart(2, '0')}`;
      
      const matchYear = filterYear === "all" || sYear === filterYear;
      const matchMonth = filterMonth === "all" || sMonth === filterMonth;
      const matchBalance = balanceFilter === "all" || (balanceFilter === "owing" && s.balance > 0);

      return matchQuery && matchCourse && matchLevel && matchStatus && matchYear && matchMonth && matchBalance;
    });

    return result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      
      if (sortField === 'reg_no') {
        valA = parseInt(valA.replace(/\D/g, '')) || 0;
        valB = parseInt(valB.replace(/\D/g, '')) || 0;
      } else if (sortField === 'balance') {
        valA = Number(valA);
        valB = Number(valB);
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }
      
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [students, query, courseFilter, levelFilter, statusFilter, filterYear, filterMonth, balanceFilter, sortField, sortOrder]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const promote = async (student: Student) => {
    const levels = COURSES[student.course]?.levels ?? [];
    const idx = levels.indexOf(student.level);
    if (idx < 0 || idx >= levels.length - 1) {
      toast.info(`${student.name} is already at the highest level`);
      return;
    }
    const nextLevel = levels[idx + 1];
    const { error } = await supabase.from("students").update({ level: nextLevel, status: "promoted" }).eq("id", student.id);
    if (error) { toast.error("Promotion failed: " + error.message); return; }
    toast.success(`${student.name} promoted to ${nextLevel}`);
    fetchStudents();
  };

  const graduate = async (student: Student) => {
    const { error } = await supabase.from("students").update({ status: "graduated" }).eq("id", student.id);
    if (error) { toast.error("Graduation failed: " + error.message); return; }
    toast.success(`${student.name} marked as graduated`);
    fetchStudents();
  };

  const saveEdit = async (updated: Student) => {
    const todayStr = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("students").update({
      name: updated.name, reg_no: updated.reg_no, course: updated.course, level: updated.level,
      status: updated.status, balance: updated.balance, payment_cycle_days: updated.payment_cycle_days,
      last_payment_date: todayStr, paid_until: null,
    }).eq("id", updated.id);
    if (error) { toast.error("Update failed: " + error.message); return; }
    toast.success("Student updated");
    setEditing(null);
    fetchStudents();
  };

  const confirmDelete = async () => {
    if (!deleting || deleting.length === 0) return;
    const idsToDelete = deleting.map(s => s.id);
    const { error } = await supabase.from("students").delete().in("id", idsToDelete);
    if (error) { toast.error("Delete failed: " + error.message); return; }
    toast.success(`${deleting.length} student(s) permanently removed.`);
    setDeleting(null);
    setSelectedIds(new Set());
    const remainingStudents = students.filter(s => !idsToDelete.includes(s.id));
    await renumberStudents(remainingStudents);
  };

  const openDetails = async (student: Student) => {
    setViewing(student);
    setViewingLoading(true);
    const { data, error } = await supabase.from("payments").select("*").eq("student_id", student.id).order("payment_date", { ascending: false });
    if (error) { toast.error("Failed to load payment history: " + error.message); setViewingPayments([]); } 
    else { setViewingPayments((data ?? []) as PaymentRecord[]); }
    setViewingLoading(false);
  };

  const closeDetails = () => { setViewing(null); setViewingPayments([]); };
  const lifetimeTotal = useMemo(() => viewingPayments.reduce((sum, p) => sum + (p.amount_paid ?? 0), 0), [viewingPayments]);

  // ✅ NEW: Professional Excel (XLSX) Export Function
  const exportXLSX = () => {
    if (filtered.length === 0) return toast.error("No students to export");
    
    const data = filtered.map(s => {
      let nextDueStr = "Awaiting First Payment";
      let nextDue: Date | null = null;
      if (s.paid_until) nextDue = new Date(s.paid_until);
      else if (s.last_payment_date) {
        const last = new Date(s.last_payment_date);
        nextDue = new Date(last);
        nextDue.setDate(nextDue.getDate() + (s.payment_cycle_days ?? 30));
      }
      
      if (nextDue) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        nextDue.setHours(0, 0, 0, 0);
        const days = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const formattedDate = nextDue.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        
        if (days < 0) nextDueStr = `Overdue (${Math.abs(days)}d) - Was due ${formattedDate}`;
        else if (days === 0) nextDueStr = `Due Today - ${formattedDate}`;
        else if (days <= 5) nextDueStr = `Due in ${days}d - ${formattedDate}`;
        else nextDueStr = `${days}d left - Due ${formattedDate}`;
      }

      return {
        "Reg No": s.reg_no,
        "Name": s.name,
        "Course": COURSES[s.course]?.label || s.course,
        "Level": s.level,
        "Status": s.status.charAt(0).toUpperCase() + s.status.slice(1),
        "Balance (UGX)": s.balance,
        "Next Payment Date": nextDueStr,
        "Admission Date": new Date(s.created_at).toLocaleDateString('en-GB')
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `Students_Roster_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success("Student roster exported to Excel successfully!");
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Students</h1>
            {overdueStudents.length > 0 && (
              <button 
                onClick={() => navigate({ to: "/payments" })}
                className="group relative flex items-center justify-center h-9 w-9 rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
                title={`${overdueStudents.length} student(s) require immediate payment attention`}
              >
                <AlertTriangle className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white ring-2 ring-background">
                  {overdueStudents.length > 99 ? '99+' : overdueStudents.length}
                </span>
              </button>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Manage the student roster</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={() => setDeleting(Array.from(selectedIds).map(id => students.find(s => s.id === id)!).filter(Boolean))}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button variant="outline" onClick={exportXLSX}>
            <Download className="h-4 w-4 mr-1" /> Export Excel
          </Button>
          <Button onClick={() => navigate({ to: "/admissions" })}>
            <Plus className="h-4 w-4 mr-1" /> Add Student
          </Button>
        </div>
      </header>

      <div className="rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or reg no..." className="pl-9" />
          </div>
          
          <div className="flex items-center gap-1 border rounded-md bg-background px-2 py-1.5">
            <Select value={sortField} onValueChange={(v: any) => setSortField(v)}>
              <SelectTrigger className="w-[110px] h-7 border-0 shadow-none focus:ring-0 p-0 text-xs font-medium">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reg_no">Reg No</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="balance">Balance</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
              {sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {/* ✅ NEW: Advanced Filters */}
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[120px]"> <SelectValue placeholder="Year" /> </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[160px]"> <SelectValue placeholder="Month" /> </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {availableMonths.map(m => <SelectItem key={m} value={m}>{formatMonthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={balanceFilter} onValueChange={setBalanceFilter}>
            <SelectTrigger className="w-[140px]"> <SelectValue placeholder="Balance" /> </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Balances</SelectItem>
              <SelectItem value="owing">Owing Only</SelectItem>
            </SelectContent>
          </Select>

          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="w-[160px]"> <SelectValue placeholder="Course" /> </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {(Object.keys(COURSES) as CourseKey[]).map(k => (<SelectItem key={k} value={k}>{COURSES[k].label}</SelectItem>))}
            </SelectContent>
          </Select>
          
          <span className="text-sm text-muted-foreground ml-auto">
            {filtered.length} student{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading students...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <p className="text-lg font-medium">No students found</p>
            <Button variant="outline" onClick={() => navigate({ to: "/admissions" })}>
              <Plus className="h-4 w-4 mr-1" /> Enrol a Student
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox checked={selectedIds.size === filtered.length && filtered.length > 0} onCheckedChange={toggleSelectAll} />
                </TableHead>
                <TableHead>Reg No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Next Payment Date</TableHead>
                <TableHead className="text-right w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => {
                let rowClass = "";
                if (s.status !== "graduated") {
                  let nextDue: Date | null = null;
                  if (s.paid_until) nextDue = new Date(s.paid_until);
                  else if (s.last_payment_date) {
                    const last = new Date(s.last_payment_date);
                    nextDue = new Date(last);
                    nextDue.setDate(nextDue.getDate() + (s.payment_cycle_days ?? 30));
                  }
                  if (!nextDue) rowClass = "bg-destructive/5";
                  else {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    nextDue.setHours(0, 0, 0, 0);
                    const days = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    if (days <= 0) rowClass = "bg-destructive/5";
                    else if (days <= 5) rowClass = "bg-amber-50/50 dark:bg-amber-950/10";
                  }
                }
                
                return (
                  <TableRow key={s.id} className={rowClass}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelect(s.id)} />
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold">{s.reg_no}</TableCell>
                    <TableCell className="font-medium">
                      <button type="button" onClick={() => openDetails(s)} className="hover:underline hover:text-primary transition-colors text-left">
                        {s.name}
                      </button>
                    </TableCell>
                    <TableCell>{COURSES[s.course]?.label ?? s.course}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">{s.level}</span>
                    </TableCell>
                    <TableCell><Badge variant={statusVariant(s.status as Status)}>{s.status}</Badge></TableCell>
                    <TableCell className={s.balance > 0 ? "text-destructive font-medium" : ""}>{formatUGX(s.balance)}</TableCell>
                    <TableCell> <NextPaymentInfo student={s} /> </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => openDetails(s)}>
                            <Info className="h-4 w-4 mr-2" /> View Info
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => promote(s)} disabled={s.status === "graduated"}>
                            <ArrowUpCircle className="h-4 w-4 mr-2" /> Promote
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => graduate(s)} disabled={s.status === "graduated"}>
                            <GraduationCap className="h-4 w-4 mr-2" /> Graduate
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditing(s)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setDeleting([s])} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <EditDialog student={editing} onClose={() => setEditing(null)} onSave={saveEdit} />

      <Dialog open={!!viewing} onOpenChange={o => !o && closeDetails()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing?.name} — Student Details</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="font-mono">{viewing.reg_no}</Badge>
                <Badge variant="outline">{COURSES[viewing.course]?.label ?? viewing.course}</Badge>
                <Badge variant="outline">{viewing.level}</Badge>
                <Badge variant={statusVariant(viewing.status)}>{viewing.status}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between text-sm border">
                  <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Time at school</span>
                  <span className="font-bold text-primary">{getTenure(viewing.enrolled_date, viewing.created_at)}</span>
                </div>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-3 flex items-center justify-between text-sm border">
                  <span className="text-muted-foreground">Total Contributed (all time)</span>
                  <span className="font-bold text-emerald-600">{viewingLoading ? "…" : formatUGX(lifetimeTotal)}</span>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 flex items-center justify-between text-sm border">
                  <span className="text-muted-foreground">Current Balance</span>
                  <span className={`font-bold ${viewing.balance > 0 ? "text-destructive" : "text-muted-foreground"}`}>{formatUGX(viewing.balance)}</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold mb-2">Payment History</p>
                {viewingLoading ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading history...</div>
                ) : viewingPayments.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No payment records yet.</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {viewingPayments.map(p => (
                      <div key={p.id} className="flex items-center justify-between text-xs border-b pb-2 gap-2">
                        <div className="flex flex-col">
                          <span className="font-medium">{formatMonthLabel(p.month_year)}</span>
                          <span className="text-muted-foreground text-[10px]">
                            {p.payment_date} · {p.months_covered ?? 1} mo{(p.months_covered ?? 1) > 1 ? "s" : ""}
                            {p.note?.toLowerCase().includes("backfilled") ? " · historical" : ""}
                          </span>
                        </div>
                        <span className="font-medium text-green-600 shrink-0">{formatUGX(p.amount_paid)}</span>
                        <Badge variant={p.status === "paid" ? "default" : p.status === "partial" ? "outline" : "destructive"} className="text-[10px] shrink-0">{p.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={closeDetails}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete {deleting?.length} Student(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>completely wipe</strong> {deleting?.length} student record(s) from the database to free up space. 
              <br/><br/>
              <strong>Note:</strong> The remaining students will automatically be re-numbered (e.g., SSL-0001, SSL-0002) to fill any gaps. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Yes, Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditDialog({ student, onClose, onSave }: { student: Student | null; onClose: () => void; onSave: (s: Student) => void }) {
  const [draft, setDraft] = useState<Student | null>(null);
  useEffect(() => { setDraft(student); }, [student]);

  const projectedDueDate = useMemo(() => {
    if (!draft?.last_payment_date) return "Not set";
    const last = new Date(draft.last_payment_date);
    const days = draft.payment_cycle_days ?? 30;
    last.setDate(last.getDate() + days);
    return last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [draft?.last_payment_date, draft?.payment_cycle_days]);

  if (!student || !draft) return null;
  const levels = COURSES[draft.course]?.levels ?? [];

  return (
    <Dialog open={!!student} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Student</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2"><Label>Full Name</Label><Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></div>
          <div className="grid gap-2"><Label>Registration No.</Label><Input value={draft.reg_no} onChange={e => setDraft({ ...draft, reg_no: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Course</Label>
              <Select value={draft.course} onValueChange={(v: CourseKey) => setDraft({ ...draft, course: v, level: COURSES[v].levels[0] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(COURSES) as CourseKey[]).map(k => (<SelectItem key={k} value={k}>{COURSES[k].label}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Level</Label>
              <Select value={draft.level} onValueChange={v => setDraft({ ...draft, level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{levels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2"><Label>Balance (UGX)</Label><Input type="number" value={draft.balance} onChange={e => setDraft({ ...draft, balance: Number(e.target.value) })} /></div>
            <div className="grid gap-2">
              <Label className="text-primary font-semibold">Days Until Next Payment</Label>
              <Input type="number" value={draft.payment_cycle_days ?? 30} onChange={e => setDraft({ ...draft, payment_cycle_days: Number(e.target.value) })} placeholder="e.g. 15, 30, 45" />
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-sm flex items-center justify-between border border-dashed">
            <span className="text-muted-foreground">Projected Next Due Date:</span>
            <span className="font-bold text-primary">{projectedDueDate}</span>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={draft.status} onValueChange={(v: Status) => setDraft({ ...draft, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="promoted">Promoted</SelectItem>
                <SelectItem value="graduated">Graduated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(draft)}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}