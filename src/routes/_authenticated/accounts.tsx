import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { 
  Plus, Trash2, TrendingUp, TrendingDown, Wallet, NotebookPen, 
  Download, Loader2, CalendarDays 
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

// ── Types (Matches your exact Supabase schema) ─────────────────────────────
type Transaction = {
  id: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  description?: string | null;
};

type Plan = { id: string; day: string; task: string; done: boolean };

const PLAN_KEY = "ssl.accounts.plans";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// ── Helpers ────────────────────────────────────────────────────────────────
function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

const useLocal = <T,>(key: string, initial: T) => {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw));
    } catch {}
  }, [key]);
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);
  return [value, setValue] as const;
};

// ── Main Page ──────────────────────────────────────────────────────────────
function AccountsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plans, setPlans] = useLocal<Plan[]>(PLAN_KEY, []);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<"week" | "month" | "year" | "all">("month");

  // ── Fetch Transactions ───────────────────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false });
    
    if (error) {
      toast.error("Failed to load transactions: " + error.message);
    } else {
      setTransactions((data ?? []) as Transaction[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // ── Derived Data (Smart parsing of the description field) ────────────────
  const categories = useMemo(() => {
    const cats = new Set(
      transactions
        .map(t => t.description?.split("—")[0]?.trim() || "Uncategorized")
        .filter(Boolean)
    );
    return Array.from(cats).sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    return transactions.filter(t => {
      const d = new Date(t.date);
      
      // Date range filter
      if (dateRange === "week" && d < weekStart) return false;
      if (dateRange === "month" && d < monthStart) return false;
      if (dateRange === "year" && d < yearStart) return false;

      // Type filter
      if (filterType !== "all" && t.type !== filterType) return false;

      // Category filter (parsed from description)
      const tCat = t.description?.split("—")[0]?.trim() || "Uncategorized";
      if (filterCategory !== "all" && tCat !== filterCategory) return false;

      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchSearch = !searchQuery || 
        tCat.toLowerCase().includes(searchLower) ||
        (t.description && t.description.toLowerCase().includes(searchLower));

      return matchSearch;
    });
  }, [transactions, filterType, filterCategory, searchQuery, dateRange]);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of filteredTransactions) {
      const amt = Number(t.amount);
      if (t.type === "income") income += amt;
      else expense += amt;
    }
    return { income, expense, net: income - expense };
  }, [filteredTransactions]);

  const globalTotals = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of transactions) {
      const amt = Number(t.amount);
      if (t.type === "income") income += amt;
      else expense += amt;
    }
    return { income, expense, net: income - expense };
  }, [transactions]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const addTransaction = async (entry: Omit<Transaction, "id">) => {
    const { error } = await supabase.from("transactions").insert(entry);
    if (error) {
      toast.error("Failed to add transaction: " + error.message);
      return false;
    }
    toast.success(`${entry.type === "income" ? "Income" : "Expense"} recorded`);
    fetchTransactions();
    return true;
  };

  const removeTransaction = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction? This won't delete the original student payment record.")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete: " + error.message);
      return;
    }
    toast.success("Transaction deleted");
    fetchTransactions();
  };

  const exportCSV = () => {
    const headers = ["Date", "Type", "Category", "Amount", "Note/Description"];
    const rows = filteredTransactions.map(t => {
      const cat = t.description ? t.description.split("—")[0].trim() : "Uncategorized";
      const note = t.description && t.description.includes("—") ? t.description.split("—").slice(1).join("—").trim() : "";
      return [t.date, t.type, cat, t.amount, note];
    });
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
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

  // ── Planner Actions ──────────────────────────────────────────────────────
  const addPlan = (day: string, task: string) => {
    if (!task.trim()) return;
    setPlans((p) => [...p, { id: crypto.randomUUID(), day, task: task.trim(), done: false }]);
  };
  const togglePlan = (id: string) =>
    setPlans((p) => p.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  const removePlan = (id: string) => setPlans((p) => p.filter((x) => x.id !== id));

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Accounts & Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track income, expenses, and monitor financial health. Auto-syncs with Admissions & Payments.
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </header>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Total Income (All Time)" 
          value={globalTotals.income} 
          icon={TrendingUp} 
          tone="emerald" 
        />
        <StatCard 
          label="Total Expenses (All Time)" 
          value={globalTotals.expense} 
          icon={TrendingDown} 
          tone="rose" 
        />
        <StatCard 
          label="Net Profit (All Time)" 
          value={globalTotals.net} 
          icon={Wallet} 
          tone={globalTotals.net >= 0 ? "indigo" : "amber"} 
          isNet 
        />
        <StatCard 
          label={`Filtered Net (${dateRange})`} 
          value={totals.net} 
          icon={CalendarDays} 
          tone={totals.net >= 0 ? "emerald" : "rose"} 
          isNet 
        />
      </div>

      <Tabs defaultValue="ledger" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ledger">Financial Ledger</TabsTrigger>
          <TabsTrigger value="planner">Weekly Planner</TabsTrigger>
        </TabsList>

        <TabsContent value="ledger" className="space-y-4">
          {/* Filters */}
          <Card className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="col-span-2 md:col-span-1">
                <Label className="text-xs">Period</Label>
                <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">This Week</SelectItem>
                    <SelectItem value="month">This Month</SelectItem>
                    <SelectItem value="year">This Year</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="income">Income Only</SelectItem>
                    <SelectItem value="expense">Expenses Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 md:col-span-2">
                <Label className="text-xs">Search Notes/Description</Label>
                <Input 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  placeholder="e.g. Tuition, Salaries, Admission..." 
                />
              </div>
            </div>
          </Card>

          {/* Add Manual Entry Form */}
          <TransactionForm onAdd={addTransaction} categories={categories} />

          {/* Ledger Table */}
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category / Description</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-12 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                      No transactions found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.map((t) => {
                    // Smart parsing: splits "Category — Note" back into two columns
                    const displayCategory = t.description ? t.description.split("—")[0].trim() : "Uncategorized";
                    const displayNote = t.description && t.description.includes("—") 
                      ? t.description.split("—").slice(1).join("—").trim() 
                      : "";
                    
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.date}</TableCell>
                        <TableCell>
                          <Badge variant={t.type === "income" ? "default" : "destructive"} className="capitalize">
                            {t.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{displayCategory}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate" title={displayNote}>
                          {displayNote || "—"}
                        </TableCell>
                        <TableCell className={`text-right font-bold tabular-nums ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                          {t.type === "expense" ? "-" : "+"}{formatUGX(Number(t.amount))}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => removeTransaction(t.id)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="planner">
          <Planner plans={plans} onAdd={addPlan} onToggle={togglePlan} onRemove={removePlan} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Sub-Components ─────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, tone, isNet = false,
}: { 
  label: string; value: number; icon: any; 
  tone: "emerald" | "rose" | "indigo" | "amber"; 
  isNet?: boolean 
}) {
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
          <p className={`text-xl font-bold mt-1 tabular-nums ${isNet && value < 0 ? "text-rose-600" : ""}`}>
            {prefix}{displayValue}
          </p>
        </div>
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function TransactionForm({ 
  onAdd, categories 
}: { 
  onAdd: (e: Omit<Transaction, "id">) => Promise<boolean>; 
  categories: string[] 
}) {
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!category.trim() || !amt || amt <= 0) return toast.error("Category and valid amount required");
    
    // Combine category and note into the description field to match your database schema
    const finalDescription = note.trim() 
      ? `${category.trim()} — ${note.trim()}` 
      : category.trim();

    setSubmitting(true);
    const success = await onAdd({ 
      type: kind, 
      amount: amt, 
      date, 
      description: finalDescription
    });
    setSubmitting(false);
    
    if (success) {
      setCategory(""); 
      setAmount(""); 
      setNote("");
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Plus className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Record Manual Transaction</h2>
        <p className="text-xs text-muted-foreground ml-auto hidden md:block">
          Note: Income from Admissions & Payments is added automatically.
        </p>
      </div>
      <form onSubmit={submit} className="grid md:grid-cols-6 gap-3 items-end">
        <div className="md:col-span-1">
          <Label className="text-xs">Type</Label>
          <Select value={kind} onValueChange={(v: any) => setKind(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label className="text-xs">Category</Label>
          <Input 
            value={category} 
            onChange={(e) => setCategory(e.target.value)} 
            placeholder="e.g. Salaries, Utilities, Tuition" 
            list="categories-list"
          />
          <datalist id="categories-list">
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
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
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
          Add
        </Button>
        <div className="md:col-span-6">
          <Label className="text-xs">Note / Description (optional)</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Additional details..." />
        </div>
      </form>
    </Card>
  );
}

function Planner({
  plans, onAdd, onToggle, onRemove,
}: {
  plans: Plan[];
  onAdd: (day: string, task: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <NotebookPen className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Weekly Planner</h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DAYS.map((day) => (
          <div key={day} className="rounded-lg border p-3 bg-card">
            <p className="font-medium text-sm mb-2 text-primary">{day}</p>
            <ul className="space-y-1 mb-3 min-h-[2rem]">
              {plans.filter((p) => p.day === day).map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm group">
                  <input
                    type="checkbox"
                    checked={p.done}
                    onChange={() => onToggle(p.id)}
                    className="rounded border-gray-300"
                  />
                  <span className={p.done ? "line-through text-muted-foreground flex-1" : "flex-1"}>
                    {p.task}
                  </span>
                  <button 
                    onClick={() => onRemove(p.id)} 
                    className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-1">
              <Input
                value={draft[day] || ""}
                onChange={(e) => setDraft((d) => ({ ...d, [day]: e.target.value }))}
                placeholder="Add task…"
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onAdd(day, draft[day] || "");
                    setDraft((d) => ({ ...d, [day]: "" }));
                  }
                }}
              />
              <Button
                size="icon"
                variant="secondary"
                onClick={() => { onAdd(day, draft[day] || ""); setDraft((d) => ({ ...d, [day]: "" })); }}
                className="h-8 w-8"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}