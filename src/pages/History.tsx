import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { CalendarIcon, ChevronLeft, ChevronRight, FileBarChart, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { useTimeEntriesByDateRange } from '@/hooks/useTimeEntries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function History() {
  const { employee } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);

  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: monthEntries = [], isLoading } = useTimeEntriesByDateRange(monthStart, monthEnd, employee?.user_id);

  const sortedEntries = useMemo(() => {
    return [...monthEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [monthEntries]);

  const totalHours = monthEntries.reduce((sum, entry) => sum + Number(entry.hours), 0);

  const projectStats = useMemo(() => {
    const stats: Record<string, { hours: number; projectName: string; clientName: string }> = {};
    monthEntries.forEach(entry => {
      if (!stats[entry.project_id]) {
        const project = projects.find(p => p.id === entry.project_id);
        const client = project ? clients.find(c => c.id === project.client_id) : null;
        stats[entry.project_id] = {
          hours: 0,
          projectName: project?.name || 'Unknown project',
          clientName: client?.name || 'No client',
        };
      }
      stats[entry.project_id].hours += Number(entry.hours);
    });
    return Object.entries(stats).sort((a, b) => b[1].hours - a[1].hours);
  }, [monthEntries, projects, clients]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => (direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)));
  };

  const getProjectName = (projectId: string) => projects.find(p => p.id === projectId)?.name || 'Unknown project';

  if (isLoading) {
    return (<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Hours History</h1>
          <p className="text-muted-foreground">Review your logged hours by month</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')}><ChevronLeft className="h-4 w-4" /></Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 min-w-[180px]">
              <CalendarIcon className="h-4 w-4" />
              {format(selectedDate, 'MMMM yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus className="pointer-events-auto" />
          </PopoverContent>
        </Popover>
        <Button variant="outline" size="icon" onClick={() => navigateMonth('next')}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="stat-card"><CardContent className="p-6"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"><FileBarChart className="h-6 w-6 text-primary" /></div><div><p className="text-sm text-muted-foreground">Total Hours</p><p className="text-2xl font-bold text-foreground">{totalHours}h</p></div></div></CardContent></Card>
        <Card className="stat-card"><CardContent className="p-6"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10"><FileBarChart className="h-6 w-6 text-success" /></div><div><p className="text-sm text-muted-foreground">Entries</p><p className="text-2xl font-bold text-foreground">{monthEntries.length}</p></div></div></CardContent></Card>
        <Card className="stat-card"><CardContent className="p-6"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10"><FileBarChart className="h-6 w-6 text-warning" /></div><div><p className="text-sm text-muted-foreground">Projects</p><p className="text-2xl font-bold text-foreground">{projectStats.length}</p></div></div></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="card-elevated">
          <CardHeader><CardTitle>By Project</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {projectStats.map(([projectId, { hours, projectName, clientName }]) => (
                <div key={projectId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div><p className="font-medium text-foreground">{projectName}</p><p className="text-sm text-muted-foreground">{clientName}</p></div>
                  <div className="text-right"><p className="font-bold text-primary">{hours}h</p><p className="text-xs text-muted-foreground">{totalHours > 0 ? Math.round((hours / totalHours) * 100) : 0}%</p></div>
                </div>
              ))}
              {projectStats.length === 0 && <p className="text-center text-muted-foreground py-8">No entries this month</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated">
          <CardHeader><CardTitle>Entry Details</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="table-header">Date</TableHead>
                    <TableHead className="table-header">Project</TableHead>
                    <TableHead className="table-header text-right">Hours</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEntries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>{format(new Date(entry.date), 'MMM d')}</TableCell>
                      <TableCell>{getProjectName(entry.project_id)}</TableCell>
                      <TableCell className="text-right font-medium">{Number(entry.hours)}h</TableCell>
                    </TableRow>
                  ))}
                  {sortedEntries.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No entries this month</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
