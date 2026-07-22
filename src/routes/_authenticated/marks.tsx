import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Trophy, Search, Save, Loader2, GraduationCap, Download, ArrowRightCircle, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/marks")({
  head: () => ({ meta: [{ title: "Marks Entry — Sandstone School" }] }),
  component: MarksPage,
});

// ── Course definitions (Synced with Admissions & Students) ────────────────────────
const COURSES: Record<string, { label: string; levels: string[] }> = {
  english: { label: "English", levels: ["Zero Level", "Pre Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"] },
  computer: { label: "Computer", levels: ["Beginner", "Intermediate", "Advanced"] },
  computer_english: { label: "Computer & English", levels: ["Zero Level", "Pre Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"] },
  french: { label: "French", levels: ["Beginner", "Intermediate", "Advanced"] },
  kiswahili: { label: "Kiswahili", levels: ["Beginner", "Intermediate", "Advanced"] },
  german: { label: "German", levels: ["Beginner", "Intermediate", "Advanced"] },
  private_class: { label: "Private Class", levels: ["Private"] },
  private_class_2: { label: "Private Class 2", levels: ["Private"] },
};

// ✅ NEW: Academic year structure — 6 terms per year (6 × 8 weeks = 48 weeks)
const TERMS_PER_YEAR = 6;
const WEEKS_PER_TERM = 8;

type Student = { id: string; name: string; reg_no: string; course: string; level: string; };
type MarkRecord = {
  id?: string;
  student_id: string;
  term?: number;
  year?: number;
  week_1: number | null; week_2: number | null; week_3: number | null; week_4: number | null;
  week_5: number | null; week_6: number | null; week_7: number | null; week_8: number | null;
  remarks: string;
};

