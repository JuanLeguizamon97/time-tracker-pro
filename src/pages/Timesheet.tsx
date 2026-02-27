import { useState, useMemo } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight, Save, Loader2, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { useAssignedProjectsWithDetails, useAssignedProjects } from '@/hooks/useAssignedProjects';
import { useTimeEntriesByWeek, useCreateTimeEntry, useUpdateTimeEntry, useDeleteTimeEntry } from '@/hooks/useTimeEntries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface ProjectEntry {
  id?: string;
  projectId: string;
  projectName: string;
  clientName: string;
  isInternal: boolean;
  hours: number;
  notes: string;
  billable: boolean;
  dirty?: boolean;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Timesheet() {
  const { employee, isAdmin } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, ProjectEntry[]>>({});
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });

  const { data: allProjects = [], isLoading: projectsLoading } = useActiveProjects();
  const { data: clients = [] } = useClients();
  const { data: assignedProjects = [], isLoading: assignmentsLoading } = useAssignedProjectsWithDetails(employee?.user_id);
  const { data: rawAssignments = [] } = useAssignedProjects(employee?.user_id);
  const { data: weekEntries = [], isLoading: entriesLoading } = useTimeEntriesByWeek(weekStart, employee?.user_id);

  const createTimeEntry = useCreateTimeEntry();
  const updateTimeEntry = useUpdateTimeEntry();
  const deleteTimeEntry = useDeleteTimeEntry();

  const assignmentRoleMap = useMemo(() => {
    const map = new Map<string, string | null>();
    rawAssignments.forEach(a => map.set(a.project_id, a.role_id));
    return map;
  }, [rawAssignments]);

  const availableProjects = useMemo(() => {
    if (isAdmin) {
      return allProjects.map(p => {
        const client = clients.find(c => c.id === p.client_id);
        return { id: p.id, name: p.name, clientName: client?.name || '', isInternal: p.is_internal };
      });
    }
    return assignedProjects.map(ap => {
      const proj = allProjects.find(p => p.id === ap.project_id);
      return { id: ap.project_id, name: ap.project_name, clientName: ap.client_name, isInternal: proj?.is_internal || false };
    });
  }, [isAdmin, allProjects, clients, assignedProjects]);

  const getDayDate = (dayIndex: number) => addDays(weekStart, dayIndex);
  const getDayDateStr = (dayIndex: number) => format(getDayDate(dayIndex), 'yyyy-MM-dd');

  // Build entries for a day: one row per assigned project, pre-filled from existing entries
  const getEntriesForDay = (dayIndex: number): ProjectEntry[] => {
    const dateStr = getDayDateStr(dayIndex);
    if (pendingChanges[dateStr]) return pendingChanges[dateStr];

    return availableProjects.map(proj => {
      const existing = weekEntries.find(e => e.date === dateStr && e.project_id === proj.id);
      return {
        id: existing?.id,
        projectId: proj.id,
        projectName: proj.name,
        clientName: proj.clientName,
        isInternal: proj.isInternal,
        hours: existing ? Number(existing.hours) : 0,
        notes: existing?.notes || '',
        billable: existing ? existing.billable : !proj.isInternal,
      };
    });
  };

  const updateDayEntries = (dayIndex: number, entries: ProjectEntry[]) => {
    const dateStr = getDayDateStr(dayIndex);
    setPendingChanges(prev => ({ ...prev, [dateStr]: entries }));
  };

  const handleUpdateEntry = (dayIndex: number, entryIndex: number, updates: Partial<ProjectEntry>) => {
    const entries = [...getEntriesForDay(dayIndex)];
    const entry = { ...entries[entryIndex], ...updates, dirty: true };
    if (entry.isInternal) entry.billable = false;
    entries[entryIndex] = entry;
    updateDayEntries(dayIndex, entries);
  };

  const handleSave = async () => {
    if (!employee) return;
    setIsSaving(true);
    try {
      const promises: Promise<unknown>[] = [];

      for (const [dateStr, entries] of Object.entries(pendingChanges)) {
        const existingForDate = weekEntries.filter(e => e.date === dateStr);

        for (const entry of entries) {
          if (!entry.dirty) continue;

          const roleId = assignmentRoleMap.get(entry.projectId) || null;

          if (entry.id) {
            // Existing entry
            if (entry.hours <= 0) {
              // Delete if hours set to 0
              promises.push(deleteTimeEntry.mutateAsync(entry.id));
            } else {
              promises.push(updateTimeEntry.mutateAsync({
                id: entry.id,
                updates: { hours: entry.hours, notes: entry.notes || null, billable: entry.billable, role_id: roleId },
              }));
            }
          } else if (entry.hours > 0) {
            // New entry - only create if hours > 0
            if (!isAdmin && !assignmentRoleMap.has(entry.projectId)) {
              toast.error("You're not assigned to this project yet. Please contact an admin.");
              continue;
            }
            promises.push(createTimeEntry.mutateAsync({
              user_id: employee.user_id,
              project_id: entry.projectId,
              date: dateStr,
              hours: entry.hours,
              billable: entry.billable,
              notes: entry.notes || null,
              status: 'normal',
              role_id: roleId,
            }));
          }
        }
      }

      await Promise.all(promises);
      setPendingChanges({});
      toast.success("Saved — you're all set.");
    } catch (error) {
      toast.error('Something went wrong while saving. Please try again.');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => addDays(prev, direction === 'prev' ? -7 : 7));
    setPendingChanges({});
  };

  const hasChanges = Object.keys(pendingChanges).length > 0;

  const weeklyTotal = useMemo(() => {
    let total = 0;
    for (let i = 0; i < 7; i++) {
      total += getEntriesForDay(i).reduce((sum, e) => sum + e.hours, 0);
    }
    return total;
  }, [weekEntries, pendingChanges, availableProjects]);

  const isLoading = projectsLoading || assignmentsLoading || entriesLoading;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (availableProjects.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Weekly Time Log</h1>
          <p className="text-muted-foreground">You're not assigned to any projects yet. Please contact an admin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Weekly Time Log</h1>
          <p className="text-muted-foreground">Log your hours day by day — one entry per project per day</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-base px-3 py-1.5 font-bold">
            {weeklyTotal}h this week
          </Badge>
          <Button onClick={handleSave} className="gap-2" disabled={isSaving || !hasChanges}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Week Navigator */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}><ChevronLeft className="h-4 w-4" /></Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 min-w-[220px]">
              <CalendarIcon className="h-4 w-4" />
              Week of {format(weekStart, 'MMM d, yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={selectedDate} onSelect={(date) => { if (date) { setSelectedDate(date); setPendingChanges({}); } }} initialFocus className="pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <p className="text-xs text-muted-foreground">You can leave hours at 0 for projects you didn't work on today.</p>

      {/* Day-by-day sections */}
      <div className="space-y-4">
        {DAY_NAMES.map((dayName, dayIndex) => {
          const entries = getEntriesForDay(dayIndex);
          const dayTotal = entries.reduce((sum, e) => sum + e.hours, 0);
          const dateStr = format(getDayDate(dayIndex), 'MMM d');
          const isToday = format(getDayDate(dayIndex), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

          return (
            <Card key={dayIndex} className={`card-elevated ${isToday ? 'ring-2 ring-primary/30' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold ${isToday ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {dayName.slice(0, 3)}
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">{dayName}, {dateStr}</span>
                    </div>
                    {dayTotal > 0 && <Badge variant="secondary">{dayTotal}h</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-1.5">
                {entries.map((entry, entryIndex) => {
                  const noteKey = `${dayIndex}-${entryIndex}`;
                  const fullName = entry.clientName
                    ? `${entry.projectName} (${entry.clientName})`
                    : entry.projectName;
                  return (
                    <div key={entry.projectId} className="flex flex-col gap-1.5 p-2.5 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Project info — fills remaining space, truncates */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-hidden">
                              <span className="font-medium text-sm text-foreground truncate">{entry.projectName}</span>
                              {entry.clientName && (
                                <span className="text-xs text-muted-foreground truncate shrink-0 max-w-[120px]">({entry.clientName})</span>
                              )}
                              {entry.isInternal && <Badge variant="secondary" className="shrink-0 text-[10px] px-1 py-0">Internal</Badge>}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">{fullName}</TooltipContent>
                        </Tooltip>

                        {/* Hours — fixed 80px + label */}
                        <div className="flex items-center gap-1 shrink-0 w-[112px]">
                          <Input
                            type="number" min="0" max="24" step="0.5"
                            value={entry.hours || ''}
                            onChange={(e) => handleUpdateEntry(dayIndex, entryIndex, { hours: parseFloat(e.target.value) || 0 })}
                            className="w-[76px] h-8 text-center" placeholder="0"
                          />
                          <span className="text-xs text-muted-foreground w-[32px]">hrs</span>
                        </div>

                        {/* Billable toggle — fixed width */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5 shrink-0 w-[130px]">
                              <Switch
                                checked={entry.billable}
                                onCheckedChange={(v) => handleUpdateEntry(dayIndex, entryIndex, { billable: v })}
                                disabled={entry.isInternal}
                                className="h-5 w-9"
                              />
                              <Label className={`text-xs whitespace-nowrap ${entry.billable ? 'text-success' : 'text-muted-foreground'}`}>
                                {entry.billable ? 'Billable' : 'Non-billable'}
                              </Label>
                            </div>
                          </TooltipTrigger>
                          {entry.isInternal && (
                            <TooltipContent>Internal projects are always non-billable</TooltipContent>
                          )}
                        </Tooltip>

                        {/* Notes icon — fixed width */}
                        <Button
                          variant="ghost" size="sm"
                          className={`shrink-0 h-8 w-10 px-0 ${entry.notes ? 'text-primary' : 'text-muted-foreground'}`}
                          onClick={() => setExpandedNotes(expandedNotes === noteKey ? null : noteKey)}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>

                      {expandedNotes === noteKey && (
                        <Textarea
                          placeholder="Add notes for this entry..."
                          value={entry.notes}
                          onChange={(e) => handleUpdateEntry(dayIndex, entryIndex, { notes: e.target.value })}
                          rows={2} className="text-sm"
                        />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
