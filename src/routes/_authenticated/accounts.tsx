import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { 
  Plus, Trash2, TrendingUp, TrendingDown, Wallet, NotebookPen, 
  Download, Loader2, CalendarDays, Target, Pencil
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatUGX } from "@/lib/courses";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Accounts — Sandstone School" }] }),
  component: AccountsPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────
type Transaction = { id: string; type: string; amount: number; date: string; description?: string | null; };
type Plan = { id: string; day: string; task: string; done: boolean };

const PLAN_KEY = "ssl.accounts.plans";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getWeekLabel(d = new Date()) {
  const year = d.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const numberOfDays = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((numberOfDays + oneJan.getDay() + 1) / 7);
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

const useLocal = <T,>(key: string, initial: T) => {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => { try { const raw = localStorage.getItem(key); if (raw) setValue(JSON.parse(raw)); } catch {} }, [key]);
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
};

function AccountsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plans, setPlans] = useLocal<Plan[]>(PLAN_KEY, []);
  const [loading, setLoading] = useState(true);

  // Budget States
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loadingBudgets, setLoadingBudgets] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(getWeekLabel());
  const [availableWeeks, setAvailableWeeks] = useState<string[]>([getWeekLabel()]);
  
  const currentWeekLabel = useMemo(() => getWeekLabel(), []);

  // Filters
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<"week" | "month" | "year" | "all" | "custom">("month");
  
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Year and Month Filters
  const [selectedYear, setSelectedYear] = useState("all");
  const [selectedSpecificMonth, setSelectedSpecificMonth] = useState("all");

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("transactions").select("*").order("date", { ascending: false });
    if (data) setTransactions(data as Transaction[]);
    setLoading(false);
  }, []);

  const fetchBudgets = useCallback(async () => {
    setLoadingBudgets(true);
    const { data } = await supabase.from("budgets").select("*").order("budget_date", { ascending: false });
    if (data) {
      setBudgets(data);
      const weeks = Array.from(new Set(data.map(b => b.week_label))).sort().reverse();
      if (!weeks.includes(currentWeekLabel)) weeks.unshift(currentWeekLabel);
      setAvailableWeeks(weeks);
    }
    setLoadingBudgets(false);
  }, [currentWeekLabel]);

  useEffect(() => { fetchTransactions(); fetchBudgets(); }, [fetchTransactions, fetchBudgets]);

  // Available years and months
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    transactions.forEach(t => {
      const d = new Date(t.date);
      years.add(String(d.getFullYear()));
    });
    return Array.from(years).sort().reverse();
  }, [transactions]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    transactions.forEach(t => {
      const d = new Date(t.date);
      months.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });
    return Array.from(months).sort().reverse();
  }, [transactions]);

  // Derived Data
  const categories = useMemo(() => {
    const cats = new Set(transactions.map(t => t.type || "Uncategorized").filter(Boolean));
    return Array.from(cats).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    return transactions.filter(t => {
      const d = new Date(t.date);
      const tYear = String(d.getFullYear());
      const tMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (selectedYear !== "all" && tYear !== selectedYear) return false;
      if (selectedSpecificMonth !== "all" && tMonth !== selectedSpecificMonth) return false;

      if (dateRange === "week" && d < weekStart) return false;
      if (dateRange === "month" && d < monthStart) return false;
      if (dateRange === "year" && d < yearStart) return false;
      
      if (dateRange === "custom") {
        if (dateFrom && d < new Date(dateFrom)) return false;
        if (dateTo && d > new Date(dateTo)) return false;
      }

      const isIn = t.description?.includes("Money In");
      if (filterType === "income" && !isIn) return false;
      if (filterType === "expense" && isIn) return false;

      if (filterCategory !== "all" && t.type !== filterCategory) return false;
      
      const searchLower = searchQuery.toLowerCase();
      return !searchQuery || 
        t.type.toLowerCase().includes(searchLower) || 
        (t.description && t.description.toLowerCase().includes(searchLower));
    });
  }, [transactions, filterType, filterCategory, searchQuery, dateRange, dateFrom, dateTo, selectedYear, selectedSpecificMonth]);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of filteredTransactions) { 
      const amt = Number(t.amount); 
      const isIn = t.description?.includes("Money In");
      if (isIn) income += amt; 
      else expense += amt; 
    }
    return { income, expense, net: income - expense };
  }, [filteredTransactions]);

  const globalTotals = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of transactions) { 
      const amt = Number(t.amount); 
      const isIn = t.description?.includes("Money In");
      if (isIn) income += amt; 
      else expense += amt; 
    }
    return { income, expense, net: income - expense };
  }, [transactions]);

  // Budget Logic
  const weekBudgets = useMemo(() => budgets.filter(b => b.week_label === selectedWeek), [budgets, selectedWeek]);
  const isWeekFinalized = weekBudgets.length > 0 && weekBudgets.every(b => b.is_finalized);

  const addBudget = async (entry: any) => {
    const { error } = await supabase.from("budgets").insert(entry);
    if (error) { toast.error("Failed to add budget: " + error.message); return false; }
    toast.success("Budget item added");
    fetchBudgets();
    return true;
  };

  const removeBudget = async (id: string) => {
    if (!confirm("Remove this budget item?")) return;
    const { error } = await supabase.from("budgets").delete().eq("id", id);
    if (error) { toast.error("Failed to delete: " + error.message); return; }
    toast.success("Budget item removed");
    fetchBudgets();
  };

  const finalizeWeek = async () => {
    if (!confirm(`Are you sure you want to finalize ${selectedWeek}? Records will be locked for historical tracking.`)) return;
    const { error } = await supabase.from("budgets").update({ is_finalized: true }).eq("week_label", selectedWeek);
    if (!error) { toast.success("Week finalized successfully!"); fetchBudgets(); }
    else toast.error("Failed to finalize week.");
  };

  // Ledger Actions
  const addTransaction = async (entry: Omit<Transaction, "id">) => {
    const { error } = await supabase.from("transactions").insert(entry);
    if (error) { toast.error("Failed to add: " + error.message); return false; }
    toast.success(`Transaction recorded`);
    fetchTransactions();
    return true;
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
    const { error } = await supabase.from("transactions").update(data).eq("id", id);
    if (error) { 
      toast.error("Failed to update: " + error.message); 
      return false; 
    }
    toast.success("Transaction updated");
    fetchTransactions();
    return true;
  };

  const removeTransaction = async (id: string) => {
    if (!confirm("Delete this transaction?")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) { toast.error("Failed to delete: " + error.message); return; }
    toast.success("Transaction deleted");
    fetchTransactions();
  };

  const exportCSV = () => {
    const headers = ["Date", "Source/Type", "Direction", "Amount", "Note"];
    const rows = filteredTransactions.map(t => {
      const descParts = t.description?.split("|").map(s => s.trim()) || [];
      const direction = descParts[0] || "—";
      const note = descParts.slice(1).join("|").trim() || "";
      return [t.date, t.type, direction, t.amount, note];
    });
    const csvContent = [headers.join(","), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `accounts_ledger_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Ledger exported successfully");
  };

  const exportFilteredCSV = () => {
    const headers = ["Date", "Source/Type", "Direction", "Amount (UGX)", "Note"];
    const rows = filteredTransactions.map(t => {
      const descParts = t.description?.split("|").map(s => s.trim()) || [];
      const direction = descParts[0] || "—";
      const note = descParts.slice(1).join("|").trim() || "";
      const isIn = direction.includes("In");
      return [
        t.date, 
        t.type, 
        direction, 
        isIn ? `+${t.amount}` : `-${t.amount}`,
        note
      ];
    });
    
    const csvContent = [
      headers.join(","), 
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    let filename = "transactions";
    if (selectedSpecificMonth !== "all") {
      const [year, month] = selectedSpecificMonth.split('-');
      const monthName = new Date(Number(year), Number(month) - 1).toLocaleDateString('en-UG', { month: 'long', year: 'numeric' });
      filename = `transactions_${monthName.replace(' ', '_')}`;
    } else if (selectedYear !== "all") {
      filename = `transactions_${selectedYear}`;
    } else if (dateFrom && dateTo) {
      filename = `transactions_${dateFrom}_to_${dateTo}`;
    }
    
    link.href = url;
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredTransactions.length} transactions`);
  };

  const addPlan = (day: string, task: string) => { if (!task.trim()) return; setPlans((p) => [...p, { id: crypto.randomUUID(), day, task: task.trim(), done: false }]); };
  const togglePlan = (id: string) => setPlans((p) => p.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  const removePlan = (id: string) => setPlans((p) => p.filter((x) => x.id !== id));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts & Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">Track income, expenses, and manage weekly budgets.</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Income (All Time)" value={globalTotals.income} icon={TrendingUp} tone="emerald" />
        <StatCard label="Total Expenses (All Time)" value={globalTotals.expense} icon={TrendingDown} tone="rose" />
        <StatCard label="Net Profit (All Time)" value={globalTotals.net} icon={Wallet} tone={globalTotals.net >= 0 ? "indigo" : "amber"} isNet />
        <StatCard label={`Filtered Net (${selectedSpecificMonth !== "all" ? selectedSpecificMonth : dateRange})`} value={totals.net} icon={CalendarDays} tone={totals.net >= 0 ? "emerald" : "rose"} isNet />
      </div>

      <Tabs defaultValue="ledger" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ledger">Financial Ledger</TabsTrigger>
          <TabsTrigger value="budget">Weekly Budget</TabsTrigger>
          <TabsTrigger value="planner">Weekly Planner</TabsTrigger>
        </TabsList>

        {/* ─ LEDGER TAB ── */}
        <TabsContent value="ledger" className="space-y-4">
          <Card className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Period</Label>
                <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {dateRange === "custom" && (
                <>
                  <div>
                    <Label className="text-xs">From Date</Label>
                    <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">To Date</Label>
                    <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                  </div>
                </>
              )}

              <div>
                <Label className="text-xs font-semibold text-primary">Filter by Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-primary">Filter by Month</Label>
                <Select value={selectedSpecificMonth} onValueChange={setSelectedSpecificMonth}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Months</SelectItem>
                    {availableMonths.map(m => {
                      const [y, mo] = m.split('-');
                      const label = new Date(Number(y), Number(mo) - 1).toLocaleDateString('en-UG', { month: 'long', year: 'numeric' });
                      return <SelectItem key={m} value={m}>{label}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Direction</Label>
                <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Flows</SelectItem>
                    <SelectItem value="income">Money In</SelectItem>
                    <SelectItem value="expense">Money Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Source / Category</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 md:col-span-1">
                <Label className="text-xs">Search</Label>
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Notes..." />
              </div>
            </div>
          </Card>

          <TransactionForm onAdd={addTransaction} categories={categories} />

          {/* ── TABLE WITH DATE FILTER AND INLINE EDITING ─ */}
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b bg-muted/30 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <Label className="text-sm font-semibold">Filter by Date Range:</Label>
              </div>
              <Input 
                type="date" 
                value={dateFrom} 
                onChange={e => setDateFrom(e.target.value)} 
                className="w-auto max-w-[150px]"
                placeholder="From"
              />
              <span className="text-muted-foreground">to</span>
              <Input 
                type="date" 
                value={dateTo} 
                onChange={e => setDateTo(e.target.value)} 
                className="w-auto max-w-[150px]"
                placeholder="To"
              />
              <Button 
                variant="default"
                size="sm"
                onClick={() => {
                  setDateRange("custom");
                }}
                className="bg-primary text-primary-foreground"
              >
                Apply Filter
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setDateRange("all");
                  setSelectedYear("all");
                  setSelectedSpecificMonth("all");
                }}
              >
                Clear All
              </Button>
              <Badge variant="secondary" className="ml-auto">
                {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
              </Badge>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  exportFilteredCSV();
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Filtered
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Source / Type</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : filteredTransactions.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No transactions found for this filter.</TableCell></TableRow>
                ) : (
                  filteredTransactions.map((t) => {
                    const descParts = t.description?.split("|").map(s => s.trim()) || [];
                    const direction = descParts[0] || "—";
                    const note = descParts.slice(1).join("|").trim() || "—";
                    const isIn = direction.includes("In");
                    
                    return (
                      <TransactionRow 
                        key={t.id} 
                        transaction={t} 
                        direction={direction}
                        note={note}
                        isIn={isIn}
                        onUpdate={updateTransaction}
                        onDelete={removeTransaction}
                      />
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── BUDGET TAB ── */}
        <TabsContent value="budget" className="space-y-4">
          <Card className="p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs font-semibold">Select Week to View/Manage</Label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableWeeks.map(w => <SelectItem key={w} value={w}>{w} {w === currentWeekLabel ? "(Current)" : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => setSelectedWeek(currentWeekLabel)} disabled={selectedWeek === currentWeekLabel}>
                Go to Current Week
              </Button>
              <Button 
                onClick={finalizeWeek} 
                disabled={isWeekFinalized || selectedWeek !== currentWeekLabel}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {isWeekFinalized ? "Week Finalized" : "Finalize & Lock Week"}
              </Button>
            </div>
          </Card>

          <BudgetForm onAdd={addBudget} weekLabel={selectedWeek} disabled={isWeekFinalized} />

          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Budget Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Planned (UGX)</TableHead>
                  <TableHead className="text-right">Actual Spent (UGX)</TableHead>
                  <TableHead>Notes</TableHead>
                  {!isWeekFinalized && <TableHead className="w-12 text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingBudgets ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : weekBudgets.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">No budget planned for {selectedWeek} yet.</TableCell></TableRow>
                ) : (
                  weekBudgets.map((b) => (
                    <TableRow key={b.id} className={b.is_finalized ? "bg-muted/30" : ""}>
                      <TableCell className="font-mono text-xs">{b.budget_date}</TableCell>
                      <TableCell className="font-medium">{b.category}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{formatUGX(b.planned_amount)}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums text-rose-600">{formatUGX(b.actual_amount)}</TableCell>
                      <TableCell className="text-muted-foreground">{b.notes || "—"}</TableCell>
                      {!isWeekFinalized && (
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => removeBudget(b.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ── PLANNER TAB ── */}
        <TabsContent value="planner">
          <Planner plans={plans} onAdd={addPlan} onToggle={togglePlan} onRemove={removePlan} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Transaction Row with Inline Editing ──
function TransactionRow({ 
  transaction, 
  direction, 
  note, 
  isIn, 
  onUpdate, 
  onDelete 
}: { 
  transaction: Transaction; 
  direction: string;
  note: string;
  isIn: boolean;
  onUpdate: (id: string, data: Partial<Transaction>) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDate, setEditDate] = useState(transaction.date);
  const [editType, setEditType] = useState(transaction.type);
  const [editAmount, setEditAmount] = useState(String(transaction.amount));
  const [editDirection, setEditDirection] = useState(isIn ? "Money In" : "Money Out");
  const [editNote, setEditNote] = useState(note);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const newDescription = `${editDirection}${editNote.trim() ? ` | ${editNote.trim()}` : ""}`;
    const success = await onUpdate(transaction.id, {
      date: editDate,
      type: editType,
      amount: Number(editAmount),
      description: newDescription,
    });
    setSaving(false);
    if (success) setIsEditing(false);
  };

  const handleCancel = () => {
    setEditDate(transaction.date);
    setEditType(transaction.type);
    setEditAmount(String(transaction.amount));
    setEditDirection(isIn ? "Money In" : "Money Out");
    setEditNote(note);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <TableRow className="bg-muted/50">
        <TableCell>
          <Input 
            type="date" 
            value={editDate} 
            onChange={(e) => setEditDate(e.target.value)}
            className="w-[130px]"
          />
        </TableCell>
        <TableCell>
          <Input 
            value={editType} 
            onChange={(e) => setEditType(e.target.value)}
            className="w-[150px]"
            placeholder="Source..."
          />
        </TableCell>
        <TableCell>
          <Select value={editDirection} onValueChange={setEditDirection}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Money In">Money In</SelectItem>
              <SelectItem value="Money Out">Money Out</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Input 
            value={editNote} 
            onChange={(e) => setEditNote(e.target.value)}
            className="w-[200px]"
            placeholder="Note..."
          />
        </TableCell>
        <TableCell>
          <Input 
            type="number"
            value={editAmount} 
            onChange={(e) => setEditAmount(e.target.value)}
            className="w-[120px] text-right"
            placeholder="0"
          />
        </TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-1">
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
              className="h-7 px-2 text-xs"
            >
              Cancel
            </Button>
            <Button 
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-7 px-2 text-xs"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow className="group hover:bg-muted/30">
      <TableCell className="font-mono text-xs">{transaction.date}</TableCell>
      <TableCell className="font-medium">{transaction.type}</TableCell>
      <TableCell>
        <Badge variant={isIn ? "default" : "destructive"} className="text-xs">
          {direction}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground max-w-[200px] truncate" title={note}>
        {note}
      </TableCell>
      <TableCell className={`text-right font-bold tabular-nums ${isIn ? "text-emerald-600" : "text-rose-600"}`}>
        {isIn ? "+" : "-"}{formatUGX(Number(transaction.amount))}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => setIsEditing(true)}
            className="h-7 w-7 text-muted-foreground hover:text-primary"
            title="Edit transaction"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={() => onDelete(transaction.id)}
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            title="Delete transaction"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── Sub-Components ─────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, tone, isNet = false }: { label: string; value: number; icon: any; tone: "emerald" | "rose" | "indigo" | "amber"; isNet?: boolean }) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  };
  const displayValue = formatUGX(Math.abs(value));
  const prefix = isNet ? (value >= 0 ? "+" : "-") : "";
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className={`text-xl font-bold mt-1 tabular-nums ${isNet && value < 0 ? "text-rose-600" : ""}`}>{prefix}{displayValue}</p>
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
      </div>
    </Card>
  );
}

// ── Transaction Form ────────────────────────────────────────────────────────
function TransactionForm({ onAdd, categories }: { onAdd: (e: Omit<Transaction, "id">) => Promise<boolean>; categories: string[] }) {
  const [direction, setDirection] = useState<"income" | "expense">("income");
  const [source, setSource] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!source.trim() || !amt || amt <= 0) return toast.error("Source and valid amount required");
    
    const finalDescription = `${direction === "income" ? "Money In" : "Money Out"}${note.trim() ? ` | ${note.trim()}` : ""}`;
    
    setSubmitting(true);
    const success = await onAdd({ type: source.trim(), amount: amt, date, description: finalDescription });
    setSubmitting(false);
    if (success) { setSource(""); setAmount(""); setNote(""); }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4"><Plus className="h-5 w-5 text-primary" /><h2 className="font-semibold">Record Transaction</h2></div>
      <form onSubmit={submit} className="grid md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-2">
          <Label className="text-xs">Source / Category</Label>
          <Input 
            value={source} 
            onChange={(e) => setSource(e.target.value)} 
            placeholder="Type any source: Tuition, Salary, Donation..." 
            list="sources-list" 
          />
          <datalist id="sources-list">
            {Array.from(new Set([
              "Tuition", "Donation", "Grant", "Admission Fee", "Book Sale", 
              "Salary", "Utilities", "Maintenance", "Transport", "Stationery", "Rent", "Other",
              ...categories
            ])).map(c => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div className="md:col-span-1">
          <Label className="text-xs">Direction</Label>
          <Select value={direction} onValueChange={(v: any) => setDirection(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Money In</SelectItem>
              <SelectItem value="expense">Money Out</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Amount (UGX)</Label>
          <Input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Button type="submit" disabled={submitting} className="md:col-span-1">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Add
        </Button>
        <div className="md:col-span-6">
          <Label className="text-xs">Note / Description (optional)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Additional details..." />
        </div>
      </form>
    </Card>
  );
}

function BudgetForm({ onAdd, weekLabel, disabled }: { onAdd: (b: any) => Promise<boolean>; weekLabel: string; disabled: boolean }) {
  const [category, setCategory] = useState("");
  const [planned, setPlanned] = useState("");
  const [budgetDate, setBudgetDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category.trim() || !planned) return toast.error("Category and planned amount required");
    setSubmitting(true);
    const success = await onAdd({ week_label: weekLabel, category: category.trim(), planned_amount: Number(planned), budget_date: budgetDate, notes: notes.trim() });
    setSubmitting(false);
    if (success) { setCategory(""); setPlanned(""); setNotes(""); }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4"><Target className="h-5 w-5 text-primary" /><h2 className="font-semibold">Add Budget Entry for {weekLabel}</h2></div>
      <form onSubmit={submit} className="grid md:grid-cols-5 gap-3 items-end">
        <div><Label className="text-xs">Budget Date</Label><Input type="date" value={budgetDate} onChange={(e) => setBudgetDate(e.target.value)} disabled={disabled} /></div>
        <div><Label className="text-xs">Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Utilities" disabled={disabled} /></div>
        <div><Label className="text-xs">Planned (UGX)</Label><Input type="number" min="0" value={planned} onChange={(e) => setPlanned(e.target.value)} placeholder="0" disabled={disabled} /></div>
        <div><Label className="text-xs">Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Details..." disabled={disabled} /></div>
        <Button type="submit" disabled={submitting || disabled}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Add</Button>
      </form>
      {disabled && <p className="text-xs text-muted-foreground mt-3 italic">This week has been finalized. Records are locked for historical tracking.</p>}
    </Card>
  );
}

function Planner({ plans, onAdd, onToggle, onRemove }: { plans: Plan[]; onAdd: (day: string, task: string) => void; onToggle: (id: string) => void; onRemove: (id: string) => void }) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4"><NotebookPen className="h-5 w-5 text-primary" /><h2 className="font-semibold">Weekly Planner</h2></div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DAYS.map((day) => (
          <div key={day} className="rounded-lg border p-3 bg-card">
            <p className="font-medium text-sm mb-2 text-primary">{day}</p>
            <ul className="space-y-1 mb-3 min-h-[2rem]">
              {plans.filter((p) => p.day === day).map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm group">
                  <input type="checkbox" checked={p.done} onChange={() => onToggle(p.id)} className="rounded border-gray-300" />
                  <span className={p.done ? "line-through text-muted-foreground flex-1" : "flex-1"}>{p.task}</span>
                  <button onClick={() => onRemove(p.id)} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
            <div className="flex gap-1">
              <Input value={draft[day] || ""} onChange={(e) => setDraft((d) => ({ ...d, [day]: e.target.value }))} placeholder="Add task…" className="h-8 text-sm"
                onKeyDown={(e) => { if (e.key === "Enter") { onAdd(day, draft[day] || ""); setDraft((d) => ({ ...d, [day]: "" })); } }} />
              <Button size="icon" variant="secondary" onClick={() => { onAdd(day, draft[day] || ""); setDraft((d) => ({ ...d, [day]: "" })); }} className="h-8 w-8"><Plus className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}