function MarksPage() {
  const [selectedCourse, setSelectedCourse] = useState<string>("english");
  const [selectedLevel, setSelectedLevel] = useState<string>(COURSES.english.levels[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marksMap, setMarksMap] = useState<Record<string, MarkRecord>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // ✅ NEW: Editable Term & Year Filters (defaults to current year/term)
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedTerm, setSelectedTerm] = useState<number>(1);

  // ✅ NEW: Generate year range (current year ± 2 years for easy navigation)
  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear - 2; y <= currentYear + 2; y++) {
      years.push(y);
    }
    return years;
  }, []);

  // ✅ NEW: Generate term options (Term 1 through Term 6)
  const availableTerms = useMemo(() => {
    return Array.from({ length: TERMS_PER_YEAR }, (_, i) => i + 1);
  }, []);

  // ── Fetch Data (Scoped to Selected Term & Year) ───────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    
    const { data: studs } = await supabase
      .from("students")
      .select("id, name, reg_no, course, level")
      .eq("course", selectedCourse)
      .eq("level", selectedLevel)
      .neq("status", "graduated")
      .order("name");
    setStudents((studs || []) as Student[]);

    if (studs && studs.length > 0) {
      const studentIds = studs.map(s => s.id);
      const { data: marksData, error } = await supabase
        .from("marks")
        .select("*")
        .in("student_id", studentIds)
        .eq("term", selectedTerm)
        .eq("year", selectedYear);
      
      if (error) {
        console.error(error);
        toast.error("Failed to load marks. Ensure 'term' and 'year' columns exist in Supabase.");
      }

      const map: Record<string, MarkRecord> = {};
      (marksData || []).forEach(m => { map[m.student_id] = m as MarkRecord; });
      setMarksMap(map);
    } else {
      setMarksMap({});
    }
    setLoading(false);
  }, [selectedCourse, selectedLevel, selectedTerm, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCourseChange = (course: string) => {
    setSelectedCourse(course);
    setSelectedLevel(COURSES[course].levels[0]);
  };

  const updateMark = (studentId: string, week: number, value: string) => {
    const numVal = value === "" ? null : Math.min(100, Math.max(0, Number(value)));
    setMarksMap(prev => {
      const current = prev[studentId] || { student_id: studentId, remarks: "" };
      return { ...prev, [studentId]: { ...current, [`week_${week}` as keyof MarkRecord]: numVal } };
    });
  };

  const updateRemarks = (studentId: string, value: string) => {
    setMarksMap(prev => {
      const current = prev[studentId] || { student_id: studentId };
      return { ...prev, [studentId]: { ...current, remarks: value } };
    });
  };

  // ── Save to Supabase (Includes Selected Term & Year) ──────────────────
  const saveMarks = async (studentId: string) => {
    setSavingId(studentId);
    const record = marksMap[studentId];
    if (!record) return;

    const payload = {
      student_id: studentId,
      term: selectedTerm,
      year: selectedYear,
      week_1: record.week_1 || 0, week_2: record.week_2 || 0, week_3: record.week_3 || 0, week_4: record.week_4 || 0,
      week_5: record.week_5 || 0, week_6: record.week_6 || 0, week_7: record.week_7 || 0, week_8: record.week_8 || 0,
      remarks: record.remarks || "",
    };

    const { error } = record.id 
      ? await supabase.from("marks").update(payload).eq("id", record.id)
      : await supabase.from("marks").insert(payload);

    if (error) {
      toast.error("Failed to save marks: " + error.message);
    } else {
      toast.success("Marks saved successfully");
      fetchData(); 
    }
    setSavingId(null);
  };

  // ✅ UPDATED: Advance to Next Term (now works with selected filters)
  const handleAdvanceTerm = () => {
    if (!confirm(`Advance from Term ${selectedTerm}, ${selectedYear} to the next term? All records for the current term are safely preserved in the system.`)) return;
    
    if (selectedTerm >= TERMS_PER_YEAR) {
      // Roll over to Term 1 of next year
      setSelectedTerm(1);
      setSelectedYear(prev => prev + 1);
      toast.success(`Academic Year Complete! Advanced to Term 1, ${selectedYear + 1}`);
    } else {
      setSelectedTerm(prev => prev + 1);
      toast.success(`Advanced to Term ${selectedTerm + 1}, ${selectedYear}`);
    }
  };

  // ✅ UPDATED: Export Backup (uses selected term/year in filename)
  const exportTermBackup = () => {
    if (students.length === 0) return toast.error("No students in this class to export");
    
    const data = students.map(s => {
      const m = marksMap[s.id];
      return {
        "Reg No": s.reg_no,
        "Student Name": s.name,
        "Course": COURSES[selectedCourse].label,
        "Level": selectedLevel,
        "Academic Year": selectedYear,
        "Term": selectedTerm,
        "Week 1": m?.week_1 ?? "",
        "Week 2": m?.week_2 ?? "",
        "Week 3": m?.week_3 ?? "",
        "Week 4": m?.week_4 ?? "",
        "Week 5": m?.week_5 ?? "",
        "Week 6": m?.week_6 ?? "",
        "Week 7": m?.week_7 ?? "",
        "Week 8": m?.week_8 ?? "",
        "Average": getAvg(m) ?? "",
        "Grade": getGrade(getAvg(m)),
        "Remarks": m?.remarks ?? ""
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Term ${selectedTerm}`);
    
    const courseName = COURSES[selectedCourse].label.replace(/\s+/g, '_');
    const levelName = selectedLevel.replace(/\s+/g, '_');
    XLSX.writeFile(wb, `Marks_${courseName}_${levelName}_Term${selectedTerm}_${selectedYear}.xlsx`);
    
    toast.success(`Term ${selectedTerm}, ${selectedYear} records backed up to Excel!`);
  };

  // ── Calculations ─────────────────────────────────────────────────────
  const getAvg = (m: MarkRecord | undefined) => {
    if (!m) return null;
    const weeks = [m.week_1, m.week_2, m.week_3, m.week_4, m.week_5, m.week_6, m.week_7, m.week_8].filter((w): w is number => w !== null && w !== 0);
    if (!weeks.length) return null;
    return Math.round((weeks.reduce((a, b) => a + b, 0) / weeks.length) * 10) / 10;
  };

  const getGrade = (avg: number | null) => {
    if (avg === null) return "—";
    if (avg >= 80) return "A";
    if (avg >= 70) return "B";
    if (avg >= 60) return "C";
    if (avg >= 50) return "D";
    return "F";
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [students, searchQuery]);

  const topStudent = useMemo(() => {
    let best: { name: string; avg: number } | null = null;
    students.forEach(s => {
      const avg = getAvg(marksMap[s.id]);
      if (avg !== null && (!best || avg > best.avg)) {
        best = { name: s.name, avg };
      }
    });
    return best;
  }, [students, marksMap]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Marks Entry</h1>
        <p className="text-muted-foreground mt-1">8-week assessment — select a class and academic period to begin filling marks</p>
      </header>

      {topStudent && (
        <div className="rounded-2xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-6 flex items-center gap-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="h-14 w-14 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <Trophy className="h-7 w-7 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold tracking-widest text-amber-700 dark:text-amber-400">TOP STUDENT ({COURSES[selectedCourse].label} - {selectedLevel})</p>
            <p className="text-xl font-bold mt-1">{topStudent.name}</p>
            <p className="text-sm text-muted-foreground">Average: {topStudent.avg}% · Grade {getGrade(topStudent.avg)}</p>
          </div>
        </div>
      )}

      {/* ✅ NEW: Class, Academic Period & Search Filters */}
      <div className="rounded-2xl border bg-card p-4 flex flex-wrap items-center gap-4">
        {/* Course & Level */}
        <div className="flex gap-3 flex-1 min-w-[300px]">
          <Select value={selectedCourse} onValueChange={handleCourseChange}>
            <SelectTrigger className="w-[200px]"> <SelectValue /> </SelectTrigger>
            <SelectContent>
              {Object.entries(COURSES).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedLevel} onValueChange={setSelectedLevel}>
            <SelectTrigger className="w-[200px]"> <SelectValue /> </SelectTrigger>
            <SelectContent>
              {COURSES[selectedCourse].levels.map(l => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ✅ NEW: Academic Period Filters (Year & Term) */}
        <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-lg border">
          <Calendar className="h-4 w-4 text-primary" />
          <div className="flex items-center gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Year</p>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-[100px] h-8 text-sm"> <SelectValue /> </SelectTrigger>
                <SelectContent>
                  {availableYears.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Term</p>
              <Select value={String(selectedTerm)} onValueChange={(v) => setSelectedTerm(Number(v))}>
                <SelectTrigger className="w-[110px] h-8 text-sm"> <SelectValue /> </SelectTrigger>
                <SelectContent>
                  {availableTerms.map(t => (
                    <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button 
            size="sm" 
            onClick={handleAdvanceTerm} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 ml-2"
          >
            <ArrowRightCircle className="h-4 w-4" /> Advance Term
          </Button>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search student..." 
            className="pl-9" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        {/* Count & Export */}
        <div className="flex items-center gap-2 ml-auto">
          <Badge variant="outline">
            {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}
          </Badge>
          <Button variant="outline" onClick={exportTermBackup} className="gap-1.5">
            <Download className="h-4 w-4" /> Backup Term
          </Button>
        </div>
      </div>

      {/* ✅ NEW: Info Banner about Selected Period */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-center gap-3">
        <Calendar className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-primary">
            Viewing: Term {selectedTerm}, {selectedYear} · {COURSES[selectedCourse].label} - {selectedLevel}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Each term contains {WEEKS_PER_TERM} weeks of assessment. Records are preserved per term/year for future reference and export.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border bg-card overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading class roster...
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <GraduationCap className="h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">No students found in this class</p>
            <p className="text-sm">Add students in Admissions and assign them to {COURSES[selectedCourse].label} - {selectedLevel}.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left font-medium px-4 py-3 sticky left-0 bg-muted/50 z-10">Student</th>
                {Array.from({ length: WEEKS_PER_TERM }).map((_, i) => (
                  <th key={i} className="px-2 py-3 text-center font-medium w-16">W{i + 1}</th>
                ))}
                <th className="px-3 py-3 text-center font-medium w-16">Avg</th>
                <th className="px-3 py-3 text-center font-medium w-16">Grade</th>
                <th className="px-3 py-3 text-left font-medium min-w-[200px]">Remarks</th>
                <th className="px-3 py-3 text-right font-medium w-24">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => {
                const m = marksMap[s.id];
                const a = getAvg(m);
                const isSaving = savingId === s.id;
                const hasChanges = m && (m.week_1 !== null || m.week_2 !== null || m.remarks !== "");

                return (
                  <tr key={s.id} className="border-t transition-all duration-200 hover:bg-accent/50">
                    <td className="px-4 py-3 font-medium sticky left-0 bg-card z-10 border-r">
                      <div>{s.name}</div>
                      <div className="text-xs text-muted-foreground font-normal">{s.reg_no}</div>
                    </td>
                    {Array.from({ length: WEEKS_PER_TERM }).map((_, i) => {
                      const w = i + 1;
                      return (
                        <td key={w} className="px-1.5 py-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={m?.[`week_${w}` as keyof MarkRecord] ?? ""}
                            onChange={e => updateMark(s.id, w, e.target.value)}
                            placeholder="—"
                            className="w-full h-9 text-center rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                          />
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center font-semibold">{a ?? "—"}</td>
                    <td className="px-3 py-3 text-center font-bold">{getGrade(a)}</td>
                    <td className="px-3 py-3">
                      <input
                        type="text"
                        value={m?.remarks ?? ""}
                        onChange={e => updateRemarks(s.id, e.target.value)}
                        placeholder="e.g. Excellent progress"
                        className="w-full h-9 px-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                      />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button 
                        size="sm" 
                        onClick={() => saveMarks(s.id)} 
                        disabled={isSaving || !hasChanges}
                        className="gap-1"
                      >
                        {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        Save
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}