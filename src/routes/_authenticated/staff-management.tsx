import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  Plus, Check, X, UserPlus, DollarSign, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatUGX } from "@/lib/courses";

export const Route = createFileRoute("/_authenticated/staff-management")({
  head: () => ({ meta: [{ title: "Staff Management – Sandstone School" }] }),
  component: StaffManagementPage,
});

type StaffMember = {
  id: string;
  staff_no: string;
  full_name: string;
  role: string;
  pay_cycle: "weekly" | "monthly";
  base_amount: number;
  phone: string | null;
  notes: string | null;
  is_active: boolean;
};

type PayrollRow = StaffMember & {
  net_pay: number;
  deduction_reason: string;
  approved: boolean;
  paymentId?: string;
};

const ROLES = ["Teacher", "Senior Teacher", "Head Teacher", "Administrator", "Accountant", "IT Officer", "Receptionist", "Support Staff", "Manager"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const currentYear = new Date().getFullYear();
const currentWeek = Math.ceil(((new Date().getTime() - new Date(currentYear, 0, 1).getTime()) / 86400000) / 7);
const currentMonth = new Date().getMonth() + 1;

function StaffManagementPage() {
  const [recruitOpen, setRecruitOpen] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground mt-1">Manage payroll and performance</p>
        </div>
        <Button onClick={() => setRecruitOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Recruit Staff
        </Button>
      </header>

      <Tabs defaultValue="payroll">
        <TabsList className="w-full max-w-sm">
          <TabsTrigger value="payroll" className="flex-1 gap-2">
            <DollarSign className="h-4 w-4" /> Payroll
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex-1 gap-2">
            <ClipboardList className="h-4 w-4" /> Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="payroll" className="mt-6 space-y-6">
          <PayrollSection payCycle="weekly" />
          <PayrollSection payCycle="monthly" />
        </TabsContent>

        <TabsContent value="attendance" className="mt-6">
          <AttendanceSection />
        </TabsContent>
      </Tabs>

      {recruitOpen && <RecruitDialog onClose={() => setRecruitOpen(false)} onSaved={() => { setRecruitOpen(false); window.location.reload(); }} />}
    </div>
  );
}

function PayrollSection({ payCycle }: { payCycle: "weekly" | "monthly" }) {
  const isWeekly = payCycle === "weekly";
  const [year, setYear] = useState(currentYear);
  const [period, setPeriod] = useState(isWeekly ? currentWeek : currentMonth);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const periodLabel = isWeekly ? `${year}-W${String(period).padStart(2, "0")}` : `${year}-${String(period).padStart(2, "0")}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: staffData, error } = await supabase
        .from("staff_members")
        .select("*")
        .eq("pay_cycle", payCycle)
        .eq("is_active", true)
        .order("staff_no");

      if (error) throw error;

      const { data: payments } = await supabase
        .from("staff_payroll_payments")
        .select("*")
        .eq("period_label", periodLabel);

      const built: PayrollRow[] = (staffData ?? []).map((s: any) => {
        const payment = (payments ?? []).find((p: any) => p.staff_id === s.id);
        return {
          ...s,
          base_amount: s.base_amount ?? 0,
          net_pay: payment?.net_pay ?? s.base_amount ?? 0,
          deduction_reason: "", 
          approved: !!payment,
          paymentId: payment?.id,
        };
      });

      setRows(built);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [payCycle, year, period, periodLabel]);

  useEffect(() => { load(); }, [load]);

  const updateNetPay = async (staffId: string, netPay: number, reason: string) => {
    const staff = rows.find(r => r.id === staffId);
    if (!staff) return;
    
    const deduction = Math.max(0, staff.base_amount - netPay);

    const { error } = await supabase
      .from("staff_payroll_payments")
      .upsert({
        staff_id: staffId,
        period_label: periodLabel,
        base_amount: staff.base_amount,
        advance_deduction: deduction,
        net_pay: netPay,
        paid: false,
        payment_date: null,
      }, { onConflict: "staff_id,period_label" });
    
    if (error) { toast.error(error.message); return; }
    setRows(prev => prev.map(r => r.id === staffId ? { ...r, net_pay: netPay, deduction_reason: reason } : r));
    toast.success("Net pay updated");
  };

  const toggleApprove = async (row: PayrollRow) => {
    if (row.approved) {
      if (row.paymentId) {
        await supabase.from("staff_payroll_payments").delete().eq("id", row.paymentId);
      }
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, approved: false, paymentId: undefined } : r));
      toast.success("Payment unapproved");
    } else {
      const deduction = Math.max(0, row.base_amount - row.net_pay);
      
      const { data: payment, error: pe } = await supabase
        .from("staff_payroll_payments")
        .upsert({
          staff_id: row.id,
          period_label: periodLabel,
          base_amount: row.base_amount,
          advance_deduction: deduction,
          net_pay: row.net_pay,
          paid: true,
          payment_date: new Date().toISOString().split("T")[0],
        }, { onConflict: "staff_id,period_label" })
        .select()
        .single();

      if (pe) { toast.error(pe.message); return; }

      await supabase.from("transactions").insert({
        type: "expense",
        amount: row.net_pay,
        date: new Date().toISOString().split("T")[0],
        description: `Payroll - ${row.full_name} (${periodLabel})${row.deduction_reason ? ` | Reason: ${row.deduction_reason}` : ""}`,
      });

      setRows(prev => prev.map(r => r.id === row.id ? { ...r, approved: true, paymentId: payment.id } : r));
      toast.success(`Payment approved for ${row.full_name}`);
    }
  };

  const deleteStaff = async (id: string) => {
    const { error } = await supabase.from("staff_members").update({ is_active: false }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows(prev => prev.filter(r => r.id !== id));
    setDeleteId(null);
    toast.success("Staff member deactivated");
  };

  const handleFinalize = () => {
    setPeriod(p => isWeekly ? Math.min(p + 1, 52) : p === 12 ? 1 : p + 1);
    toast.success(`Moved to next ${isWeekly ? "week" : "month"}`);
  };

  const headerClass = isWeekly ? "bg-primary/5 border-primary/20" : "bg-blue-500/5 border-blue-500/20";
  const headerTitleClass = isWeekly ? "text-primary" : "text-blue-600 dark:text-blue-400";

  return (
    <>
      <Card className={`border ${headerClass}`}>
        <CardHeader className={`rounded-t-xl pb-4 ${headerClass}`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <h2 className={`text-lg font-bold ${headerTitleClass}`}>{isWeekly ? "Weekly Payroll" : "Monthly Payroll"}</h2>
              <Badge variant="secondary">{rows.length} staff</Badge>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              {isWeekly ? (
                <Select value={String(period)} onValueChange={v => setPeriod(Number(v))}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 52 }, (_, i) => i + 1).map(w => <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={String(period)} onValueChange={v => setPeriod(Number(v))}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs" onClick={handleFinalize}>
                Finalize {isWeekly ? "Week" : "Month"} →
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No {payCycle} staff found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Staff No</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-32 text-right">Base Amount</TableHead>
                    <TableHead className="w-32 text-right">Net Pay</TableHead>
                    <TableHead>Deduction Reason</TableHead>
                    <TableHead className="text-right w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <PayrollRowComponent
                      key={row.id}
                      row={row}
                      onUpdateNetPay={updateNetPay}
                      onToggleApprove={toggleApprove}
                      onDelete={() => setDeleteId(row.id)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Staff Member?</AlertDialogTitle>
            <AlertDialogDescription>This will mark the staff member as inactive. Their records will be preserved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => deleteId && deleteStaff(deleteId)}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PayrollRowComponent({
  row, onUpdateNetPay, onToggleApprove, onDelete,
}: {
  row: PayrollRow;
  onUpdateNetPay: (id: string, netPay: number, reason: string) => void;
  onToggleApprove: (row: PayrollRow) => void;
  onDelete: () => void;
}) {
  const [netPayInput, setNetPayInput] = useState(String(row.net_pay));
  const [reasonInput, setReasonInput] = useState(row.deduction_reason);
  const isLocked = row.approved;

  const handleSave = () => {
    const netPay = Number(netPayInput);
    if (!isNaN(netPay)) {
      onUpdateNetPay(row.id, netPay, reasonInput);
    }
  };

  return (
    <TableRow className={isLocked ? "bg-emerald-50/50 dark:bg-emerald-950/10" : ""}>
      <TableCell className="font-mono text-xs">{row.staff_no}</TableCell>
      <TableCell className="font-semibold">{row.full_name}</TableCell>
      <TableCell className="text-muted-foreground text-sm">{row.role}</TableCell>
      <TableCell className="text-right font-medium">{formatUGX(row.base_amount)}</TableCell>
      <TableCell>
        <Input
          type="number"
          value={netPayInput}
          onChange={e => setNetPayInput(e.target.value)}
          onBlur={handleSave}
          disabled={isLocked}
          className="h-8 w-28 text-right"
        />
      </TableCell>
      <TableCell>
        <Input
          value={reasonInput}
          onChange={e => setReasonInput(e.target.value)}
          onBlur={handleSave}
          disabled={isLocked}
          placeholder="Reason for deduction (optional)"
          className="h-8"
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant={isLocked ? "outline" : "default"}
            disabled={isLocked}
            onClick={() => onToggleApprove(row)}
            className={isLocked ? "" : "bg-emerald-600 hover:bg-emerald-700 text-white"}
          >
            <Check className="h-4 w-4 mr-1" />
            {isLocked ? "Approved" : "Approve"}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:text-destructive">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function AttendanceSection() {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [records, setRecords] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("staff_members").select("*").eq("is_active", true).order("staff_no");
      setStaff(data ?? []);
    })();
  }, []);

  useEffect(() => {
    if (!staff.length) return;
    (async () => {
      const { data } = await supabase.from("staff_attendance").select("*").eq("date", date);
      const map: Record<string, any> = {};
      staff.forEach(s => {
        const existing = (data ?? []).find((r: any) => r.staff_id === s.id);
        map[s.id] = existing ?? { staff_id: s.id, date, status: "present", rating: null, note: null };
      });
      setRecords(map);
    })();
  }, [date, staff]);

  const updateRecord = (staffId: string, patch: any) => {
    setRecords(prev => ({ ...prev, [staffId]: { ...prev[staffId], ...patch } }));
  };

  const saveRecord = async (staffId: string) => {
    setSaving(staffId);
    const rec = records[staffId];
    try {
      const { error } = await supabase.from("staff_attendance").upsert({ 
        staff_id: staffId, 
        date, 
        status: rec.status, 
        rating: rec.rating, 
        note: rec.note 
      }, { onConflict: "staff_id,date" });
      if (error) throw error;
      toast.success("Attendance saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <h2 className="text-lg font-bold">Performance & Attendance</h2>
          </div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-sm" />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Performance</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Save</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {staff.map(s => {
              const rec = records[s.id];
              if (!rec) return null;
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.staff_no}</TableCell>
                  <TableCell className="font-medium">{s.full_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{s.role}</TableCell>
                  <TableCell>
                    <Select value={rec.status} onValueChange={v => updateRecord(s.id, { status: v })}>
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                        <SelectItem value="late">Late</SelectItem>
                        <SelectItem value="leave">On Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={rec.rating ? String(rec.rating) : "none"} onValueChange={v => updateRecord(s.id, { rating: v === "none" ? null : Number(v) })}>
                      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Rate..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Not rated —</SelectItem>
                        <SelectItem value="5">⭐⭐⭐⭐⭐ Excellent</SelectItem>
                        <SelectItem value="4">⭐⭐⭐⭐ Good</SelectItem>
                        <SelectItem value="3">⭐⭐⭐ Average</SelectItem>
                        <SelectItem value="2">⭐⭐ Poor</SelectItem>
                        <SelectItem value="1">⭐ Very Poor</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input className="h-8 text-xs w-40" placeholder="Notes..." value={rec.note ?? ""} onChange={e => updateRecord(s.id, { note: e.target.value })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" className="h-8 text-xs" disabled={saving === s.id} onClick={() => saveRecord(s.id)}>
                      {saving === s.id ? "Saving..." : "Save"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RecruitDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ full_name: "", role: "Teacher", pay_cycle: "monthly" as const, base_amount: "", phone: "", notes: "" });
  const [nextNo, setNextNo] = useState("STF-001");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("staff_members").select("staff_no").order("created_at", { ascending: false }).limit(1);
      if (data?.[0]?.staff_no) {
        const match = data[0].staff_no.match(/\d+/);
        const last = match ? parseInt(match[0], 10) : 0;
        setNextNo(`STF-${String(last + 1).padStart(3, "0")}`);
      }
    })();
  }, []);

  const save = async () => {
    if (!form.full_name) return toast.error("Name is required");
    setSaving(true);
    const { error } = await supabase.from("staff_members").insert({ 
      staff_no: nextNo, 
      full_name: form.full_name, 
      role: form.role, 
      pay_cycle: form.pay_cycle, 
      base_amount: Number(form.base_amount) || 0, 
      phone: form.phone || null, 
      notes: form.notes || null, 
      is_active: true 
    });
    if (error) toast.error(error.message);
    else { toast.success("Staff recruited"); onClose(); window.location.reload(); }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Recruit New Staff</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Staff No</Label><Input value={nextNo} disabled className="bg-muted" /></div>
            <div className="space-y-2"><Label>Full Name *</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Role</Label><Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Pay Cycle</Label><Select value={form.pay_cycle} onValueChange={v => setForm({ ...form, pay_cycle: v as any })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Base Salary (UGX)</Label><Input type="number" value={form.base_amount} onChange={e => setForm({ ...form, base_amount: e.target.value })} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? "..." : "Recruit"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 