import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, useRef } from "react";
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2,
  Loader2, Download, X, ChevronRight, Info,
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

export const Route = createFileRoute("/_authenticated/import-students")({
  head: () => ({ meta: [{ title: "Import Students — Sandstone School" }] }),
  component: ImportStudentsPage,
});

const VALID_COURSES = ["english", "computer", "computer_english", "french", "kiswahili", "private_class"];
const VALID_STATUSES = ["active", "promoted", "graduated"];
const COURSE_ALIASES: Record<string, string> = {
  "english": "english", "eng": "english",
  "computer": "computer", "comp": "computer", "ict": "computer",
  "computer & english": "computer_english", "computer and english": "computer_english",
  "computer_english": "computer_english", "comp & eng": "computer_english",
  "french": "french", "fre": "french",
  "kiswahili": "kiswahili", "swahili": "kiswahili", "kisw": "kiswahili",
  "private class": "private_class", "private": "private_class", "private_class": "private_class",
};

const REQUIRED_FIELDS = ["name", "reg_no", "course"] as const;
const OPTIONAL_FIELDS = ["level", "status", "balance"] as const;
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS] as const;
type FieldKey = typeof ALL_FIELDS[number];

const FIELD_LABELS: Record<FieldKey, string> = {
  name: "Full Name",
  reg_no: "Registration No.",
  course: "Course",
  level: "Level",
  status: "Status",
  balance: "Balance (UGX)",
};

type ParsedRow = {
  _row: number; name: string; reg_no: string; course: string;
  level: string; status: string; balance: number;
  _errors: string[]; _valid: boolean;
};

