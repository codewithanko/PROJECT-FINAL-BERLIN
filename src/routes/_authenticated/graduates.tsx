import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { 
  Search, GraduationCap, Award, BookOpen, Download, 
  RotateCcw, Loader2, User 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { COURSES, formatUGX } from "@/lib/courses";

export const Route = createFileRoute("/_authenticated/graduates")({
  head: () => ({ meta: [{ title: "Graduates & Alumni — Sandstone School" }] }),
  component: GraduatesPage,
});

type Graduate = {
  id: string;
  name: string;
  reg_no: string;
  course: string;
  level: string;
  balance: number;
  created_at: string;
};

function GraduatesPage() {
  const navigate = useNavigate();
  const [graduates, setGraduates] = useState<Graduate[]>([]);
  const [loading, setLoading] = useState(true);
  const [reinstatingId, setReinstatingId] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState<string>("all");

  // ─ Fetch Graduates ───────────────────────────────────────────────────────
  const fetchGraduates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("status", "graduated")
      .order("created_at", { ascending: false });
    
    if (error) {
      toast.error("Failed to load graduates: " + error.message);
    } else {
      setGraduates((data ?? []) as Graduate[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchGraduates();
  }, []);

  // ── Derived Data ──────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return graduates.filter(g => {
      const matchQuery = 
        g.name.toLowerCase().includes(query.toLowerCase()) || 
        g.reg_no.toLowerCase().includes(query.toLowerCase());
      const matchCourse = courseFilter === "all" || g.course === courseFilter;
      return matchQuery && matchCourse;
    });
  }, [graduates, query, courseFilter]);

  const stats = useMemo(() => {
    const courses = new Set(graduates.map(g => g.course)).size;
    const zeroBalance = graduates.filter(g => (Number(g.balance) || 0) === 0).length;
    return { total: graduates.length, courses, zeroBalance };
  }, [graduates]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const reinstateStudent = async (id: string) => {
    if (!confirm("Are you sure you want to reinstate this student? They will be moved back to the Active Students list.")) return;
    
    setReinstatingId(id);
    const { error } = await supabase
      .from("students")
      .update({ status: "active" })
      .eq("id", id);
    
    if (error) {
      toast.error("Failed to reinstate: " + error.message);
    } else {
      toast.success("Student successfully reinstated to active status");
      fetchGraduates(); // Refresh list
    }
    setReinstatingId(null);
  };

  const exportCSV = () => {
    if (filtered.length === 0) return toast.error("No graduates to export");
    const headers = ["Reg No", "Name", "Course", "Level Completed", "Graduation Date", "Final Balance"];
    const rows = filtered.map(g => [
      g.reg_no,
      g.name,
      COURSES[g.course]?.label || g.course,
      g.level,
      new Date(g.created_at).toLocaleDateString(),
      formatUGX(Number(g.balance) || 0)
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `sandstone_graduates_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Graduates list exported successfully");
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Graduates & Alumni</h1>
          <p className="text-muted-foreground mt-1">Manage completed students and alumni records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export List
          </Button>
          <Button variant="outline" onClick={() => navigate({ to: "/students" })}>
            <RotateCcw className="h-4 w-4 mr-2" /> Back to Students
          </Button>
        </div>
      </header>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total Graduates</p>
            <p className="text-2xl font-bold mt-1">{stats.total}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <GraduationCap className="h-5 w-5" />
          </div>
        </Card>
        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Courses Represented</p>
            <p className="text-2xl font-bold mt-1">{stats.courses}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center text-info">
            <BookOpen className="h-5 w-5" />
          </div>
        </Card>
        <Card className="p-5 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Cleared Balances</p>
            <p className="text-2xl font-bold mt-1 text-success">{stats.zeroBalance}</p>
          </div>
          <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center text-success">
            <Award className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* ── Main Content ── */}
      <Card className="p-0 overflow-hidden">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search alumni by name or reg no..."
              className="pl-9"
            />
          </div>
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {(Object.keys(COURSES) as string[]).map(k => (
                <SelectItem key={k} value={k}>{COURSES[k].label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto">
            {filtered.length} graduate{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Table / Empty State */}
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading alumni records...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <GraduationCap className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">No graduates found</p>
              <p className="text-sm mt-1 max-w-md">
                {query || courseFilter !== "all" 
                  ? "Try adjusting your search or filter criteria." 
                  : "Students you mark as 'Graduated' in the Students panel will automatically appear here."}
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reg No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Level Completed</TableHead>
                <TableHead>Graduation Date</TableHead>
                <TableHead>Final Balance</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(g => (
                <TableRow key={g.id}>
                  <TableCell className="font-mono text-xs">{g.reg_no}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <User className="h-4 w-4" />
                      </div>
                      <span className="font-medium">{g.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{COURSES[g.course]?.label ?? g.course}</TableCell>
                  <TableCell>{g.level}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(g.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {Number(g.balance) > 0 ? (
                      <Badge variant="destructive">{formatUGX(Number(g.balance))}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-success border-success/50">Cleared</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => reinstateStudent(g.id)}
                      disabled={reinstatingId === g.id}
                      className="text-muted-foreground hover:text-primary"
                      title="Revert to Active Student"
                    >
                      {reinstatingId === g.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4 mr-1" />
                      )}
                      Reinstate
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}