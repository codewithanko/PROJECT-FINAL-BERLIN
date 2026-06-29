import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { 
  ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays, 
  Loader2, Globe, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "School Calendar — Sandstone School" }] }),
  component: CalendarPage,
});

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  is_holiday: boolean;
  color: string;
  start_time?: string;
  end_time?: string;
  category?: string;
};

// FIX: Helper function to format dates locally to avoid UTC timezone bugs
const formatDate = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  
  // Form States
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isHoliday, setIsHoliday] = useState(false);
  const [category, setCategory] = useState("school");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    const { data } = await supabase.from("events").select("*").order("event_date", { ascending: true });
    setEvents(data || []);
    setLoading(false);
  };

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    while (days.length < 42) days.push(null);
    
    return days;
  }, [year, month]);

  const getEventsForDay = (day: number | null) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.event_date === dateStr);
  };

  // FIX: Use local formatDate instead of toISOString()
  const getEventsForSelectedDate = () => {
    const dateStr = formatDate(selectedDate);
    return events.filter(e => e.event_date === dateStr).sort((a, b) => {
      if (a.start_time && b.start_time) return a.start_time.localeCompare(b.start_time);
      return 0;
    });
  };

  const isToday = (day: number | null) => {
    if (!day) return false;
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const isSelected = (day: number | null) => {
    if (!day) return false;
    return day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
  };

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handlePrevYear = () => setCurrentDate(new Date(year - 1, month, 1));
  const handleNextYear = () => setCurrentDate(new Date(year + 1, month, 1));

  const handleMonthChange = (monthIndex: string) => {
    setCurrentDate(new Date(year, parseInt(monthIndex), 1));
  };

  const handleYearChange = (yearStr: string) => {
    setCurrentDate(new Date(parseInt(yearStr), month, 1));
  };

  const handleDateClick = (day: number) => {
    setSelectedDate(new Date(year, month, day));
  };

  const openAddDialog = () => {
    setSelectedEvent(null);
    setTitle("");
    setDescription("");
    setIsHoliday(false);
    setCategory("school");
    setStartTime("");
    setEndTime("");
    setDialogOpen(true);
  };

  const openEditDialog = (event: EventItem) => {
    setSelectedEvent(event);
    setTitle(event.title);
    setDescription(event.description || "");
    setIsHoliday(event.is_holiday);
    setCategory(event.category || "school");
    setStartTime(event.start_time || "");
    setEndTime(event.end_time || "");
    setDialogOpen(true);
  };

  const saveEvent = async () => {
    if (!title.trim()) return toast.error("Event title is required");
    
    // FIX: Use local formatDate
    const dateStr = formatDate(selectedDate);
    
    if (selectedEvent) {
      const { error } = await supabase.from("events").update({
        title: title.trim(),
        description: description.trim(),
        event_date: dateStr,
        is_holiday: isHoliday,
        color: isHoliday ? "#ef4444" : getCategoryColor(category),
        start_time: startTime || null,
        end_time: endTime || null,
        category: category,
      }).eq("id", selectedEvent.id);

      if (error) return toast.error("Failed to update event");
      toast.success("Event updated successfully");
    } else {
      const { error } = await supabase.from("events").insert({
        title: title.trim(),
        description: description.trim(),
        event_date: dateStr,
        is_holiday: isHoliday,
        color: isHoliday ? "#ef4444" : getCategoryColor(category),
        start_time: startTime || null,
        end_time: endTime || null,
        category: category,
      });

      if (error) return toast.error("Failed to create event");
      toast.success("Event created successfully");
    }
    
    setDialogOpen(false);
    fetchEvents();
  };

  const deleteEvent = async (id: string) => {
    if (!confirm("Delete this event?")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) return toast.error("Failed to delete");
    toast.success("Event deleted");
    fetchEvents();
  };

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      school: "#3b82f6", exam: "#f59e0b", meeting: "#8b5cf6",
      holiday: "#ef4444", sports: "#10b981", other: "#6b7280",
    };
    return colors[cat] || "#3b82f6";
  };

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      school: "School Event", exam: "Examination", meeting: "Meeting",
      holiday: "Holiday", sports: "Sports", other: "Other",
    };
    return labels[cat] || cat;
  };

  const yearOptions = [];
  for (let y = 2024; y <= 2030; y++) yearOptions.push(y);

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Main Calendar Section */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevYear}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" size="icon" onClick={handleNextYear}><ChevronRight className="h-4 w-4" /></Button>
            </div>
            <div className="flex items-center gap-2">
              <Select value={String(month)} onValueChange={handleMonthChange}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthNames.map((m, i) => (<SelectItem key={i} value={String(i)}>{m}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={String(year)} onValueChange={handleYearChange}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setCurrentDate(new Date()); setSelectedDate(new Date()); }}>Today</Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth}><ChevronRight className="h-4 w-4" /></Button>
            <Button onClick={openAddDialog} className="gap-2"><Plus className="h-4 w-4" /> Add Event</Button>
          </div>
        </div>

        {/* Calendar Grid */}
        <Card className="flex-1 p-6">
          <div className="grid grid-cols-7 gap-2 mb-4">
            {dayNames.map(day => (
              <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">{day}</div>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-7 gap-2 h-[calc(100%-3rem)]">
              {calendarDays.map((day, idx) => {
                const dayEvents = getEventsForDay(day);
                const hasEvents = dayEvents.length > 0;
                const isTodayDate = isToday(day);
                const isSelectedDate = isSelected(day);
                
                let cellClasses = "min-h-[100px] p-2 rounded-lg border transition-all relative group cursor-pointer ";
                if (!day) {
                  cellClasses += "bg-muted/20 border-transparent cursor-default";
                } else if (isSelectedDate) {
                  cellClasses += "border-2 border-primary bg-primary/10 shadow-md dark:bg-primary/20 dark:border-primary";
                } else if (hasEvents) {
                  cellClasses += "bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:border-blue-800/60 dark:hover:bg-blue-950/50";
                } else {
                  cellClasses += "border-border/50 hover:bg-accent/50";
                }

                if (isTodayDate && !isSelectedDate) {
                  cellClasses += " ring-2 ring-primary/50 dark:ring-primary/70";
                }

                return (
                  <div key={idx} onClick={() => day && handleDateClick(day)} className={cellClasses}>
                    {day && (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-bold ${
                            isSelectedDate ? "text-primary" : 
                            isTodayDate ? "text-primary" : 
                            hasEvents ? "text-blue-700 dark:text-blue-300" : "text-foreground"
                          }`}>
                            {day}
                          </span>
                          {hasEvents && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                              {dayEvents.length}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="space-y-1 overflow-y-auto max-h-[70px]">
                          {dayEvents.slice(0, 3).map(ev => (
                            <div key={ev.id} className="text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-1" style={{ backgroundColor: `${ev.color}20`, color: ev.color }}>
                              {ev.is_holiday && <Globe className="h-2.5 w-2.5 shrink-0" />}
                              <span className="truncate font-medium">{ev.title}</span>
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} more</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Right Sidebar - Scheduled Events */}
      <div className="w-96 flex flex-col gap-4">
        <Card className="p-6 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" /> Events Scheduled
              </h3>
              <p className="text-sm text-muted-foreground font-medium mt-0.5">
                {selectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <Button variant="outline" size="icon" onClick={openAddDialog} title="Add Event">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : getEventsForSelectedDate().length === 0 ? (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center justify-center h-full">
                <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium">No events scheduled</p>
                <p className="text-xs mt-1">Click "Add Event" to create one.</p>
              </div>
            ) : (
              getEventsForSelectedDate().map((event) => (
                <div 
                  key={event.id} 
                  className="p-4 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors cursor-pointer group relative"
                  onClick={() => openEditDialog(event)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
                      <h4 className="font-semibold text-sm">{event.title}</h4>
                    </div>
                    <Button 
                      variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 absolute top-2 right-2"
                      onClick={(e) => { e.stopPropagation(); deleteEvent(event.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {event.description && (
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2 pl-5">{event.description}</p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-2 pl-5">
                    {event.start_time && (
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1">
                        <Clock className="h-2.5 w-2.5" /> {event.start_time} {event.end_time && `- ${event.end_time}`}
                      </Badge>
                    )}
                    {event.is_holiday && (
                      <Badge variant="destructive" className="text-[10px] h-5 px-1.5 gap-1">
                        <Globe className="h-2.5 w-2.5" /> Holiday
                      </Badge>
                    )}
                    {event.category && event.category !== 'holiday' && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{getCategoryLabel(event.category)}</Badge>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Quick Stats */}
        <Card className="p-6">
          <h3 className="font-bold text-sm mb-4">This Month</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Events</span>
              <Badge variant="secondary">{events.filter(e => {
                const d = new Date(e.event_date); return d.getMonth() === month && d.getFullYear() === year;
              }).length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Holidays</span>
              <Badge variant="destructive">{events.filter(e => {
                const d = new Date(e.event_date); return e.is_holiday && d.getMonth() === month && d.getFullYear() === year;
              }).length}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">School Events</span>
              <Badge className="bg-blue-500">{events.filter(e => {
                const d = new Date(e.event_date); return e.category === 'school' && d.getMonth() === month && d.getFullYear() === year;
              }).length}</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Event Creation/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" /> 
              {selectedEvent ? "Edit Event" : "Create New Event"}
            </DialogTitle>
            <DialogDescription className="sr-only">Form to create or edit a school calendar event.</DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Event Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Staff Meeting, Sports Day" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Date</Label>
                {/* FIX: Use formatDate for the input value */}
                <Input type="date" value={formatDate(selectedDate)} onChange={e => setSelectedDate(new Date(e.target.value))} />
              </div>
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school">School Event</SelectItem>
                    <SelectItem value="exam">Examination</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="sports">Sports</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Start Time</Label><Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
              <div className="grid gap-2"><Label>End Time</Label><Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Add event details..." />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="holiday" checked={isHoliday} onCheckedChange={(v) => setIsHoliday(Boolean(v))} />
              <Label htmlFor="holiday" className="flex items-center gap-2 cursor-pointer">
                <Globe className="h-4 w-4 text-red-500" /> Mark as Nationwide Public Holiday
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveEvent}>{selectedEvent ? "Update Event" : "Create Event"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}