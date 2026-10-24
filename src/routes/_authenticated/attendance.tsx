import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Search, Check, X, Clock, Loader2, Download, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance – Sandstone School" }] }),
  component: AttendancePage,
});

const COURSES: Record<string, { label: string; levels: string[] }> = {
  english: { label: "English", levels: ["Zero Level", "Pre Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"] },
  computer: { label: "Computer", levels: ["Beginner", "Intermediate", "Advanced"] },
  computer_english: { label: "Computer & English", levels: ["Zero Level", "Pre Level", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5"] },
  french: { label: "French", levels: ["Beginner", "Intermediate", "Advanced"] },
  kiswahili: { label: "Kiswahili", levels: ["Beginner", "Intermediate", "Advanced"] },
  private_class: { label: "Private Class", levels: ["Private"] },
};

type Student = {
  id: string;
  name: string;
  reg_no: string;
  course: string;
  level: string;
};
type AttendanceRecord = {
  id: string;
  student_id: string;
  date: string;
  status: "present" | "absent" | "late";
  note?: string;
};

const today = new Date().toISOString().split("T")[0];
const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

function AttendancePage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Export Dialog States
  const [exportOpen, setExportOpen] = useState(false);
  const [exportStart, setExportStart] = useState(lastWeek);
  const [exportEnd, setExportEnd] = useState(today);
  const [isExporting, setIsExporting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    const { data: studs } = await supabase
      .from("students")
      .select("id, name, reg_no, course, level")
      .in("status", ["active", "promoted"])
      .order("name");
    setStudents((studs || []) as Student[]);

    const { data: att } = await supabase
      .from("attendance")
      .select("*")
      .eq("date", selectedDate);
    
    const map: Record<string, AttendanceRecord> = {};
    (att || []).forEach(a => { map[a.student_id] = a as AttendanceRecord; });
    setAttendanceMap(map);
    
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    let present = 0, absent = 0, late = 0, unmarked = 0;
    students.forEach(s => {
      const status = attendanceMap[s.id]?.status || "unmarked";
      if (status === "present") present++;
      else if (status === "absent") absent++;
      else if (status === "late") late++;
      else unmarked++;
    });
    const marked = present + absent + late;
    const rate = marked > 0 ? Math.round((present / marked) * 100) : 0;
    return { present, absent, late, unmarked, total: students.length, rate };
  }, [students, attendanceMap]);

  const filtered = useMemo(() => {
    return students.filter(s => {
      const status = attendanceMap[s.id]?.status || "unmarked";
      const matchQuery = s.name.toLowerCase().includes(query.toLowerCase()) || s.reg_no.toLowerCase().includes(query.toLowerCase());
      const matchCourse = filterCourse === "all" || s.course === filterCourse;
      const matchStatus = filterStatus === "all" || status === filterStatus;
      return matchQuery && matchCourse && matchStatus;
    });
  }, [students, attendanceMap, query, filterCourse, filterStatus]);

  const markStatus = async (studentId: string, status: "present" | "absent" | "late") => {
    setSavingId(studentId);
    const existing = attendanceMap[studentId];
    
    if (existing) {
      const { error, data } = await supabase
        .from("attendance")
        .update({ status })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) {
        toast.error("Failed to update: " + error.message);
      } else {
        toast.success(`Marked as ${status}`);
        setAttendanceMap(prev => ({ ...prev, [studentId]: data as AttendanceRecord }));
      }
    } else {
      const { error, data } = await supabase
        .from("attendance")
        .insert({ student_id: studentId, date: selectedDate, status })
        .select()
        .single();
      if (error) {
        toast.error("Failed to save: " + error.message);
      } else {
        toast.success(`Marked as ${status}`);
        setAttendanceMap(prev => ({ ...prev, [studentId]: data as AttendanceRecord }));
      }
    }
    setSavingId(null);
  };

  // ✅ UPDATED: Crystal Clear Aggregated Export Function
  const handleExport = async () => {
    if (!exportStart || !exportEnd) return toast.error("Please select a valid date range");
    if (exportStart > exportEnd) return toast.error("Start date cannot be after end date");

    setIsExporting(true);
    toast.loading("Generating attendance summary report...");

    const targetStudentIds = filtered.map(s => s.id);
    if (targetStudentIds.length === 0) {
      toast.dismiss();
      setIsExporting(false);
      return toast.error("No students match the current filters to export.");
    }

    // Fetch all attendance records for filtered students in the date range
    const { data: attData, error } = await supabase
      .from("attendance")
      .select("student_id, date, status")
      .in("student_id", targetStudentIds)
      .gte("date", exportStart)
      .lte("date", exportEnd)
      .order("date", { ascending: true });

    if (error) {
      toast.dismiss();
      setIsExporting(false);
      return toast.error("Failed to fetch data: " + error.message);
    }

    // Calculate exact calendar days in the selected range
    const startDate = new Date(exportStart);
    const endDate = new Date(exportEnd);
    const totalDaysInRange = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Aggregate data per student
    const summary = new Map();
    targetStudentIds.forEach(id => {
      summary.set(id, { present: 0, absent: 0, late: 0, daysRecorded: 0 });
    });

    attData?.forEach(record => {
      const stats = summary.get(record.student_id);
      if (stats) {
        stats[record.status]++;
        stats.daysRecorded++;
      }
    });

    // Build CSV with crystal-clear headers
    const headers = [
      "Reg No", 
      "Name", 
      "Course", 
      "Level", 
      "Total Days in Range", 
      "Days Recorded", 
      "Unmarked Days", 
      "Present", 
      "Absent", 
      "Late", 
      "Attendance Rate (%)"
    ];
    
    const rows = filtered.map(s => {
      const stats = summary.get(s.id) || { present: 0, absent: 0, late: 0, daysRecorded: 0 };
      const unmarkedDays = totalDaysInRange - stats.daysRecorded;
      // Rate is based on days the teacher actually recorded, to be fair to students
      const rate = stats.daysRecorded > 0 ? Math.round((stats.present / stats.daysRecorded) * 100) : 0;
      
      return [
        s.reg_no,
        `"${s.name.replace(/"/g, '""')}"`,
        COURSES[s.course]?.label ?? s.course,
        s.level,
        totalDaysInRange,
        stats.daysRecorded,
        unmarkedDays,
        stats.present,
        stats.absent,
        stats.late,
        `${rate}%`
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Attendance_Summary_${exportStart}_to_${exportEnd}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.dismiss();
    toast.success("Attendance report exported successfully!");
    setIsExporting(false);
    setExportOpen(false);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground mt-1">Track daily student attendance and generate summary reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
            <Download className="h-4 w-4 mr-2" /> Export Report
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <Loader2 className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </header>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "Total Students", value: stats.total, color: "text-foreground" },
          { label: "Present", value: stats.present, color: "text-emerald-600" },
          { label: "Absent", value: stats.absent, color: "text-destructive" },
          { label: "Late", value: stats.late, color: "text-amber-600" },
          { label: "Attendance Rate", value: `${stats.rate}%`, color: stats.rate >= 80 ? "text-emerald-600" : "text-destructive" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-card">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or reg no..."
              className="pl-9"
            />
          </div>
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-[180px]"> <SelectValue placeholder="All courses" /> </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {(Object.keys(COURSES) as string[]).map(k => (
                <SelectItem key={k} value={k}>{COURSES[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px]"> <SelectValue placeholder="All statuses" /> </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
              <SelectItem value="late">Late</SelectItem>
              <SelectItem value="unmarked">Unmarked</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto">{filtered.length} students</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reg No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Mark Attendance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading students from database...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  No students found. Add students in the Students panel first.
                </TableCell>
              </TableRow>
            ) : filtered.map(s => {
              const currentStatus = attendanceMap[s.id]?.status || "unmarked";
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.reg_no}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{COURSES[s.course]?.label ?? s.course}</TableCell>
                  <TableCell>{s.level}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{selectedDate}</TableCell>
                  <TableCell>
                    {currentStatus === "unmarked" ? (
                      <Badge variant="outline">Unmarked</Badge>
                    ) : (
                      <Badge 
                        variant={currentStatus === "present" ? "default" : currentStatus === "absent" ? "destructive" : "secondary"} 
                        className="gap-1"
                      >
                        {currentStatus === "present" ? <Check className="h-3 w-3" /> : currentStatus === "absent" ? <X className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {currentStatus}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button 
                        size="sm" variant="ghost" 
                        onClick={() => markStatus(s.id, "present")} 
                        disabled={savingId === s.id || currentStatus === "present"}
                        className={currentStatus === "present" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : ""}
                      >
                        {savingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </Button>
                      <Button 
                        size="sm" variant="ghost" 
                        onClick={() => markStatus(s.id, "late")} 
                        disabled={savingId === s.id || currentStatus === "late"}
                        className={currentStatus === "late" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" : ""}
                      >
                        {savingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                      </Button>
                      <Button 
                        size="sm" variant="ghost" 
                        onClick={() => markStatus(s.id, "absent")} 
                        disabled={savingId === s.id || currentStatus === "absent"}
                        className={currentStatus === "absent" ? "bg-destructive/10 text-destructive" : ""}
                      >
                        {savingId === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Export Attendance Report
            </DialogTitle>
            <DialogDescription>
              Generate a summary CSV report showing attendance breakdown for the selected date range.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="export-start">Start Date</Label>
                <Input 
                  id="export-start" 
                  type="date" 
                  value={exportStart} 
                  onChange={e => setExportStart(e.target.value)} 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="export-end">End Date</Label>
                <Input 
                  id="export-end" 
                  type="date" 
                  value={exportEnd} 
                  onChange={e => setExportEnd(e.target.value)} 
                />
              </div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Report will include <strong>{filtered.length}</strong> students based on your current page filters.</span>
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>Cancel</Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Download className="h-4 w-4 mr-2" /> Download CSV</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}