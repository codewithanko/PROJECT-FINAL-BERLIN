import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import {
  Pencil, GraduationCap, ArrowUpCircle, Plus, Search,
  Trash2, Loader2, Clock, AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
};

const statusVariant = (s: Status): "secondary" | "default" | "outline" =>
  s === "graduated" ? "secondary" : s === "promoted" ? "default" : "outline";

function NextPaymentInfo({ student }: { student: Student }) {
  if (student.status === "graduated") return <span className="text-muted-foreground text-xs">—</span>;
  
  let nextDue: Date | null = null;
  
  if (student.paid_until) {
    nextDue = new Date(student.paid_until);
  } 
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

function StudentsPage() {
  const navigate = useNavigate();
  const { search: urlSearch } = Route.useSearch(); 
  
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(urlSearch); 
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);

  useEffect(() => { setQuery(urlSearch); }, [urlSearch]);

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error) toast.error("Failed to load students: " + error.message);
    else setStudents((data ?? []) as Student[]);
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, []);

  const availableLevels = useMemo(() => {
    if (courseFilter === "all") {
      const all = new Set<string>();
      Object.values(COURSES).forEach(c => c.levels.forEach(l => all.add(l)));
      return Array.from(all);
    }
    return COURSES[courseFilter]?.levels ?? [];
  }, [courseFilter]);

  useEffect(() => { setLevelFilter("all"); }, [courseFilter]);

  const overdueStudents = useMemo(() =>
    students.filter(s => {
      if (s.status === "graduated") return false;
      
      let nextDue: Date | null = null;
      if (s.paid_until) {
        nextDue = new Date(s.paid_until);
      } else if (s.last_payment_date) {
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
      if (s.paid_until) {
        nextDue = new Date(s.paid_until);
      } else if (s.last_payment_date) {
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

  const filtered = useMemo(() => {
    return students.filter(s => {
      const matchQuery = s.name.toLowerCase().includes(query.toLowerCase()) || s.reg_no.toLowerCase().includes(query.toLowerCase());
      const matchCourse = courseFilter === "all" || s.course === courseFilter;
      const matchLevel = levelFilter === "all" || s.level === levelFilter;
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      return matchQuery && matchCourse && matchLevel && matchStatus;
    });
  }, [students, query, courseFilter, levelFilter, statusFilter]);

  const promote = async (student: Student) => {
    const levels = COURSES[student.course]?.levels ?? [];
    const idx = levels.indexOf(student.level);
    if (idx < 0 || idx >= levels.length - 1) {
      toast.info(`${student.name} is already at the highest level`);
      return;
    }
    const nextLevel = levels[idx + 1];
    const { error } = await supabase.from("students")
      .update({ level: nextLevel, status: "promoted" })
      .eq("id", student.id);
    
    if (error) { toast.error("Promotion failed: " + error.message); return; }
    toast.success(`${student.name} promoted to ${nextLevel}`);
    fetchStudents();
  };

  const graduate = async (student: Student) => {
    const { error } = await supabase.from("students")
      .update({ status: "graduated" })
      .eq("id", student.id);
    
    if (error) { toast.error("Graduation failed: " + error.message); return; }
    toast.success(`${student.name} marked as graduated`);
    fetchStudents();
  };

  // ✅ FIXED: Always reset last_payment_date to today and clear paid_until 
  // so the new manual cycle days take over immediately.
  const saveEdit = async (updated: Student) => {
    const todayStr = new Date().toISOString().split("T")[0];

    const { error } = await supabase.from("students").update({
      name: updated.name,
      reg_no: updated.reg_no,
      course: updated.course,
      level: updated.level,
      status: updated.status,
      balance: updated.balance,
      payment_cycle_days: updated.payment_cycle_days,
      last_payment_date: todayStr,  // ✅ Always reset to today
      paid_until: null,             // ✅ Clear this so cycle days take over
    }).eq("id", updated.id);
    
    if (error) { toast.error("Update failed: " + error.message); return; }
    toast.success("Student updated");
    setEditing(null);
    fetchStudents();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("students").delete().eq("id", deleting.id);
    if (error) { toast.error("Delete failed: " + error.message); return; }
    toast.success(`${deleting.name} removed`);
    setDeleting(null);
    fetchStudents();
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground mt-1">Manage the student roster</p>
        </div>
        <Button onClick={() => navigate({ to: "/admissions" })}>
          <Plus className="h-4 w-4 mr-1" /> Add Student
        </Button>
      </header>

      {overdueStudents.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <p className="font-semibold text-destructive text-sm">
                {overdueStudents.length} student{overdueStudents.length !== 1 ? "s" : ""} require immediate payment attention
              </p>
            </div>
            <Button size="sm" variant="destructive" onClick={() => navigate({ to: "/payments" })}>
              Go to Payments
            </Button>
          </div>
        </Card>
      )}

      {dueSoonStudents.length > 0 && (
        <Card className="border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">
                {dueSoonStudents.length} student{dueSoonStudents.length !== 1 ? "s" : ""} due within 5 days
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search name or reg no..."
              className="pl-9"
            />
          </div>
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="w-[180px]"> <SelectValue placeholder="All Courses" /> </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {(Object.keys(COURSES) as CourseKey[]).map(k => (
                <SelectItem key={k} value={k}>{COURSES[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[160px]"> <SelectValue placeholder="All Levels" /> </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {availableLevels.map(l => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"> <SelectValue placeholder="All Status" /> </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="promoted">Promoted</SelectItem>
              <SelectItem value="graduated">Graduated</SelectItem>
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
            <p className="text-sm">
              {query || courseFilter !== "all" || levelFilter !== "all"
                ? "Try adjusting your filters"
                : "Go to Admissions to enrol the first student"}
            </p>
            <Button variant="outline" onClick={() => navigate({ to: "/admissions" })}>
              <Plus className="h-4 w-4 mr-1" /> Enrol a Student
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reg No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Next Payment Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => {
                let rowClass = "";
                if (s.status !== "graduated") {
                  let nextDue: Date | null = null;
                  if (s.paid_until) {
                    nextDue = new Date(s.paid_until);
                  } else if (s.last_payment_date) {
                    const last = new Date(s.last_payment_date);
                    nextDue = new Date(last);
                    nextDue.setDate(nextDue.getDate() + (s.payment_cycle_days ?? 30));
                  }
                  
                  if (!nextDue) {
                    rowClass = "bg-destructive/5";
                  } else {
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
                    <TableCell className="font-mono text-xs">{s.reg_no}</TableCell>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{COURSES[s.course]?.label ?? s.course}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-medium">
                        {s.level}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(s.status as Status)}>{s.status}</Badge>
                    </TableCell>
                    <TableCell className={s.balance > 0 ? "text-destructive font-medium" : ""}>
                      {formatUGX(s.balance)}
                    </TableCell>
                    <TableCell> <NextPaymentInfo student={s} /> </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => promote(s)} disabled={s.status === "graduated"}>
                          <ArrowUpCircle className="h-4 w-4 mr-1" /> Promote
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => graduate(s)} disabled={s.status === "graduated"}>
                          <GraduationCap className="h-4 w-4 mr-1" /> Graduate
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                          <Pencil className="h-4 w-4 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleting(s)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <EditDialog student={editing} onClose={() => setEditing(null)} onSave={saveEdit} />

      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove student?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleting?.name}</strong> ({deleting?.reg_no}) and all their records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Student
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Edit Dialog (FIXED: Hooks moved above early return) ───────────────────
function EditDialog({
  student, onClose, onSave,
}: { student: Student | null; onClose: () => void; onSave: (s: Student) => void }) {
  const [draft, setDraft] = useState<Student | null>(null);
  useEffect(() => { setDraft(student); }, [student]);

  // ✅ FIX: Move useMemo ABOVE the early return to satisfy React Rules of Hooks
  const projectedDueDate = useMemo(() => {
    if (!draft?.last_payment_date) return "Not set";
    const last = new Date(draft.last_payment_date);
    const days = draft.payment_cycle_days ?? 30;
    last.setDate(last.getDate() + days);
    return last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [draft?.last_payment_date, draft?.payment_cycle_days]);

  // Early return is now safely AFTER all hooks are declared
  if (!student || !draft) return null;

  const levels = COURSES[draft.course]?.levels ?? [];

  return (
    <Dialog open={!!student} onOpenChange={o => !o && onClose()}>
      <DialogContent>
        <DialogHeader> <DialogTitle>Edit Student</DialogTitle> </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Full Name</Label>
            <Input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Registration No.</Label>
            <Input value={draft.reg_no} onChange={e => setDraft({ ...draft, reg_no: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Course</Label>
              <Select value={draft.course} onValueChange={(v: CourseKey) => setDraft({ ...draft, course: v, level: COURSES[v].levels[0] })}>
                <SelectTrigger> <SelectValue /> </SelectTrigger>
                <SelectContent>
                  {(Object.keys(COURSES) as CourseKey[]).map(k => (
                    <SelectItem key={k} value={k}>{COURSES[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Level</Label>
              <Select value={draft.level} onValueChange={v => setDraft({ ...draft, level: v })}>
                <SelectTrigger> <SelectValue /> </SelectTrigger>
                <SelectContent>
                  {levels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Balance (UGX)</Label>
              <Input type="number" value={draft.balance} onChange={e => setDraft({ ...draft, balance: Number(e.target.value) })} />
            </div>
            <div className="grid gap-2">
              <Label className="text-primary font-semibold">Days Until Next Payment</Label>
              <Input 
                type="number" 
                value={draft.payment_cycle_days ?? 30} 
                onChange={e => setDraft({ ...draft, payment_cycle_days: Number(e.target.value) })} 
                placeholder="e.g. 15, 30, 45"
              />
              <p className="text-[10px] text-muted-foreground">
                System will auto-calculate due date from today.
              </p>
            </div>
          </div>
          
          {/* Visual indicator of the calculated date */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm flex items-center justify-between border border-dashed">
            <span className="text-muted-foreground">Projected Next Due Date:</span>
            <span className="font-bold text-primary">{projectedDueDate}</span>
          </div>

          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={draft.status} onValueChange={(v: Status) => setDraft({ ...draft, status: v })}>
              <SelectTrigger> <SelectValue /> </SelectTrigger>
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