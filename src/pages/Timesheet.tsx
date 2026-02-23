import { useState, useMemo } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight, Save, Loader2, Plus, Trash2, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { useAssignedProjectsWithDetails } from '@/hooks/useAssignedProjects';
import { useTimeEntriesByWeek, useCreateTimeEntry, useUpdateTimeEntry, useDeleteTimeEntry } from '@/hooks/useTimeEntries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { TimeEntry, Project } from '@/types';

interface DayEntry {
  id?: string; // existing entry id
  projectId: string;
  hours: number;
  notes: string;
  billable: boolean;
  isNew?: boolean;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Timesheet() {
  const { employee, isAdmin } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isSaving, setIsSaving] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, DayEntry[]>>({});
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });

  const { data: allProjects = [], isLoading: projectsLoading } = useActiveProjects();
  const { data: clients = [] } = useClients();
  const { data: assignedProjects = [], isLoading: assignmentsLoading } = useAssignedProjectsWithDetails(employee?.user_id);
  const { data: weekEntries = [], isLoading: entriesLoading } = useTimeEntriesByWeek(weekStart, employee?.user_id);

  const createTimeEntry = useCreateTimeEntry();
  const updateTimeEntry = useUpdateTimeEntry();
  const deleteTimeEntry = useDeleteTimeEntry();

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

  const getEntriesForDay = (dayIndex: number): DayEntry[] => {
    const dateStr = getDayDateStr(dayIndex);
    if (pendingChanges[dateStr]) return pendingChanges[dateStr];

    return weekEntries
      .filter(e => e.date === dateStr)
      .map(e => ({
        id: e.id,
        projectId: e.project_id,
        hours: Number(e.hours),
        notes: e.notes || '',
        billable: e.billable,
      }));
  };

  const updateDayEntries = (dayIndex: number, entries: DayEntry[]) => {
    const dateStr = getDayDateStr(dayIndex);
    setPendingChanges(prev => ({ ...prev, [dateStr]: entries }));
  };

  const handleAddEntry = (dayIndex: number) => {
    const current = getEntriesForDay(dayIndex);
    const usedProjects = new Set(current.map(e => e.projectId));
    const available = availableProjects.filter(p => !usedProjects.has(p.id));
    if (available.length === 0) {
      toast.error('All your projects already have entries for this day.');
      return;
    }
    const firstAvailable = available[0];
    updateDayEntries(dayIndex, [
      ...current,
      { projectId: firstAvailable.id, hours: 0, notes: '', billable: !firstAvailable.isInternal, isNew: true },
    ]);
  };

  const handleUpdateEntry = (dayIndex: number, entryIndex: number, updates: Partial<DayEntry>) => {
    const entries = [...getEntriesForDay(dayIndex)];
    const entry = { ...entries[entryIndex], ...updates };
    // Lock billable for internal projects
    const proj = availableProjects.find(p => p.id === entry.projectId);
    if (proj?.isInternal) entry.billable = false;
    entries[entryIndex] = entry;
    updateDayEntries(dayIndex, entries);
  };

  const handleChangeProject = (dayIndex: number, entryIndex: number, newProjectId: string) => {
    const entries = getEntriesForDay(dayIndex);
    const duplicate = entries.find((e, i) => i !== entryIndex && e.projectId === newProjectId);
    if (duplicate) {
      toast.error('You already logged time for this project today. Edit the existing entry instead.');
      return;
    }
    const proj = availableProjects.find(p => p.id === newProjectId);
    handleUpdateEntry(dayIndex, entryIndex, {
      projectId: newProjectId,
      billable: proj?.isInternal ? false : true,
    });
  };

  const handleRemoveEntry = (dayIndex: number, entryIndex: number) => {
    const entries = getEntriesForDay(dayIndex);
    updateDayEntries(dayIndex, entries.filter((_, i) => i !== entryIndex));
  };

  const handleSave = async () => {
    if (!employee) return;
    setIsSaving(true);
    try {
      const promises: Promise<unknown>[] = [];

      for (const [dateStr, entries] of Object.entries(pendingChanges)) {
        const existingForDate = weekEntries.filter(e => e.date === dateStr);
        const existingIds = new Set(entries.filter(e => e.id).map(e => e.id));

        // Delete removed entries
        for (const existing of existingForDate) {
          if (!existingIds.has(existing.id)) {
            promises.push(deleteTimeEntry.mutateAsync(existing.id));
          }
        }

        for (const entry of entries) {
          if (entry.hours <= 0 && !entry.id) continue; // skip empty new entries
          if (entry.id) {
            // Update existing
            const original = weekEntries.find(e => e.id === entry.id);
            if (original && (
              Number(original.hours) !== entry.hours ||
              original.notes !== (entry.notes || null) ||
              original.billable !== entry.billable ||
              original.project_id !== entry.projectId
            )) {
              if (entry.hours <= 0) {
                promises.push(deleteTimeEntry.mutateAsync(entry.id));
              } else {
                promises.push(updateTimeEntry.mutateAsync({
                  id: entry.id,
                  updates: { hours: entry.hours, notes: entry.notes || null, billable: entry.billable, project_id: entry.projectId },
                }));
              }
            }
          } else if (entry.hours > 0) {
            // Create new
            promises.push(createTimeEntry.mutateAsync({
              user_id: employee.user_id,
              project_id: entry.projectId,
              date: dateStr,
              hours: entry.hours,
              billable: entry.billable,
              notes: entry.notes || null,
              status: 'normal',
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
      const entries = getEntriesForDay(i);
      total += entries.reduce((sum, e) => sum + e.hours, 0);
    }
    return total;
  }, [weekEntries, pendingChanges]);

  const isLoading = projectsLoading || assignmentsLoading || entriesLoading;

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
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

      {/* Day-by-day entries */}
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
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${isToday ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {dayName}
                    </div>
                    <span className="text-sm text-muted-foreground">{dateStr}</span>
                    {dayTotal > 0 && <Badge variant="secondary">{dayTotal}h</Badge>}
                  </div>
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-primary" onClick={() => handleAddEntry(dayIndex)}>
                    <Plus className="h-4 w-4" />Add Entry
                  </Button>
                </div>
              </CardHeader>
              {entries.length > 0 && (
                <CardContent className="pt-0 space-y-3">
                  {entries.map((entry, entryIndex) => {
                    const proj = availableProjects.find(p => p.id === entry.projectId);
                    const isInternal = proj?.isInternal || false;
                    const noteKey = `${dayIndex}-${entryIndex}`;

                    return (
                      <div key={entryIndex} className="flex flex-col gap-2 p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3 flex-wrap">
                          {/* Project selector */}
                          <Select value={entry.projectId} onValueChange={(v) => handleChangeProject(dayIndex, entryIndex, v)}>
                            <SelectTrigger className="w-[200px] h-9">
                              <SelectValue placeholder="Select project" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableProjects.map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                  {p.isInternal && <span className="text-muted-foreground ml-1">(Internal)</span>}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Hours */}
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min="0"
                              max="24"
                              step="0.5"
                              value={entry.hours || ''}
                              onChange={(e) => handleUpdateEntry(dayIndex, entryIndex, { hours: parseFloat(e.target.value) || 0 })}
                              className="time-input w-20 h-9"
                              placeholder="0"
                            />
                            <span className="text-sm text-muted-foreground">hrs</span>
                          </div>

                          {/* Billable toggle */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5">
                                <Switch
                                  checked={entry.billable}
                                  onCheckedChange={(v) => handleUpdateEntry(dayIndex, entryIndex, { billable: v })}
                                  disabled={isInternal}
                                  className="h-5 w-9"
                                />
                                <Label className={`text-xs ${entry.billable ? 'text-success' : 'text-muted-foreground'}`}>
                                  {entry.billable ? 'Billable' : 'Non-billable'}
                                </Label>
                              </div>
                            </TooltipTrigger>
                            {isInternal && (
                              <TooltipContent>Internal projects are always non-billable</TooltipContent>
                            )}
                          </Tooltip>

                          {/* Notes toggle */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 px-2 ${entry.notes ? 'text-primary' : 'text-muted-foreground'}`}
                            onClick={() => setExpandedNotes(expandedNotes === noteKey ? null : noteKey)}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Button>

                          {/* Remove */}
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-destructive ml-auto" onClick={() => handleRemoveEntry(dayIndex, entryIndex)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Notes expanded */}
                        {expandedNotes === noteKey && (
                          <Textarea
                            placeholder="Add notes for this entry..."
                            value={entry.notes}
                            onChange={(e) => handleUpdateEntry(dayIndex, entryIndex, { notes: e.target.value })}
                            rows={2}
                            className="text-sm"
                          />
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
