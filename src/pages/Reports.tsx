import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { CalendarIcon, Search, Download, Loader2, FileBarChart, Filter } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { useEmployees } from '@/hooks/useEmployees';
import { useAllTimeEntriesByDateRange, useTimeEntriesByDateRange } from '@/hooks/useTimeEntries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimeEntry } from '@/types';

export default function Reports() {
  const { employee, isAdmin } = useAuth();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfMonth(new Date()));
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [billedFilter, setBilledFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: employees = [] } = useEmployees();

  // Admin sees all, employee sees only their own
  const { data: allEntries = [], isLoading: allLoading } = useAllTimeEntriesByDateRange(startDate, endDate);
  const { data: myEntries = [], isLoading: myLoading } = useTimeEntriesByDateRange(startDate, endDate, employee?.user_id);

  const rawEntries = isAdmin ? allEntries : myEntries;
  const isLoading = isAdmin ? allLoading : myLoading;

  const filteredEntries = useMemo(() => {
    return rawEntries.filter(entry => {
      if (selectedEmployee !== 'all' && entry.user_id !== selectedEmployee) return false;
      if (selectedProject !== 'all' && entry.project_id !== selectedProject) return false;
      if (selectedClient !== 'all') {
        const proj = projects.find(p => p.id === entry.project_id);
        if (proj?.client_id !== selectedClient) return false;
      }
      if (statusFilter === 'normal' && entry.status !== 'normal') return false;
      if (statusFilter === 'on_hold' && entry.status !== 'on_hold') return false;
      if (billedFilter === 'billable' && !entry.billable) return false;
      if (billedFilter === 'non_billable' && entry.billable) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const proj = projects.find(p => p.id === entry.project_id);
        const emp = employees.find(e => e.user_id === entry.user_id);
        const searchable = `${proj?.name || ''} ${emp?.name || ''} ${entry.notes || ''}`.toLowerCase();
        if (!searchable.includes(term)) return false;
      }
      return true;
    });
  }, [rawEntries, selectedEmployee, selectedProject, selectedClient, statusFilter, billedFilter, searchTerm, projects, employees]);

  const sortedEntries = useMemo(() =>
    [...filteredEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [filteredEntries]
  );

  const projectTotals = useMemo(() => {
    const totals: Record<string, { name: string; clientName: string; hours: number; billableHours: number; entries: number }> = {};
    filteredEntries.forEach(entry => {
      if (!totals[entry.project_id]) {
        const proj = projects.find(p => p.id === entry.project_id);
        const client = proj ? clients.find(c => c.id === proj.client_id) : null;
        totals[entry.project_id] = { name: proj?.name || 'Unknown', clientName: client?.name || '', hours: 0, billableHours: 0, entries: 0 };
      }
      totals[entry.project_id].hours += Number(entry.hours);
      if (entry.billable) totals[entry.project_id].billableHours += Number(entry.hours);
      totals[entry.project_id].entries++;
    });
    return Object.entries(totals).sort((a, b) => b[1].hours - a[1].hours);
  }, [filteredEntries, projects, clients]);

  const totalHours = filteredEntries.reduce((sum, e) => sum + Number(e.hours), 0);
  const billableHours = filteredEntries.filter(e => e.billable).reduce((sum, e) => sum + Number(e.hours), 0);

  const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || 'Unknown';
  const getEmployeeName = (userId: string) => employees.find(e => e.user_id === userId)?.name || 'Unknown';

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employee Report</h1>
          <p className="text-muted-foreground">Detailed time entry analysis with filters</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="card-elevated">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" />Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Date range */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Start Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2 text-sm">
                    <CalendarIcon className="h-4 w-4" />{format(startDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start gap-2 text-sm">
                    <CalendarIcon className="h-4 w-4" />{format(endDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            {/* Employee filter (admin only) */}
            {isAdmin && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Employee</Label>
                <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map(emp => <SelectItem key={emp.user_id} value={emp.user_id}>{emp.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Project filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Project</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Client filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Client</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Status filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Billed filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Billing</Label>
              <Select value={billedFilter} onValueChange={setBilledFilter}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="billable">Billable</SelectItem>
                  <SelectItem value="non_billable">Non-billable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Notes, project..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 text-sm" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"><FileBarChart className="h-6 w-6 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">Total Hours</p><p className="text-2xl font-bold text-foreground">{totalHours}h</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10"><FileBarChart className="h-6 w-6 text-success" /></div>
              <div><p className="text-sm text-muted-foreground">Billable Hours</p><p className="text-2xl font-bold text-foreground">{billableHours}h</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10"><FileBarChart className="h-6 w-6 text-warning" /></div>
              <div><p className="text-sm text-muted-foreground">Entries</p><p className="text-2xl font-bold text-foreground">{filteredEntries.length}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Totals by project */}
        <Card className="card-elevated">
          <CardHeader><CardTitle className="text-base">Totals by Project</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {projectTotals.map(([projectId, { name, clientName, hours, billableHours: bh, entries }]) => (
                <div key={projectId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">{clientName} · {entries} entries · {bh}h billable</p>
                  </div>
                  <span className="font-bold text-primary">{hours}h</span>
                </div>
              ))}
              {projectTotals.length === 0 && <p className="text-center text-muted-foreground py-6">No data for the selected filters.</p>}
            </div>
          </CardContent>
        </Card>

        {/* Detailed entries */}
        <Card className="card-elevated">
          <CardHeader><CardTitle className="text-base">Detailed Entries</CardTitle></CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="table-header">Date</TableHead>
                    {isAdmin && <TableHead className="table-header">Employee</TableHead>}
                    <TableHead className="table-header">Project</TableHead>
                    <TableHead className="table-header text-right">Hours</TableHead>
                    <TableHead className="table-header">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEntries.slice(0, 100).map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell className="text-sm">{format(new Date(entry.date), 'MMM d')}</TableCell>
                      {isAdmin && <TableCell className="text-sm">{getEmployeeName(entry.user_id)}</TableCell>}
                      <TableCell className="text-sm">{getProjectName(entry.project_id)}</TableCell>
                      <TableCell className="text-right font-medium">{Number(entry.hours)}h</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant={entry.billable ? 'default' : 'secondary'} className="text-xs">
                            {entry.billable ? 'Billable' : 'Non-billable'}
                          </Badge>
                          {entry.status === 'on_hold' && <Badge variant="outline" className="text-xs text-warning border-warning">On Hold</Badge>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {sortedEntries.length === 0 && (
                    <TableRow><TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground py-8">No entries match the selected filters.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              {sortedEntries.length > 100 && <p className="text-xs text-muted-foreground text-center py-2">Showing first 100 of {sortedEntries.length} entries</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
