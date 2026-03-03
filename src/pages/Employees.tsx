import { useState } from 'react';
import { UserCircle, Search, MoreHorizontal, Edit, Shield, Loader2, FolderKanban, UserPlus } from 'lucide-react';
import { useEmployees, useUpdateEmployee, useCreateEmployee } from '@/hooks/useEmployees';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { EmployeeProjectsDialog } from '@/components/EmployeeProjectsDialog';
import { api } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function useEmployeeRoles() {
  return useQuery({
    queryKey: ['user-roles'],
    queryFn: () => api.get<{ id: string; user_id: string; role: AppRole }[]>('/user-roles'),
  });
}

function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: AppRole }) =>
      api.put(`/user-roles/${userId}`, { role: newRole }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
    },
  });
}

export default function Employees() {
  const queryClient = useQueryClient();
  const { data: employees = [], isLoading } = useEmployees();
  const { data: allAssignments = [] } = useAssignedProjects();
  const { data: roles = [] } = useEmployeeRoles();
  const { employee: currentUser } = useAuth();
  const updateEmployee = useUpdateEmployee();
  const updateRole = useUpdateRole();
  const createEmployee = useCreateEmployee();

  const [searchTerm, setSearchTerm] = useState('');
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [newFormData, setNewFormData] = useState({ name: '', email: '', hourly_rate: '', role: 'employee' as AppRole });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProjectsDialogOpen, setIsProjectsDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isSelfDemoteAlertOpen, setIsSelfDemoteAlertOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [roleTarget, setRoleTarget] = useState<Employee | null>(null);
  const [pendingRole, setPendingRole] = useState<AppRole>('employee');
  const [formData, setFormData] = useState({ name: '' });

  const getRole = (userId: string): AppRole => roles.find(r => r.user_id === userId)?.role || 'employee';
  const adminCount = roles.filter(r => r.role === 'admin').length;

  const filteredEmployees = employees.filter(
    emp => emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAssignedProjectsCount = (userId: string): number => allAssignments.filter(a => a.user_id === userId).length;

  const handleCreateSubmit = async () => {
    if (!newFormData.name.trim() || !newFormData.email.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    try {
      const payload: { name: string; email: string; hourly_rate?: number } = {
        name: newFormData.name.trim(),
        email: newFormData.email.trim(),
      };
      if (newFormData.hourly_rate) payload.hourly_rate = parseFloat(newFormData.hourly_rate);
      const created = await createEmployee.mutateAsync(payload);
      if (newFormData.role === 'admin') {
        await api.post('/user-roles', { user_id: created.id, role: 'admin' });
        queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      }
      toast.success(`${created.name} added successfully.`);
      setIsNewDialogOpen(false);
      setNewFormData({ name: '', email: '', hourly_rate: '', role: 'employee' });
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  };

  const handleEdit = (emp: Employee) => {
    setFormData({ name: emp.name });
    setEditingEmployeeId(emp.id);
    setIsDialogOpen(true);
  };

  const handleOpenProjects = (emp: Employee) => { setSelectedEmployee(emp); setIsProjectsDialogOpen(true); };

  const handleOpenRoleDialog = (emp: Employee) => {
    setRoleTarget(emp);
    setPendingRole(getRole(emp.user_id));
    setIsRoleDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!roleTarget) return;
    const currentRole = getRole(roleTarget.user_id);
    if (pendingRole === currentRole) { setIsRoleDialogOpen(false); return; }

    // Last admin guard
    if (currentRole === 'admin' && pendingRole === 'employee' && adminCount <= 1) {
      toast.error("You can't remove the last admin.");
      return;
    }

    // Self-demotion warning
    const isSelf = currentUser?.user_id === roleTarget.user_id;
    if (isSelf && currentRole === 'admin' && pendingRole === 'employee') {
      setIsRoleDialogOpen(false);
      setIsSelfDemoteAlertOpen(true);
      return;
    }

    await executeRoleChange();
  };

  const executeRoleChange = async () => {
    if (!roleTarget) return;
    try {
      await updateRole.mutateAsync({ userId: roleTarget.user_id, newRole: pendingRole });
      toast.success('Role updated.');
      setIsRoleDialogOpen(false);
      setIsSelfDemoteAlertOpen(false);
      setRoleTarget(null);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) { toast.error('Please fill in all fields correctly.'); return; }
    try {
      await updateEmployee.mutateAsync({ id: editingEmployeeId!, updates: { name: formData.name } });
      toast.success("Saved — you're all set.");
      setIsDialogOpen(false);
      setEditingEmployeeId(null);
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  if (isLoading) {
    return (<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Employees</h1>
          <p className="text-muted-foreground">Manage team members, roles, and project assignments</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
              <div><p className="text-sm text-muted-foreground">Admins</p><p className="text-2xl font-bold text-foreground">{adminCount}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Team Members</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search employees..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Button size="sm" onClick={() => setIsNewDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />New Employee
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">Rates are set per project role. Employee rates are derived from assignments.</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="table-header">Employee</TableHead>
                <TableHead className="table-header">Email</TableHead>
                <TableHead className="table-header">App Role</TableHead>
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
                          <DropdownMenuItem onClick={() => handleOpenRoleDialog(emp)}><Shield className="h-4 w-4 mr-2" />Change Role</DropdownMenuItem>
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

      {/* Edit Employee Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update employee details.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>Update the app role for {roleTarget?.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={pendingRole} onValueChange={(v) => setPendingRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRole} disabled={updateRole.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Self-Demotion Confirmation */}
      <AlertDialog open={isSelfDemoteAlertOpen} onOpenChange={setIsSelfDemoteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              You're changing your own role. This may remove your admin access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeRoleChange}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EmployeeProjectsDialog open={isProjectsDialogOpen} onOpenChange={setIsProjectsDialogOpen} employee={selectedEmployee} />

      {/* New Employee Dialog */}
      <Dialog open={isNewDialogOpen} onOpenChange={setIsNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Employee</DialogTitle>
            <DialogDescription>Add a new team member to the system.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-name">Name <span className="text-destructive">*</span></Label>
              <Input id="new-name" placeholder="Full name" value={newFormData.name} onChange={(e) => setNewFormData({ ...newFormData, name: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-email">Email <span className="text-destructive">*</span></Label>
              <Input id="new-email" type="email" placeholder="email@company.com" value={newFormData.email} onChange={(e) => setNewFormData({ ...newFormData, email: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-rate">Hourly Rate (USD)</Label>
              <Input id="new-rate" type="number" min="0" step="0.01" placeholder="0.00" value={newFormData.hourly_rate} onChange={(e) => setNewFormData({ ...newFormData, hourly_rate: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>App Role</Label>
              <Select value={newFormData.role} onValueChange={(v) => setNewFormData({ ...newFormData, role: v as AppRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateSubmit} disabled={createEmployee.isPending}>
              {createEmployee.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
              Add Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
