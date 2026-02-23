import { useState } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight, Save, Loader2 } from 'lucide-react';
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
import { toast } from 'sonner';
import { TimeEntry } from '@/types';

interface ProjectRow {
  projectId: string;
  clientId: string;
  projectName: string;
  clientName: string;
}

export default function Timesheet() {
  const { employee, isAdmin } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editedHours, setEditedHours] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });

  const { data: allProjects = [], isLoading: projectsLoading } = useActiveProjects();
  const { data: clients = [] } = useClients();
  const { data: assignedProjects = [], isLoading: assignmentsLoading } = useAssignedProjectsWithDetails(employee?.user_id);
  const { data: weekEntries = [], isLoading: entriesLoading } = useTimeEntriesByWeek(weekStart, employee?.user_id);

  const createTimeEntry = useCreateTimeEntry();
  const updateTimeEntry = useUpdateTimeEntry();
  const deleteTimeEntry = useDeleteTimeEntry();

  const projects: ProjectRow[] = isAdmin
    ? allProjects.map(p => {
        const client = clients.find(c => c.id === p.client_id);
        return { projectId: p.id, clientId: p.client_id, projectName: p.name, clientName: client?.name || '' };
      })
    : assignedProjects.map(ap => ({ projectId: ap.project_id, clientId: ap.client_id, projectName: ap.project_name, clientName: ap.client_name }));

  const getExistingEntry = (projectId: string): TimeEntry | undefined => weekEntries.find(e => e.project_id === projectId);

  const getHoursForProject = (projectId: string): number => {
    if (editedHours[projectId] !== undefined) return editedHours[projectId];
    const entry = getExistingEntry(projectId);
    return entry ? Number(entry.hours) : 0;
  };

  const handleHoursChange = (projectId: string, hours: number) => { setEditedHours(prev => ({ ...prev, [projectId]: hours })); };

  const getTotalWeek = (): number => projects.reduce((sum, p) => sum + getHoursForProject(p.projectId), 0);

  const handleSave = async () => {
    if (!employee) return;
    setIsSaving(true);
    try {
      const promises: Promise<unknown>[] = [];
      const dateStr = format(weekStart, 'yyyy-MM-dd');

      for (const [projectId, hours] of Object.entries(editedHours)) {
        const existing = getExistingEntry(projectId);
        if (existing && hours > 0) {
          promises.push(updateTimeEntry.mutateAsync({ id: existing.id, updates: { hours } }));
        } else if (existing && hours <= 0) {
          promises.push(deleteTimeEntry.mutateAsync(existing.id));
        } else if (!existing && hours > 0) {
          promises.push(createTimeEntry.mutateAsync({
            user_id: employee.user_id,
            project_id: projectId,
            date: dateStr,
            hours,
          }));
        }
      }

      await Promise.all(promises);
      setEditedHours({});
      toast.success("Saved — you're all set.");
    } catch (error) {
      toast.error('Something went wrong while saving. Please try again.');
      console.error(error);
    } finally { setIsSaving(false); }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => addDays(prev, direction === 'prev' ? -7 : 7));
    setEditedHours({});
  };

  const isLoading = projectsLoading || assignmentsLoading || entriesLoading;

  if (isLoading) {
    return (<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Weekly Time Log</h1>
          <p className="text-muted-foreground">Log your hours by project — quick and easy</p>
        </div>
        <Button onClick={handleSave} className="gap-2" disabled={isSaving || Object.keys(editedHours).length === 0}>
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <Card className="card-elevated">
        <CardHeader className="pb-4">
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
                <Calendar mode="single" selected={selectedDate} onSelect={(date) => { if (date) { setSelectedDate(date); setEditedHours({}); } }} initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="table-header text-left py-3 px-2 min-w-[250px]">Project</th>
                  <th className="table-header text-center py-3 px-2 min-w-[120px]">Total Hours</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(project => (
                  <tr key={project.projectId} className="border-b hover:bg-muted/30 transition-colors duration-150">
                    <td className="py-3 px-2">
                      <span className="font-medium text-foreground">{project.projectName}</span>
                      {project.clientName && <p className="text-xs text-muted-foreground">{project.clientName}</p>}
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Input type="number" min="0" max="168" step="0.5" value={getHoursForProject(project.projectId) || ''} onChange={(e) => handleHoursChange(project.projectId, parseFloat(e.target.value) || 0)} className="time-input w-24 mx-auto" />
                    </td>
                  </tr>
                ))}
                {projects.length === 0 && (
                  <tr><td colSpan={2} className="text-center py-8 text-muted-foreground">{isAdmin ? 'No active projects available yet.' : 'No projects assigned to you. Reach out to your admin for access.'}</td></tr>
                )}
                {projects.length > 0 && (
                  <tr className="bg-muted/50">
                    <td className="py-3 px-2 font-semibold text-foreground">Weekly Total</td>
                    <td className="py-3 px-2 text-center"><span className="font-bold text-lg text-primary">{getTotalWeek()}h</span></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
