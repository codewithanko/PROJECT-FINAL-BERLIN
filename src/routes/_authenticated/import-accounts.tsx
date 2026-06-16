import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useRef } from "react";
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2,
  Loader2, Download, X, ChevronRight, Info, TrendingUp, TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/import-accounts")({
  head: () => ({ meta: [{ title: "Import Accounts — Sandstone School" }] }),
  component: ImportAccountsPage,
});

type FieldKey = "type" | "amount" | "date" | "description";
const FIELD_LABELS: Record<FieldKey, string> = {
  type: "Transaction Type (income/expense)",
  amount: "Amount (UGX)",
  date: "Date",
  description: "Category / Description",
};

const TYPE_ALIASES: Record<string, "income" | "expense"> = {
  income: "income", "in": "income", credit: "income", receipt: "income", revenue: "income", earned: "income", received: "income",
  expense: "expense", "out": "expense", debit: "expense", expenditure: "expense", cost: "expense", payment: "expense", spent: "expense", paid: "expense",
};

type ParsedRow = {
  _row: number; type: "income" | "expense" | ""; amount: number;
  date: string; description: string; _errors: string[]; _valid: boolean;
};

function parseExcelDate(val: any): string {
  if (!val) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === "string" && val.match(/^\d{4}-\d{2}-\d{2}/)) return val.slice(0, 10);
  if (typeof val === "string" && val.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
    const [d, m, y] = val.split("/");
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (typeof val === "number") {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return String(val).trim();
}

function ImportAccountsPage() {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  // FIX: Changed initial empty strings to "__none__"
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({
    type: "__none__", amount: "__none__", date: "__none__", description: "__none__",
  });
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ inserted: number; skipped: number; totalIncome: number; totalExpense: number }>({
    inserted: 0, skipped: 0, totalIncome: 0, totalExpense: 0,
  });
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Please upload an Excel file (.xlsx, .xls) or CSV");
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (json.length === 0) { toast.error("File is empty"); return; }
        
        const headers = Object.keys(json[0]);
        setRawHeaders(headers);
        setRawRows(json);
        
        // FIX: Changed initial empty strings to "__none__"
        const autoMap: Record<FieldKey, string> = { type: "__none__", amount: "__none__", date: "__none__", description: "__none__" };
        headers.forEach(h => {
          const l = h.toLowerCase().trim();
          if (["type", "transaction type", "kind", "category type"].includes(l)) autoMap.type = h;
          else if (["amount", "ugx", "sum", "value", "total", "money"].includes(l)) autoMap.amount = h;
          else if (["date", "transaction date", "day", "period"].includes(l)) autoMap.date = h;
          else if (["description", "category", "details", "note", "notes", "item", "particulars"].includes(l)) autoMap.description = h;
        });
        setMapping(autoMap);
        toast.success(`Loaded ${json.length} rows`);
        setStep("map");
      } catch (err: any) {
        toast.error("Failed to read file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const runParse = () => {
    const rows: ParsedRow[] = rawRows.map((row, i) => {
      // FIX: Added check for "__none__"
      const get = (f: FieldKey) => {
        const col = mapping[f];
        return (col && col !== "__none__") ? String(row[col] ?? "").trim() : "";
      };
      
      const errors: string[] = [];
      const rawType = get("type").toLowerCase();
      const type = TYPE_ALIASES[rawType] || "";
      const rawAmount = get("amount").replace(/[^0-9.]/g, "");
      const amount = Number(rawAmount) || 0;
      // FIX: Added check for "__none__"
      const date = parseExcelDate(mapping.date && mapping.date !== "__none__" ? row[mapping.date] : "");
      const description = get("description") || "Imported transaction";

      if (!type) errors.push(`Unknown type: "${get("type")}" (use income or expense)`);
      if (!amount || amount <= 0) errors.push("Amount must be greater than 0");
      if (!date || !date.match(/^\d{4}-\d{2}-\d{2}/)) errors.push(`Invalid date: "${get("date")}"`);

      return {
        _row: i + 2, type: type as "income" | "expense" | "", amount, date, description,
        _errors: errors, _valid: errors.length === 0,
      };
    });
    setParsed(rows);
    setStep("preview");
  };

  const runImport = async () => {
    const valid = parsed.filter(r => r._valid);
    if (valid.length === 0) { toast.error("No valid rows to import"); return; }
    setImporting(true);
    const BATCH = 100;
    let inserted = 0, skipped = 0;
    let totalIncome = 0, totalExpense = 0;

    for (let i = 0; i < valid.length; i += BATCH) {
      const batch = valid.slice(i, i + BATCH).map(r => ({
        type: r.type, amount: r.amount, date: r.date, description: r.description,
      }));

      const { data, error } = await supabase.from("transactions").insert(batch).select();

      if (error) {
        skipped += batch.length;
        toast.error(`Batch error: ${error.message}`);
      } else {
        inserted += data?.length ?? batch.length;
        batch.forEach(r => {
          if (r.type === "income") totalIncome += r.amount;
          else totalExpense += r.amount;
        });
      }
    }

    setResults({ inserted, skipped, totalIncome, totalExpense });
    setImporting(false);
    setStep("done");
    toast.success(`Import complete — ${inserted} transactions recorded`);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Date", "Type", "Amount", "Description"],
      ["2024-01-15", "income", "150000", "Tuition — Aisha Nakato"],
      ["2024-01-16", "expense", "45000", "Stationery"],
      ["2024-01-20", "income", "200000", "Admission payment — Brian Okello"],
      ["2024-02-01", "expense", "500000", "Salaries"],
    ]);
    ws["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");
    XLSX.writeFile(wb, "sandstone_accounts_template.xlsx");
    toast.success("Template downloaded");
  };

  const validCount = parsed.filter(r => r._valid).length;
  const invalidCount = parsed.filter(r => !r._valid).length;
  const previewIncome = parsed.filter(r => r._valid && r.type === "income").reduce((s, r) => s + r.amount, 0);
  const previewExpense = parsed.filter(r => r._valid && r.type === "expense").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Import Account Transactions</h1>
        <p className="text-muted-foreground mt-1">Upload your Excel income and expense records — maps, validates, and imports them into the accounts ledger.</p>
      </header>

      <div className="flex items-center gap-2 text-sm">
        {(["upload", "map", "preview", "done"] as const).map((s, i, arr) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold
              ${step === s ? "bg-primary text-primary-foreground" :
                arr.indexOf(step) > i ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
              {arr.indexOf(step) > i ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={step === s ? "font-semibold" : "text-muted-foreground capitalize"}>{s}</span>
            {i < arr.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {step === "upload" && (
        <div className="space-y-4">
          <Card
            className={`border-2 border-dashed p-12 text-center cursor-pointer transition-colors
              ${dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-semibold text-lg">Drop your Excel file here</p>
            <p className="text-muted-foreground text-sm mt-1">or click to browse — supports .xlsx, .xls, .csv</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </Card>

          {/* NEW: Visual Excel Guide */}
          <Card className="p-5 bg-muted/30">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-3 text-sm">
                <p className="font-semibold">Your Excel file MUST have these exact column headers in the first row:</p>
                <div className="overflow-x-auto border rounded-md bg-background">
                  <table className="w-full text-xs">
                    <thead className="bg-primary/10 text-primary">
                      <tr>
                        <th className="px-3 py-2 text-left border-r">Date *</th>
                        <th className="px-3 py-2 text-left border-r">Type *</th>
                        <th className="px-3 py-2 text-left border-r">Amount *</th>
                        <th className="px-3 py-2 text-left">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="px-3 py-2 border-r text-muted-foreground">2024-01-15</td>
                        <td className="px-3 py-2 border-r text-muted-foreground">income</td>
                        <td className="px-3 py-2 border-r text-muted-foreground">150000</td>
                        <td className="px-3 py-2 text-muted-foreground">Tuition — Aisha Nakato</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  * Required columns. "Type" must be either "income" or "expense". "Date" should be YYYY-MM-DD or DD/MM/YYYY. The system accepts variations like "in/out", "credit/debit", "received/paid".
                </p>
              </div>
            </div>
          </Card>

          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-2" /> Download Template
          </Button>
        </div>
      )}

      {step === "map" && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold">Map Your Columns</h2>
                <p className="text-sm text-muted-foreground">{rawRows.length} rows • {rawHeaders.length} columns detected</p>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {(["type", "amount", "date", "description"] as FieldKey[]).map(field => (
                <div key={field} className="grid gap-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    {FIELD_LABELS[field]}
                    {field !== "description" && <span className="text-destructive">*</span>}
                  </Label>
                  <Select value={mapping[field]} onValueChange={v => setMapping(m => ({ ...m, [field]: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select column..." /></SelectTrigger>
                    <SelectContent>
                      {/* FIX: Changed value="" to value="__none__" */}
                      <SelectItem value="__none__">— Not mapped —</SelectItem>
                      {rawHeaders.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {/* FIX: Added check for "__none__" */}
                  {mapping[field] && mapping[field] !== "__none__" && (
                    <p className="text-xs text-muted-foreground">
                      Preview: <span className="font-medium">{String(rawRows[0]?.[mapping[field]] ?? "—")}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("upload")}>← Back</Button>
            {/* FIX: Updated disabled logic to check for "__none__" */}
            <Button onClick={runParse} disabled={mapping.type === "__none__" || mapping.amount === "__none__" || mapping.date === "__none__"}>
              Validate Data →
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4"><p className="text-2xl font-bold text-emerald-600">{validCount}</p><p className="text-xs text-muted-foreground">Ready to import</p></Card>
            <Card className="p-4"><p className="text-2xl font-bold text-destructive">{invalidCount}</p><p className="text-xs text-muted-foreground">Rows with errors</p></Card>
            <Card className="p-4">
              <div className="flex items-center gap-1 mb-1"><TrendingUp className="h-4 w-4 text-emerald-500" /><p className="text-xs text-muted-foreground">Total Income</p></div>
              <p className="text-sm font-bold text-emerald-600">UGX {previewIncome.toLocaleString()}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-1 mb-1"><TrendingDown className="h-4 w-4 text-destructive" /><p className="text-xs text-muted-foreground">Total Expenses</p></div>
              <p className="text-sm font-bold text-destructive">UGX {previewExpense.toLocaleString()}</p>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Description</TableHead><TableHead>Validation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.map(row => (
                  <TableRow key={row._row} className={!row._valid ? "bg-destructive/5" : ""}>
                    <TableCell className="text-muted-foreground text-xs">{row._row}</TableCell>
                    <TableCell className="font-mono text-xs">{row.date || "—"}</TableCell>
                    <TableCell>
                      {row.type ? <Badge variant={row.type === "income" ? "default" : "destructive"} className="capitalize text-xs">{row.type}</Badge> : <span className="text-destructive text-xs">—</span>}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${row.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                      {row.amount > 0 ? `UGX ${row.amount.toLocaleString()}` : "—"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{row.description}</TableCell>
                    <TableCell>
                      {row._valid ? <Badge className="bg-emerald-600 text-white text-xs">Valid</Badge> : row._errors.map((e, i) => (
                        <p key={i} className="text-xs text-destructive flex items-center gap-1"><X className="h-3 w-3" />{e}</p>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("map")}>← Back</Button>
            <Button onClick={runImport} disabled={importing || validCount === 0}>
              {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</> : <><Upload className="h-4 w-4 mr-2" /> Import {validCount} Transactions</>}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <Card className="p-8 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
          <div><h2 className="text-2xl font-bold">Import Complete</h2><p className="text-muted-foreground mt-1">All transactions have been recorded in the Accounts ledger.</p></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-lg mx-auto">
            <div><p className="text-3xl font-bold text-emerald-600">{results.inserted}</p><p className="text-xs text-muted-foreground">Imported</p></div>
            <div><p className="text-3xl font-bold text-amber-600">{results.skipped}</p><p className="text-xs text-muted-foreground">Skipped</p></div>
            <div><p className="text-lg font-bold text-emerald-600">UGX {results.totalIncome.toLocaleString()}</p><p className="text-xs text-muted-foreground">Income added</p></div>
            <div><p className="text-lg font-bold text-destructive">UGX {results.totalExpense.toLocaleString()}</p><p className="text-xs text-muted-foreground">Expenses added</p></div>
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => { setStep("upload"); setParsed([]); setRawRows([]); }}>Import Another File</Button>
            <Button onClick={() => window.location.href = "/accounts"}>View Accounts →</Button>
          </div>
        </Card>
      )}
    </div>
  );
}