import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { UserPlus, Receipt, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admissions")({
  head: () => ({ meta: [{ title: "Admissions — Sandstone School" }] }),
  component: AdmissionsPage,
});

// ── Course definitions ─────
const COURSES: Record<string, { label: string; levels: string[]; fee: number }> = {
  english: { label: "English", levels: ["Zero Level", "Pre Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"], fee: 130000 },
  computer: { label: "Computer", levels: ["Beginner", "Intermediate", "Advanced"], fee: 150000 },
  computer_english: { label: "Computer & English", levels: ["Zero Level", "Pre Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"], fee: 230000 },
  french: { label: "French", levels: ["Beginner", "Intermediate", "Advanced"], fee: 150000 },
  kiswahili: { label: "Kiswahili", levels: ["Beginner", "Intermediate", "Advanced"], fee: 300000 },
  german: { label: "German", levels: ["Beginner", "Intermediate", "Advanced"], fee: 300000 },
  private_class: { label: "Private Class", levels: ["Private"], fee: 300000 },
  private_class_2: { label: "Private Class 2", levels: ["Private"], fee: 500000 },
};

type CourseKey = keyof typeof COURSES;
const REGISTRATION_FEE = 20000;

function formatUGX(n: number) {
  return `UGX ${n.toLocaleString("en-UG")}`;
}

function AdmissionsPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  
  // Form fields
  const [name, setName] = useState("");
  const [regNo, setRegNo] = useState("");
  const [phone, setPhone] = useState("");
  const [course, setCourse] = useState<CourseKey>("english");
  const [level, setLevel] = useState<string>(COURSES.english.levels[0]);
  
  // Payment fields
  const [includeRegFee, setIncludeRegFee] = useState(true);
  const [numMonths, setNumMonths] = useState(1);
  const [amountPaid, setAmountPaid] = useState<string>("");

  // Auto-generate reg number
  useEffect(() => {
    const generate = async () => {
      const { count } = await supabase.from("students").select("*", { count: "exact", head: true });
      const next = (count ?? 0) + 1;
      setRegNo(`SSL-${String(next).padStart(4, "0")}`);
    };
    generate();
  }, []);

  const onCourseChange = (v: CourseKey) => {
    setCourse(v);
    setLevel(COURSES[v].levels[0]);
  };

  // ── Fee calculations ───────────────────────────────────────────────────
  const monthlyFee = COURSES[course].fee;
  const tuitionFee = monthlyFee * numMonths;
  const regFee = includeRegFee ? REGISTRATION_FEE : 0;
  const totalDue = tuitionFee + regFee;
  const paid = Number(amountPaid) || 0;
  const balance = totalDue - paid;
  const isFullyPaid = paid >= totalDue;
  const isOverpaid = paid > totalDue;

  // ── Submit ─────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!name.trim()) return toast.error("Full name is required");
    if (!regNo.trim()) return toast.error("Registration number is required");
    if (paid < 0) return toast.error("Amount paid cannot be negative");
    if (isOverpaid) return toast.error("Amount paid exceeds total due");

    setSubmitting(true);

    // ── FIXED: Calculate paid_until as exactly 30 days per month from today ──
    let paidUntilStr: string | null = null;
    if (paid > 0 && numMonths > 0) {
      const now = new Date();
      const paidUntilDate = new Date(now);
      paidUntilDate.setDate(now.getDate() + (numMonths * 30));
      paidUntilStr = paidUntilDate.toISOString().slice(0, 10);
    }

    // 1. Insert Student
    const { error: studentError } = await supabase.from("students").insert({
      name: name.trim(),
      reg_no: regNo.trim(),
      course,
      level,
      status: "active",
      balance: Math.max(0, balance),
      last_payment_date: paid > 0 ? new Date().toISOString().split("T")[0] : null,
      payment_cycle_days: 30,
      paid_until: paidUntilStr,
    });

    if (studentError) {
      toast.error("Admission failed: " + studentError.message);
      setSubmitting(false);
      return;
    }

    // 2. Record payment if any amount was paid
    if (paid > 0) {
      const { data: studentData } = await supabase
        .from("students")
        .select("id")
        .eq("reg_no", regNo.trim())
        .single();

      if (studentData) {
        const currentMonthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
        const status = paid >= totalDue ? "paid" : "partial";
        
        await supabase.from("payments").insert({
          student_id: studentData.id,
          student_name: name.trim(),
          reg_no: regNo.trim(),
          course,
          level,
          amount_due: totalDue,
          amount_paid: paid,
          balance: Math.max(0, balance),
          method: "cash",
          payment_date: new Date().toISOString().split("T")[0],
          month_year: currentMonthYear,
          months_covered: numMonths,
          status,
          note: "Admission payment",
        });

        await supabase.from("transactions").insert({
          type: "income",
          amount: paid,
          date: new Date().toISOString().split("T")[0],
          description: `Admission payment — ${name.trim()} (${regNo.trim()}) [${level}] ${numMonths} month(s)${includeRegFee ? " incl. reg fee" : ""}`,
        });
      }
    }

    toast.success(`${name.trim()} admitted successfully!`, {
      description: isFullyPaid
        ? `Full payment received. Covered for ${numMonths * 30} days.`
        : `Balance of ${formatUGX(balance)} recorded on student account.`,
    });

    setSubmitting(false);
    navigate({ to: "/students" });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">New Admission</h1>
        <p className="text-muted-foreground mt-1">
          Enrol a new student and record their admission payment
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Left: Form ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Student Details */}
          <section className="rounded-2xl border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <UserPlus className="h-4 w-4" /> Student Details
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Full Name <span className="text-destructive">*</span></Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Aisha Nakato" />
              </div>
              <div className="grid gap-2">
                <Label>Registration No. <span className="text-destructive">*</span></Label>
                <Input value={regNo} onChange={e => setRegNo(e.target.value)} placeholder="SSL-0001" />
              </div>
              <div className="grid gap-2 md:col-span-2">
                <Label>Phone Number</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+256 700 000 000" />
              </div>
              <div className="grid gap-2">
                <Label>Course <span className="text-destructive">*</span></Label>
                <Select value={course} onValueChange={(v: CourseKey) => onCourseChange(v)}>
                  <SelectTrigger> <SelectValue /> </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(COURSES) as CourseKey[]).map(k => (
                      <SelectItem key={k} value={k}>
                        {COURSES[k].label} — {formatUGX(COURSES[k].fee)}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Starting Level <span className="text-destructive">*</span></Label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger> <SelectValue /> </SelectTrigger>
                  <SelectContent>
                    {COURSES[course].levels.map(l => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {/* Payment Section */}
          <section className="rounded-2xl border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <Receipt className="h-4 w-4" /> Admission Payment
            </div>

            {/* Registration fee checkbox */}
            <div className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4">
              <Checkbox
                id="reg-fee"
                checked={includeRegFee}
                onCheckedChange={(v) => setIncludeRegFee(Boolean(v))}
                className="mt-0.5"
              />
              <div className="grid gap-1">
                <Label htmlFor="reg-fee" className="font-medium cursor-pointer">
                  Include one-time registration fee — {formatUGX(REGISTRATION_FEE)}
                </Label>
                <p className="text-xs text-muted-foreground">
                  This fee is charged once at admission and does not recur. Uncheck only if it was
                  already paid previously or is being waived.
                </p>
              </div>
            </div>

            {/* Number of Months Selector */}
            <div className="grid gap-2">
              <Label>Number of Months Paid For</Label>
              <Select value={String(numMonths)} onValueChange={(v) => setNumMonths(parseInt(v))}>
                <SelectTrigger> <SelectValue /> </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} Month{n > 1 ? "s" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select how many months of tuition the student is paying for at admission.
              </p>
            </div>

            {/* Amount paid */}
            <div className="grid gap-2">
              <Label>Amount Paid Today (UGX)</Label>
              <Input
                type="number"
                min={0}
                max={totalDue}
                value={amountPaid}
                onChange={e => setAmountPaid(e.target.value)}
                placeholder={`0 — max ${formatUGX(totalDue)}`}
              />
              <p className="text-xs text-muted-foreground">
                Enter how much the student paid at admission. Leave as 0 if no payment was made today.
              </p>
            </div>

            {/* Payment status indicator */}
            {amountPaid !== "" && paid >= 0 && (
              <div className={`flex items-center gap-3 rounded-lg p-4 text-sm font-medium border ${
                isFullyPaid
                  ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300"
                  : "bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300"
              }`}>
                {isFullyPaid
                  ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                  : <AlertCircle className="h-4 w-4 shrink-0" />
                }
                {isFullyPaid
                  ? `Full payment received — student is covered for ${numMonths * 30} days!`
                  : `Outstanding balance of ${formatUGX(balance)} will be recorded on this student's account`
                }
              </div>
            )}
          </section>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate({ to: "/students" })}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Admit Student
            </Button>
          </div>
        </div>

        {/* ── Right: Invoice Summary ── */}
        <aside className="rounded-2xl border bg-card p-6 space-y-5 h-fit sticky top-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <Receipt className="h-4 w-4" /> Fee Summary
          </div>

          <div className="space-y-3 text-sm">
            <Row label={`${COURSES[course].label} — ${numMonths} month${numMonths > 1 ? "s" : ""}`} value={formatUGX(tuitionFee)} />
            {includeRegFee && (
              <Row label="Registration fee (one-time)" value={formatUGX(REGISTRATION_FEE)} muted />
            )}
            <Separator />
            <Row label="Total Due" value={formatUGX(totalDue)} bold />
            {paid > 0 && (
              <>
                <Row label="Paid Today" value={formatUGX(paid)} positive />
                <Separator />
                <Row
                  label="Balance Remaining"
                  value={formatUGX(Math.max(0, balance))}
                  bold
                  negative={balance > 0}
                  positive={balance <= 0}
                />
              </>
            )}
          </div>

          {/* Payment status badge */}
          <div className="pt-1">
            {paid === 0 || amountPaid === "" ? (
              <Badge variant="outline" className="text-xs">No payment recorded yet</Badge>
            ) : isFullyPaid ? (
              <Badge className="bg-green-600 text-white text-xs">Fully Paid ({numMonths} mo)</Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                Balance: {formatUGX(balance)}
              </Badge>
            )}
          </div>

          <Separator />

          <p className="text-xs text-muted-foreground leading-relaxed">
            The balance and payment duration recorded here will appear on the student's account in the Students panel.
          </p>
        </aside>
      </div>
    </div>
  );
}

// ── Row helper ─────────────────────────────────────────────────────────────
function Row({
  label, value, muted, bold, positive, negative,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className={`flex justify-between gap-4 ${
      muted ? "text-muted-foreground" :
      positive ? "text-green-600 dark:text-green-400" :
      negative ? "text-destructive" : ""
    } ${bold ? "font-semibold text-base" : ""}`}>
      <span>{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}