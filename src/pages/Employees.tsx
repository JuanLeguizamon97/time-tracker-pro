import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle, Search, MoreHorizontal, Edit, Shield, Loader2, FolderKanban, UserPlus, Eye } from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
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
  const navigate = useNavigate();
  const { data: employees = [], isLoading } = useEmployees();
  const { data: allAssignments = [] } = useAssignedProjects();
  const { data: roles = [] } = useEmployeeRoles();
  const { employee: currentUser } = useAuth();
  const updateRole = useUpdateRole();

  const [searchTerm, setSearchTerm] = useState('');
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isSelfDemoteAlertOpen, setIsSelfDemoteAlertOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<Employee | null>(null);
  const [pendingRole, setPendingRole] = useState<AppRole>('employee');

  const getRole = (employeeId: string): AppRole => roles.find(r => r.user_id === employeeId)?.role || 'employee';
  const adminCount = roles.filter(r => r.role === 'admin').length;

  const filteredEmployees = employees.filter(
    emp => emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAssignedProjectsCount = (employeeId: string): number => allAssignments.filter(a => a.user_id === employeeId).length;

  const handleOpenRoleDialog = (emp: Employee) => {
    setRoleTarget(emp);
    setPendingRole(getRole(emp.id));
    setIsRoleDialogOpen(true);
  };

  const handleSaveRole = async () => {
    if (!roleTarget) return;
    const currentRole = getRole(roleTarget.id);
    if (pendingRole === currentRole) { setIsRoleDialogOpen(false); return; }

    if (currentRole === 'admin' && pendingRole === 'employee' && adminCount <= 1) {
      toast.error("You can't remove the last admin.");
      return;
    }

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
      await updateRole.mutateAsync({ userId: roleTarget.id, newRole: pendingRole });
      toast.success('Role updated.');
      setIsRoleDialogOpen(false);
      setIsSelfDemoteAlertOpen(false);
      setRoleTarget(null);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
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
            <Button size="sm" onClick={() => navigate('/employees/new')}>
              <UserPlus className="h-4 w-4 mr-2" />New Employee
            </Button>
          </div>
        </CardHeader>
        <CardContent>
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
                const role = getRole(emp.id);
                return (
                  <TableRow
                    key={emp.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/employees/${emp.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"><UserCircle className="h-5 w-5 text-primary" /></div>
                        <div>
                          <span className="font-medium">{emp.name}</span>
                          {emp.title && <p className="text-xs text-muted-foreground">{emp.title}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                    <TableCell>
                      <Badge variant={role === 'admin' ? 'default' : 'outline'} className="gap-1">
                        <Shield className="h-3 w-3" />{role === 'admin' ? 'Admin' : 'Employee'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-1"><FolderKanban className="h-3 w-3" />{getAssignedProjectsCount(emp.id)}</Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/employees/${emp.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/employees/${emp.id}/edit`)}>
                            <Edit className="h-4 w-4 mr-2" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenRoleDialog(emp)}>
                            <Shield className="h-4 w-4 mr-2" />Change Role
                          </DropdownMenuItem>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
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
    </div>
  );
}
