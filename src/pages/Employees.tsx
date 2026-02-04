import { useState } from 'react';
import { Plus, UserCircle, Search, MoreHorizontal, Edit, DollarSign, Shield, Loader2 } from 'lucide-react';
import { useProfiles, useUpdateProfile, useUserRoles, useUpdateUserRole } from '@/hooks/useProfiles';
import { useAuth } from '@/contexts/AuthContext';
import { AppRole } from '@/types';
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

export default function Employees() {
  const { user } = useAuth();
  const { data: profiles = [], isLoading } = useProfiles();
  const { data: userRoles = [] } = useUserRoles();
  const updateProfile = useUpdateProfile();
  const updateUserRole = useUpdateUserRole();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    hourly_rate: 0,
    role: 'employee' as AppRole,
  });

  const filteredProfiles = profiles.filter(profile =>
    profile.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    profile.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = profiles.filter(p => p.is_active).length;

  const getUserRole = (userId: string): AppRole => {
    const role = userRoles.find(r => r.user_id === userId);
    return (role?.role as AppRole) || 'employee';
  };

  const handleEdit = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      setFormData({
        name: profile.name,
        email: profile.email,
        hourly_rate: Number(profile.hourly_rate),
        role: getUserRole(profile.user_id),
      });
      setEditingProfile(profileId);
      setIsDialogOpen(true);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || formData.hourly_rate < 0) {
      toast.error('Por favor completa todos los campos correctamente');
      return;
    }

    try {
      const profile = profiles.find(p => p.id === editingProfile);
      if (!profile) return;

      await updateProfile.mutateAsync({
        id: editingProfile!,
        updates: {
          name: formData.name,
          hourly_rate: formData.hourly_rate,
        },
      });

      await updateUserRole.mutateAsync({
        userId: profile.user_id,
        role: formData.role,
      });

      toast.success('Empleado actualizado');
      setIsDialogOpen(false);
      setEditingProfile(null);
    } catch (error) {
      toast.error('Error al actualizar el empleado');
    }
  };

  const handleToggleActive = async (profileId: string, isActive: boolean) => {
    try {
      await updateProfile.mutateAsync({
        id: profileId,
        updates: { is_active: !isActive },
      });
      toast.success(isActive ? 'Empleado dado de baja' : 'Empleado dado de alta');
    } catch (error) {
      toast.error('Error al actualizar el estado');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const avgRate = activeCount > 0
    ? Math.round(profiles.filter(p => p.is_active).reduce((sum, p) => sum + Number(p.hourly_rate), 0) / activeCount)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Empleados</h1>
          <p className="text-muted-foreground">Gestiona los empleados, tarifas y roles</p>
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
                <p className="text-2xl font-bold text-foreground">{profiles.length}</p>
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
                <p className="text-2xl font-bold text-foreground">€{avgRate}/h</p>
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
                <TableHead className="table-header">Estado</TableHead>
                <TableHead className="table-header text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProfiles.map(profile => (
                <TableRow key={profile.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <UserCircle className="h-5 w-5 text-primary" />
                      </div>
                      <span className="font-medium">{profile.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{profile.email}</TableCell>
                  <TableCell>
                    <span className="font-semibold text-primary">€{profile.hourly_rate}/h</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getUserRole(profile.user_id) === 'admin' ? 'default' : 'outline'} className="gap-1">
                      <Shield className="h-3 w-3" />
                      {getUserRole(profile.user_id) === 'admin' ? 'Admin' : 'Empleado'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={profile.is_active ? 'default' : 'secondary'}>
                      {profile.is_active ? 'Activo' : 'Baja'}
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
                        <DropdownMenuItem onClick={() => handleEdit(profile.id)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        {profile.user_id !== user?.id && (
                          <DropdownMenuItem onClick={() => handleToggleActive(profile.id, profile.is_active)}>
                            {profile.is_active ? 'Dar de baja' : 'Dar de alta'}
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredProfiles.length === 0 && (
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
            <DialogDescription>
              Modifica los datos, tarifa y rol del empleado
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate">Tarifa por hora (€)</Label>
              <Input
                id="rate"
                type="number"
                min="0"
                step="0.5"
                value={formData.hourly_rate || ''}
                onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Rol</Label>
              <Select value={formData.role} onValueChange={(value: AppRole) => setFormData({ ...formData, role: value })}>
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
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
