import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useCallback } from "react";
import { Trophy, Search, Save, Loader2, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/marks")({
  head: () => ({ meta: [{ title: "Marks Entry — Sandstone School" }] }),
  component: MarksPage,
});

// ── Course definitions ─────────────────────────────────────────────────────
const COURSES: Record<string, { label: string; levels: string[] }> = {
  english: { label: "English", levels: ["Zero Level", "Pre Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"] },
  computer: { label: "Computer", levels: ["Beginner", "Intermediate", "Advanced"] },
  computer_english: { label: "Computer & English", levels: ["Zero Level", "Pre Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"] },
  french: { label: "French", levels: ["Beginner", "Intermediate", "Advanced"] },
  kiswahili: { label: "Kiswahili", levels: ["Beginner", "Intermediate", "Advanced"] },
  private_class: { label: "Private Class", levels: ["Private"] },
};

type Student = { id: string; name: string; reg_no: string; course: string; level: string; };
type MarkRecord = {
  id?: string;
  student_id: string;
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

  // ── Fetch Data ────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    
    // 1. Fetch students for this specific course and level
    const { data: studs } = await supabase
      .from("students")
      .select("id, name, reg_no, course, level")
      .eq("course", selectedCourse)
      .eq("level", selectedLevel)
      .neq("status", "graduated")
      .order("name");
    setStudents((studs || []) as Student[]);

    // 2. Fetch existing marks for these students
    if (studs && studs.length > 0) {
      const studentIds = studs.map(s => s.id);
      const { data: marksData } = await supabase
        .from("marks")
        .select("*")
        .in("student_id", studentIds);
      
      const map: Record<string, MarkRecord> = {};
      (marksData || []).forEach(m => { map[m.student_id] = m as MarkRecord; });
      setMarksMap(map);
    } else {
      setMarksMap({});
    }
    setLoading(false);
  }, [selectedCourse, selectedLevel]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Handle Level Change ───────────────────────────────────────────────────
  const handleCourseChange = (course: string) => {
    setSelectedCourse(course);
    setSelectedLevel(COURSES[course].levels[0]);
  };

  // ── Update Local State ────────────────────────────────────────────────────
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

  // ── Save to Supabase ──────────────────────────────────────────────────────
  const saveMarks = async (studentId: string) => {
    setSavingId(studentId);
    const record = marksMap[studentId];
    if (!record) return;

    const payload = {
      student_id: studentId,
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
      fetchData(); // Refresh to get the new ID
    }
    setSavingId(null);
  };

  // ── Calculations ──────────────────────────────────────────────────────────
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

  // ─ Filtered Students ─────────────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    return students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [students, searchQuery]);

  // ── Top Student Logic ─────────────────────────────────────────────────────
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
        <p className="text-muted-foreground mt-1">8-week assessment — select a class to begin filling marks</p>
      </header>

      {/* Top student */}
      {topStudent && (
        <div className="rounded-2xl border bg-warning/10 border-warning/30 p-6 flex items-center gap-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <div className="h-14 w-14 rounded-xl bg-warning/20 flex items-center justify-center">
            <Trophy className="h-7 w-7 text-warning-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold tracking-widest text-warning-foreground/80">TOP STUDENT ({COURSES[selectedCourse].label} - {selectedLevel})</p>
            <p className="text-xl font-bold mt-1">{topStudent.name}</p>
            <p className="text-sm text-muted-foreground">Average: {topStudent.avg}% · Grade {getGrade(topStudent.avg)}</p>
          </div>
        </div>
      )}

      {/* Navigation & Filters */}
      <div className="rounded-2xl border bg-card p-4 flex flex-wrap items-center gap-4">
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

        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search student..." 
            className="pl-9" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        
        <Badge variant="outline" className="ml-auto">
          {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}
        </Badge>
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
                {Array.from({ length: 8 }).map((_, i) => (
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
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(w => (
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
                    ))}
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