function ImportStudentsPage() {
  const [step, setStep] = useState<"upload" | "map" | "preview" | "done">("upload");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  // FIX: Changed initial empty strings to "__none__"
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({
    name: "__none__", reg_no: "__none__", course: "__none__", level: "__none__", status: "__none__", balance: "__none__",
  });
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ inserted: number; skipped: number; errors: string[] }>({
    inserted: 0, skipped: 0, errors: [],
  });
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("Please upload an Excel file (.xlsx, .xls) or CSV");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
        if (json.length === 0) { toast.error("The file appears to be empty"); return; }
        
        const headers = Object.keys(json[0]);
        setRawHeaders(headers);
        setRawRows(json);
        
        // FIX: Changed initial empty strings to "__none__"
        const autoMap: Record<FieldKey, string> = { name: "__none__", reg_no: "__none__", course: "__none__", level: "__none__", status: "__none__", balance: "__none__" };
        headers.forEach(h => {
          const lower = h.toLowerCase().trim();
          if (["name", "full name", "student name", "fullname"].includes(lower)) autoMap.name = h;
          else if (["reg no", "reg_no", "registration", "registration no", "reg", "regno"].includes(lower)) autoMap.reg_no = h;
          else if (["course", "program", "programme", "subject"].includes(lower)) autoMap.course = h;
          else if (["level", "class", "stage"].includes(lower)) autoMap.level = h;
          else if (["status", "state"].includes(lower)) autoMap.status = h;
          else if (["balance", "amount", "fee", "outstanding", "bal"].includes(lower)) autoMap.balance = h;
        });
        setMapping(autoMap);
        toast.success(`Loaded ${json.length} rows from ${wb.SheetNames[0]}`);
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
      const get = (field: FieldKey) => {
        const col = mapping[field];
        return (col && col !== "__none__") ? String(row[col] ?? "").trim() : "";
      };
      
      const errors: string[] = [];
      const name = get("name");
      const reg_no = get("reg_no");
      const rawCourse = get("course").toLowerCase();
      const course = COURSE_ALIASES[rawCourse] || rawCourse;
      const level = get("level") || "Level 1";
      const rawStatus = get("status").toLowerCase();
      const status = VALID_STATUSES.includes(rawStatus) ? rawStatus : "active";
      const balance = Number(get("balance").replace(/[^0-9.]/g, "")) || 0;

      if (!name) errors.push("Name is missing");
      if (!reg_no) errors.push("Reg No is missing");
      if (!VALID_COURSES.includes(course)) errors.push(`Unknown course: "${get("course")}"`);

      return {
        _row: i + 2, name, reg_no, course, level, status, balance,
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
    const BATCH = 50;
    let inserted = 0, skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < valid.length; i += BATCH) {
      const batch = valid.slice(i, i + BATCH).map(r => ({
        name: r.name, reg_no: r.reg_no, course: r.course,
        level: r.level, status: r.status, balance: r.balance,
      }));

      const { data, error } = await supabase
        .from("students")
        .upsert(batch, { onConflict: "reg_no", ignoreDuplicates: false })
        .select();

      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
        skipped += batch.length;
      } else {
        inserted += data?.length ?? batch.length;
      }
    }

    setResults({ inserted, skipped, errors });
    setImporting(false);
    setStep("done");
    toast.success(`Import complete — ${inserted} students added/updated`);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Full Name", "Reg No", "Course", "Level", "Status", "Balance"],
      ["Aisha Nakato", "SSL-0001", "english", "Level 2", "active", "50000"],
      ["Brian Okello", "SSL-0002", "computer", "Intermediate", "active", "0"],
      ["Diana Achieng", "SSL-0003", "french", "Beginner", "promoted", "20000"],
    ]);
    ws["!cols"] = [{ wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "sandstone_students_template.xlsx");
    toast.success("Template downloaded");
  };

  const validCount = parsed.filter(r => r._valid).length;
  const invalidCount = parsed.filter(r => !r._valid).length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Import Students</h1>
        <p className="text-muted-foreground mt-1">Upload your existing Excel student records — the system maps, validates, and imports them automatically.</p>
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
            className={`border-2 border-dashed p-12 text-center transition-colors cursor-pointer
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
                        <th className="px-3 py-2 text-left border-r">Full Name *</th>
                        <th className="px-3 py-2 text-left border-r">Reg No *</th>
                        <th className="px-3 py-2 text-left border-r">Course *</th>
                        <th className="px-3 py-2 text-left border-r">Level</th>
                        <th className="px-3 py-2 text-left border-r">Status</th>
                        <th className="px-3 py-2 text-left">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="px-3 py-2 border-r text-muted-foreground">Aisha Nakato</td>
                        <td className="px-3 py-2 border-r text-muted-foreground">SSL-0001</td>
                        <td className="px-3 py-2 border-r text-muted-foreground">english</td>
                        <td className="px-3 py-2 border-r text-muted-foreground">Level 2</td>
                        <td className="px-3 py-2 border-r text-muted-foreground">active</td>
                        <td className="px-3 py-2 text-muted-foreground">50000</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  * Required columns. The system will automatically detect these columns regardless of their order in your file. Valid courses: english, computer, computer_english, french, kiswahili, private_class.
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
                <p className="text-sm text-muted-foreground">{rawRows.length} rows detected. Match your spreadsheet columns to the required fields.</p>
              </div>
              <Badge variant="outline">{rawHeaders.length} columns found</Badge>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {ALL_FIELDS.map(field => (
                <div key={field} className="grid gap-1.5">
                  <Label className="text-xs flex items-center gap-2">
                    {FIELD_LABELS[field]}
                    {REQUIRED_FIELDS.includes(field as any) && <span className="text-destructive">*</span>}
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
            <Button onClick={runParse} disabled={mapping.name === "__none__" || mapping.reg_no === "__none__" || mapping.course === "__none__"}>
              Validate Data →
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Card className="p-4 flex items-center gap-3 flex-1 min-w-[140px]">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <div><p className="text-2xl font-bold text-emerald-600">{validCount}</p><p className="text-xs text-muted-foreground">Ready to import</p></div>
            </Card>
            <Card className="p-4 flex items-center gap-3 flex-1 min-w-[140px]">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div><p className="text-2xl font-bold text-destructive">{invalidCount}</p><p className="text-xs text-muted-foreground">Rows with errors</p></div>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead><TableHead>Name</TableHead><TableHead>Reg No</TableHead><TableHead>Course</TableHead><TableHead>Level</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Validation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsed.map(row => (
                  <TableRow key={row._row} className={!row._valid ? "bg-destructive/5" : ""}>
                    <TableCell className="text-muted-foreground text-xs">{row._row}</TableCell>
                    <TableCell className="font-medium">{row.name || <span className="text-destructive">—</span>}</TableCell>
                    <TableCell className="font-mono text-xs">{row.reg_no || <span className="text-destructive">—</span>}</TableCell>
                    <TableCell>{row.course}</TableCell>
                    <TableCell>{row.level}</TableCell>
                    <TableCell className="capitalize">{row.status}</TableCell>
                    <TableCell className="text-right">{row.balance > 0 ? `UGX ${row.balance.toLocaleString()}` : "—"}</TableCell>
                    <TableCell>
                      {row._valid ? <Badge className="bg-emerald-600 text-white text-xs">Valid</Badge> : (
                        <div className="space-y-0.5">
                          {row._errors.map((e, i) => <p key={i} className="text-xs text-destructive flex items-center gap-1"><X className="h-3 w-3" />{e}</p>)}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("map")}>← Back</Button>
            <Button onClick={runImport} disabled={importing || validCount === 0}>
              {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importing...</> : <><Upload className="h-4 w-4 mr-2" /> Import {validCount} Students</>}
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <Card className="p-8 text-center space-y-4">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto" />
          <div><h2 className="text-2xl font-bold">Import Complete</h2><p className="text-muted-foreground mt-1">Your student records have been imported into the system.</p></div>
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
            <div className="text-center"><p className="text-3xl font-bold text-emerald-600">{results.inserted}</p><p className="text-xs text-muted-foreground">Imported</p></div>
            <div className="text-center"><p className="text-3xl font-bold text-amber-600">{results.skipped}</p><p className="text-xs text-muted-foreground">Skipped</p></div>
            <div className="text-center"><p className="text-3xl font-bold text-destructive">{results.errors.length}</p><p className="text-xs text-muted-foreground">Batch errors</p></div>
          </div>
          {results.errors.length > 0 && (
            <div className="text-left bg-destructive/5 rounded-lg p-4 text-sm space-y-1">
              {results.errors.map((e, i) => <p key={i} className="text-destructive text-xs">{e}</p>)}
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => { setStep("upload"); setParsed([]); setRawRows([]); }}>Import Another File</Button>
            <Button onClick={() => window.location.href = "/students"}>View Students →</Button>
          </div>
        </Card>
      )}
    </div>
  );
}