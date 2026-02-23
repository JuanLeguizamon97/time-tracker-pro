import { useState } from 'react';
import { UserCircle, Search, MoreHorizontal, Edit, DollarSign, Shield, Loader2, FolderKanban } from 'lucide-react';
import { useEmployees, useUpdateEmployee } from '@/hooks/useEmployees';
import { useAssignedProjects } from '@/hooks/useAssignedProjects';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole, Employee } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { EmployeeProjectsDialog } from '@/components/EmployeeProjectsDialog';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

function useEmployeeRoles() {
  return useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_roles').select('*');
      if (error) throw error;
      return data as { id: string; user_id: string; role: AppRole }[];
    },
  });
}

export default function Employees() {
  const { data: employees = [], isLoading } = useEmployees();
  const { data: allAssignments = [] } = useAssignedProjects();
  const { data: roles = [] } = useEmployeeRoles();
  const updateEmployee = useUpdateEmployee();

  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProjectsDialogOpen, setIsProjectsDialogOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({ name: '', hourly_rate: 0 });

  const getRole = (userId: string): AppRole => roles.find(r => r.user_id === userId)?.role || 'employee';

  const filteredEmployees = employees.filter(
    emp => emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAssignedProjectsCount = (userId: string): number => allAssignments.filter(a => a.user_id === userId).length;

  const handleEdit = (emp: Employee) => {
    setFormData({ name: emp.name, hourly_rate: Number(emp.hourly_rate) || 0 });
    setEditingEmployeeId(emp.id);
    setIsDialogOpen(true);
  };

  const handleOpenProjects = (emp: Employee) => { setSelectedEmployee(emp); setIsProjectsDialogOpen(true); };

  const handleSubmit = async () => {
    if (!formData.name || formData.hourly_rate < 0) { toast.error('Please fill in all fields correctly.'); return; }
    try {
      await updateEmployee.mutateAsync({ id: editingEmployeeId!, updates: { name: formData.name, hourly_rate: formData.hourly_rate } });
      toast.success("Saved — you're all set.");
      setIsDialogOpen(false);
      setEditingEmployeeId(null);
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  if (isLoading) {
    return (<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  }

  const avgRate = employees.length > 0 ? Math.round(employees.reduce((sum, e) => sum + (Number(e.hourly_rate) || 0), 0) / employees.length) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-muted-foreground">Manage team members, rates, roles, and assignments</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10"><UserCircle className="h-6 w-6 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">Total Employees</p><p className="text-2xl font-bold text-foreground">{employees.length}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10"><UserCircle className="h-6 w-6 text-success" /></div>
              <div><p className="text-sm text-muted-foreground">Admins</p><p className="text-2xl font-bold text-foreground">{roles.filter(r => r.role === 'admin').length}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10"><DollarSign className="h-6 w-6 text-warning" /></div>
              <div><p className="text-sm text-muted-foreground">Avg. Rate</p><p className="text-2xl font-bold text-foreground">${avgRate}/h</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Team Members</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search employees..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="table-header">Employee</TableHead>
                <TableHead className="table-header">Email</TableHead>
                <TableHead className="table-header">Rate/Hour</TableHead>
                <TableHead className="table-header">Role</TableHead>
                <TableHead className="table-header">Projects</TableHead>
                <TableHead className="table-header text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map(emp => {
                const role = getRole(emp.user_id);
                return (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"><UserCircle className="h-5 w-5 text-primary" /></div>
                        <span className="font-medium">{emp.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                    <TableCell><span className="font-semibold text-primary">${Number(emp.hourly_rate) || 0}/h</span></TableCell>
                    <TableCell>
                      <Badge variant={role === 'admin' ? 'default' : 'outline'} className="gap-1">
                        <Shield className="h-3 w-3" />{role === 'admin' ? 'Admin' : 'Employee'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1"><FolderKanban className="h-3 w-3" />{getAssignedProjectsCount(emp.user_id)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(emp)}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenProjects(emp)}><FolderKanban className="h-4 w-4 mr-2" />Assign Projects</DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filteredEmployees.length === 0 && (
            <div className="text-center py-12"><UserCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><p className="text-muted-foreground">No employees found</p></div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update employee details and rate.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate">Hourly rate ($)</Label>
              <Input id="rate" type="number" min="0" step="0.5" value={formData.hourly_rate || ''} onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmployeeProjectsDialog open={isProjectsDialogOpen} onOpenChange={setIsProjectsDialogOpen} employee={selectedEmployee} />
    </div>
  );
}
