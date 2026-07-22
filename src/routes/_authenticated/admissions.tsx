import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { UserPlus, Receipt, CheckCircle2, AlertCircle, Loader2, History, Sparkles } from "lucide-react";
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

function monthYearOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

  // ── Enrolment type: New vs Existing (already-at-school) student ──
  const [isExisting, setIsExisting] = useState(false);
  const [monthsAtSchool, setMonthsAtSchool] = useState(1);
  const [paidConsistently, setPaidConsistently] = useState(true);

  // Payment fields
  const [includeRegFee, setIncludeRegFee] = useState(true);
  const [numMonths, setNumMonths] = useState(1);
  const [amountPaid, setAmountPaid] = useState<string>("");

  // Auto-generate reg number
  useEffect(() => {
    const generate = async () => {
      const { data } = await supabase
        .from("students")
        .select("reg_no")
        .order("reg_no", { ascending: false })
        .limit(1);

      let next = 1;
      if (data && data.length > 0) {
        const match = data[0].reg_no.match(/(\d+)$/);
        if (match) next = parseInt(match[1], 10) + 1;
      }
      setRegNo(`SSL-${String(next).padStart(4, "0")}`);
    };
    generate();
  }, []);

  // When switching to "Existing Student", registration fee is usually
  // already paid historically — default it off, but leave it editable.
  useEffect(() => {
    setIncludeRegFee(!isExisting);
  }, [isExisting]);

  const onCourseChange = (v: CourseKey) => {
    setCourse(v);
    setLevel(COURSES[v].levels[0]);
  };

  // ── Fee calculations ──────────────────────────────────────────────────
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
    if (isExisting && monthsAtSchool < 0) return toast.error("Months at school cannot be negative");

    setSubmitting(true);

    // ── Calculate paid_until as exactly 30 days per month from today ──
    let paidUntilStr: string | null = null;
    if (paid > 0 && numMonths > 0) {
      const now = new Date();
      const paidUntilDate = new Date(now);
      paidUntilDate.setDate(now.getDate() + (numMonths * 30));
      paidUntilStr = paidUntilDate.toISOString().slice(0, 10);
    }

    // ── enrolled_date: backdated for existing students ──
    const enrolledDate = isExisting
      ? (() => {
          const d = new Date();
          d.setDate(d.getDate() - monthsAtSchool * 30);
          return d.toISOString().split("T")[0];
        })()
      : new Date().toISOString().split("T")[0];

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
      enrolled_date: enrolledDate,
    });

    if (studentError) {
      toast.error("Admission failed: " + studentError.message);
      setSubmitting(false);
      return;
    }

    // Fetch the new student's id
    const { data: studentData } = await supabase
      .from("students")
      .select("id")
      .eq("reg_no", regNo.trim())
      .single();

    // 2. Record CURRENT admission-day payment if any amount was paid
    if (paid > 0 && studentData) {
      const currentMonthYear = monthYearOf(new Date());
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
        note: isExisting ? "Admission payment (existing student — current dues)" : "Admission payment",
      });

      // ✅ FIX: Added "Money In | " so the Accountant's page sees this as income
      await supabase.from("transactions").insert({
        type: "income",
        amount: paid,
        date: new Date().toISOString().split("T")[0],
        description: `Money In | Admission payment — ${name.trim()} (${regNo.trim()}) [${level}] ${numMonths} month(s)${includeRegFee ? " incl. reg fee" : ""}`,
      });
    }

    // 3. Backfill HISTORICAL payments for an existing student
    if (isExisting && paidConsistently && monthsAtSchool > 0 && studentData) {
      const paymentRows = [];
      const transactionRows = [];
      
      for (let i = monthsAtSchool; i >= 1; i--) {
        const paymentDate = new Date();
        paymentDate.setMonth(paymentDate.getMonth() - i);
        const dateStr = paymentDate.toISOString().split("T")[0];
        const monthYear = monthYearOf(paymentDate);
        
        paymentRows.push({
          student_id: studentData.id,
          student_name: name.trim(),
          reg_no: regNo.trim(),
          course,
          level,
          amount_due: monthlyFee,
          amount_paid: monthlyFee,
          balance: 0,
          method: "cash",
          payment_date: dateStr,
          month_year: monthYear,
          months_covered: 1,
          status: "paid",
          note: "Backfilled — historical payment prior to system setup",
        });
        
        // ✅ FIX: Added "Money In | " so historical payments also show in Accounts
        transactionRows.push({
          type: "income",
          amount: monthlyFee,
          date: dateStr,
          description: `Money In | Historical payment — ${name.trim()} (${regNo.trim()}) [${monthYear}]`,
        });
      }
      
      const { error: backfillError } = await supabase.from("payments").insert(paymentRows);
      if (backfillError) {
        toast.error("Historical backfill failed: " + backfillError.message);
      } else {
        await supabase.from("transactions").insert(transactionRows);
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
          {/* Enrolment Type */}
          <section className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              <Sparkles className="h-4 w-4" /> Enrolment Type
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsExisting(false)}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${
                  !isExisting ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <UserPlus className="h-4 w-4" /> New Student
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Joining Sandstone for the first time, starting today.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setIsExisting(true)}
                className={`rounded-xl border-2 p-4 text-left transition-colors ${
                  isExisting ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <History className="h-4 w-4" /> Existing Student
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Already at the school before this system — being entered now.
                </p>
              </button>
            </div>
            {isExisting && (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-4">
                <div className="grid gap-2 max-w-[240px]">
                  <Label>Months already spent at school</Label>
                  <Input
                    type="number"
                    min={0}
                    value={monthsAtSchool}
                    onChange={e => setMonthsAtSchool(Number(e.target.value))}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Used to backdate their enrolment date, so "time at school" and
                    payment history show correctly from day one.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="paid-consistently"
                    checked={paidConsistently}
                    onCheckedChange={(v) => setPaidConsistently(Boolean(v))}
                    className="mt-0.5"
                  />
                  <div className="grid gap-1">
                    <Label htmlFor="paid-consistently" className="text-xs font-medium cursor-pointer">
                      Paid the full monthly fee consistently for all {monthsAtSchool} month{monthsAtSchool !== 1 ? "s" : ""}
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      This backfills their real payment history into Accounts &amp; Payments
                      — one record per past month, clearly labeled "Historical" so it's
                      distinguishable from live payments. Uncheck if their history was
                      irregular; you can add specific past months manually later from the
                      Payments page instead.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 dark:text-amber-300">
                    The backfill above only covers <strong>past</strong> months. If this
                    student still owes money for the <strong>current</strong> month, use
                    the Admission Payment section below as normal — it always represents
                    what's due right now, exactly like a brand new admission.
                  </p>
                </div>
              </div>
            )}
          </section>

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
                <Label>{isExisting ? "Current Level" : "Starting Level"} <span className="text-destructive">*</span></Label>
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
              <Receipt className="h-4 w-4" />
              {isExisting ? "Current Outstanding Payment" : "Admission Payment"}
            </div>
            {isExisting && (
              <p className="text-xs text-muted-foreground -mt-3">
                If this student still owes money for the current month(s), record it here —
                this is separate from and in addition to their backfilled historical payments above.
              </p>
            )}

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
                  This fee is charged once at admission and does not recur.
                  {isExisting
                    ? " Left unchecked by default for existing students since it was likely already paid before this system existed — check it only if it genuinely wasn't."
                    : " Uncheck only if it was already paid previously or is being waived."}
                </p>
              </div>
            </div>

            {/* Number of Months Selector */}
            <div className="grid gap-2">
              <Label>Number of Months {isExisting ? "Being Paid For Now" : "Paid For"}</Label>
              <Select value={String(numMonths)} onValueChange={(v) => setNumMonths(parseInt(v))}>
                <SelectTrigger> <SelectValue /> </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} Month{n > 1 ? "s" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select how many months of tuition the student is paying for right now.
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
                Enter how much the student paid today. Leave as 0 if no payment was made today.
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
              {isExisting ? "Add Existing Student" : "Admit Student"}
            </Button>
          </div>
        </div>

        {/* ── Right: Invoice Summary ── */}
        <aside className="rounded-2xl border bg-card p-6 space-y-5 h-fit sticky top-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <Receipt className="h-4 w-4" /> Fee Summary
          </div>
          {isExisting && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enrolment type</span>
                <Badge variant="outline" className="text-[10px]">Existing Student</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Backdated tenure</span>
                <span className="font-medium">{monthsAtSchool} month{monthsAtSchool !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Historical records</span>
                <span className="font-medium">
                  {paidConsistently ? `${monthsAtSchool} to be created` : "None (manual entry)"}
                </span>
              </div>
            </div>
          )}
          <div className="space-y-3 text-sm">
            <Row label={`${COURSES[course].label} — ${numMonths} month${numMonths > 1 ? "s" : ""}`} value={formatUGX(tuitionFee)} />
            {includeRegFee && (
              <Row label="Registration fee (one-time)" value={formatUGX(REGISTRATION_FEE)} muted />
            )}
            <Separator />
            <Row label="Total Due Now" value={formatUGX(totalDue)} bold />
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
            {isExisting && " Historical months (if enabled) will appear in Payments & Accounts tagged as \"Historical\"."}
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