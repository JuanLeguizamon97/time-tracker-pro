import { useState } from 'react';
import { Plus, Users, Search, MoreHorizontal, Edit, ChevronDown, ChevronRight, Briefcase, Loader2 } from 'lucide-react';
import { useClients, useCreateClient, useUpdateClient } from '@/hooks/useClients';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Clients() {
  const { data: clients = [], isLoading } = useClients();
  const { data: projects = [] } = useProjects();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({ name: '', email: '', phone: '' });

  const filteredClients = clients.filter(
    client =>
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  const getProjectsByClient = (clientId: string) => projects.filter(p => p.client_id === clientId);

  const toggleExpanded = (clientId: string) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      newSet.has(clientId) ? newSet.delete(clientId) : newSet.add(clientId);
      return newSet;
    });
  };

  const handleSubmit = async () => {
    if (!formData.name) { toast.error('Por favor completa los campos obligatorios'); return; }
    try {
      if (editingClientId) {
        await updateClient.mutateAsync({
          id: editingClientId,
          updates: { name: formData.name, email: formData.email || null, phone: formData.phone || null },
        });
        toast.success('Cliente actualizado');
      } else {
        await createClient.mutateAsync({
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
        });
        toast.success('Cliente creado');
      }
      setFormData({ name: '', email: '', phone: '' });
      setEditingClientId(null);
      setIsDialogOpen(false);
    } catch { toast.error('Error al guardar el cliente'); }
  };

  const handleEdit = (client: typeof clients[0]) => {
    setFormData({ name: client.name, email: client.email || '', phone: client.phone || '' });
    setEditingClientId(client.id);
    setIsDialogOpen(true);
  };

  const handleToggleActive = async (client: typeof clients[0]) => {
    try {
      await updateClient.mutateAsync({ id: client.id, updates: { is_active: !client.is_active } });
      toast.success(client.is_active ? 'Cliente desactivado' : 'Cliente activado');
    } catch { toast.error('Error al actualizar el cliente'); }
  };

  if (isLoading) {
    return (<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">Gestiona los clientes y sus proyectos</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => { setEditingClientId(null); setFormData({ name: '', email: '', phone: '' }); }}>
              <Plus className="h-4 w-4" /> Nuevo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClientId ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
              <DialogDescription>{editingClientId ? 'Modifica los datos del cliente' : 'Añade un nuevo cliente a la empresa'}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: TechCorp S.A." />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="contacto@empresa.com" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+34 912 345 678" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmit}>{editingClientId ? 'Guardar' : 'Crear'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar clientes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
      </div>

      <div className="space-y-4">
        {filteredClients.map(client => {
          const clientProjects = getProjectsByClient(client.id);
          const isExpanded = expandedClients.has(client.id);
          return (
            <Card key={client.id} className="card-elevated">
              <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(client.id)}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </Button>
                      </CollapsibleTrigger>
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{client.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{client.email || 'Sin email'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1"><Briefcase className="h-3 w-3" />{clientProjects.length} proyectos</Badge>
                      <Badge variant={client.is_active ? 'default' : 'secondary'}>{client.is_active ? 'Activo' : 'Inactivo'}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(client)}><Edit className="h-4 w-4 mr-2" />Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(client)}>{client.is_active ? 'Desactivar' : 'Activar'}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="ml-14 mt-2 space-y-2">
                      <p className="text-sm font-medium text-muted-foreground mb-3">Proyectos asociados:</p>
                      {clientProjects.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {clientProjects.map(project => (
                            <div key={project.id} className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                              <Briefcase className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">{project.name}</span>
                              <Badge variant={project.is_active ? 'default' : 'secondary'} className="ml-auto text-xs">
                                {project.is_active ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No hay proyectos asociados</p>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>

      {filteredClients.length === 0 && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No se encontraron clientes</p>
        </div>
      )}
    </div>
  );
}
