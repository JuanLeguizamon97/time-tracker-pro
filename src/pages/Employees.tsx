import { useState } from 'react';
import { Plus, UserCircle, Search, MoreHorizontal, Edit, DollarSign } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Employees() {
  const { employees, addEmployee, updateEmployee } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    rate: 0,
  });

  const filteredEmployees = employees.filter(employee =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = employees.filter(e => e.isActive).length;

  const handleSubmit = () => {
    if (!formData.name || !formData.email || formData.rate <= 0) {
      toast.error('Por favor completa todos los campos correctamente');
      return;
    }

    if (editingEmployee) {
      updateEmployee(editingEmployee, formData);
      toast.success('Empleado actualizado');
    } else {
      addEmployee({ ...formData, isActive: true });
      toast.success('Empleado creado');
    }

    setFormData({ name: '', email: '', rate: 0 });
    setEditingEmployee(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId);
    if (employee) {
      setFormData({
        name: employee.name,
        email: employee.email,
        rate: employee.rate,
      });
      setEditingEmployee(employeeId);
      setIsDialogOpen(true);
    }
  };

  const handleToggleActive = (employeeId: string, isActive: boolean) => {
    updateEmployee(employeeId, { isActive: !isActive });
    toast.success(isActive ? 'Empleado dado de baja' : 'Empleado dado de alta');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empleados</h1>
          <p className="text-muted-foreground">Gestiona los empleados y sus tarifas</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => { setEditingEmployee(null); setFormData({ name: '', email: '', rate: 0 }); }}>
              <Plus className="h-4 w-4" />
              Nuevo Empleado
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</DialogTitle>
              <DialogDescription>
                {editingEmployee ? 'Modifica los datos del empleado' : 'Añade un nuevo empleado a la empresa'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Juan García"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="juan@empresa.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rate">Tarifa por hora (€) *</Label>
                <Input
                  id="rate"
                  type="number"
                  min="0"
                  step="0.5"
                  value={formData.rate || ''}
                  onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                  placeholder="45"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit}>{editingEmployee ? 'Guardar' : 'Crear'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                <p className="text-sm text-muted-foreground">Activos</p>
                <p className="text-2xl font-bold text-foreground">{activeCount}</p>
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
                <p className="text-2xl font-bold text-foreground">
                  €{Math.round(employees.filter(e => e.isActive).reduce((sum, e) => sum + e.rate, 0) / activeCount || 0)}/h
                </p>
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
                <TableHead className="table-header">Estado</TableHead>
                <TableHead className="table-header text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.map(employee => (
                <TableRow key={employee.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <UserCircle className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-medium">{employee.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{employee.email}</TableCell>
                  <TableCell>
                    <span className="font-semibold text-primary">€{employee.rate}/h</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={employee.isActive ? 'default' : 'secondary'}>
                      {employee.isActive ? 'Activo' : 'Baja'}
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
                        <DropdownMenuItem onClick={() => handleEdit(employee.id)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(employee.id, employee.isActive)}>
                          {employee.isActive ? 'Dar de baja' : 'Dar de alta'}
                        </DropdownMenuItem>
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
    </div>
  );
}
