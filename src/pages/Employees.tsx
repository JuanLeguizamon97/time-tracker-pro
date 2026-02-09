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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { EmployeeProjectsDialog } from '@/components/EmployeeProjectsDialog';

export default function Employees() {
  const { employee: currentEmployee } = useAuth();
  const { data: employees = [], isLoading } = useEmployees();
  const { data: allAssignments = [] } = useAssignedProjects();
  const updateEmployee = useUpdateEmployee();

  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isProjectsDialogOpen, setIsProjectsDialogOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    employee_name: '',
    hourly_rate: 0,
    role: 'employee' as AppRole,
  });

  const filteredEmployees = employees.filter(
    emp =>
      emp.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getAssignedProjectsCount = (employeeId: string): number => {
    return allAssignments.filter(a => a.employee_id === employeeId).length;
  };

  const handleEdit = (emp: Employee) => {
    setFormData({
      employee_name: emp.employee_name,
      hourly_rate: Number(emp.hourly_rate) || 0,
      role: emp.role,
    });
    setEditingEmployeeId(emp.id_employee);
    setIsDialogOpen(true);
  };

  const handleOpenProjects = (emp: Employee) => {
    setSelectedEmployee(emp);
    setIsProjectsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.employee_name || formData.hourly_rate < 0) {
      toast.error('Por favor completa todos los campos correctamente');
      return;
    }

    try {
      await updateEmployee.mutateAsync({
        id: editingEmployeeId!,
        updates: {
          employee_name: formData.employee_name,
          hourly_rate: formData.hourly_rate,
          role: formData.role,
        },
      });

      toast.success('Empleado actualizado');
      setIsDialogOpen(false);
      setEditingEmployeeId(null);
    } catch (error) {
      toast.error('Error al actualizar el empleado');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const avgRate =
    employees.length > 0
      ? Math.round(
          employees.reduce((sum, e) => sum + (Number(e.hourly_rate) || 0), 0) / employees.length
        )
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empleados</h1>
          <p className="text-muted-foreground">Gestiona empleados, tarifas, roles y asignaciones</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <UserCircle className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Empleados</p>
                <p className="text-2xl font-bold text-foreground">{employees.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <UserCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Admins</p>
                <p className="text-2xl font-bold text-foreground">
                  {employees.filter(e => e.role === 'admin').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <DollarSign className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tarifa Media</p>
                <p className="text-2xl font-bold text-foreground">${avgRate}/h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-elevated">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lista de Empleados</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empleados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="table-header">Empleado</TableHead>
                <TableHead className="table-header">Email</TableHead>
                <TableHead className="table-header">Tarifa/Hora</TableHead>
                <TableHead className="table-header">Rol</TableHead>
                <TableHead className="table-header">Proyectos</TableHead>
                <TableHead className="table-header text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map(emp => (
                <TableRow key={emp.id_employee}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <UserCircle className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-medium">{emp.employee_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{emp.employee_email}</TableCell>
                  <TableCell>
                    <span className="font-semibold text-primary">
                      ${Number(emp.hourly_rate) || 0}/h
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={emp.role === 'admin' ? 'default' : 'outline'} className="gap-1">
                      <Shield className="h-3 w-3" />
                      {emp.role === 'admin' ? 'Admin' : 'Empleado'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="gap-1">
                      <FolderKanban className="h-3 w-3" />
                      {getAssignedProjectsCount(emp.id_employee)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(emp)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenProjects(emp)}>
                          <FolderKanban className="h-4 w-4 mr-2" />
                          Asignar Proyectos
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredEmployees.length === 0 && (
            <div className="text-center py-12">
              <UserCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No se encontraron empleados</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Empleado</DialogTitle>
            <DialogDescription>Modifica los datos, tarifa y rol del empleado</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={formData.employee_name}
                onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate">Tarifa por hora ($)</Label>
              <Input
                id="rate"
                type="number"
                min="0"
                step="0.5"
                value={formData.hourly_rate || ''}
                onChange={(e) =>
                  setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Rol</Label>
              <Select
                value={formData.role}
                onValueChange={(value: AppRole) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Empleado</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmployeeProjectsDialog
        open={isProjectsDialogOpen}
        onOpenChange={setIsProjectsDialogOpen}
        employee={selectedEmployee}
      />
    </div>
  );
}
