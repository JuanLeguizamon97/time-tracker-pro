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
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', manager_name: '', manager_email: '', manager_phone: '' });

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
    if (!formData.name) { toast.error('Please provide a client name.'); return; }
    try {
      if (editingClientId) {
        await updateClient.mutateAsync({
          id: editingClientId,
          updates: {
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            manager_name: formData.manager_name || null,
            manager_email: formData.manager_email || null,
            manager_phone: formData.manager_phone || null,
          },
        });
        toast.success("Saved — you're all set.");
      } else {
        await createClient.mutateAsync({
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          manager_name: formData.manager_name || undefined,
          manager_email: formData.manager_email || undefined,
          manager_phone: formData.manager_phone || undefined,
        });
        toast.success('Client created successfully.');
      }
      setFormData({ name: '', email: '', phone: '', manager_name: '', manager_email: '', manager_phone: '' });
      setEditingClientId(null);
      setIsDialogOpen(false);
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  const handleEdit = (client: typeof clients[0]) => {
    setFormData({ name: client.name, email: client.email || '', phone: client.phone || '', manager_name: client.manager_name || '', manager_email: client.manager_email || '', manager_phone: client.manager_phone || '' });
    setEditingClientId(client.id);
    setIsDialogOpen(true);
  };

  const handleToggleActive = async (client: typeof clients[0]) => {
    try {
      await updateClient.mutateAsync({ id: client.id, updates: { is_active: !client.is_active } });
      toast.success(client.is_active ? 'Client deactivated.' : 'Client activated.');
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  if (isLoading) {
    return (<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground">Manage clients and their projects</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => { setEditingClientId(null); setFormData({ name: '', email: '', phone: '', manager_name: '', manager_email: '', manager_phone: '' }); }}>
              <Plus className="h-4 w-4" /> New Client
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingClientId ? 'Edit Client' : 'New Client'}</DialogTitle>
              <DialogDescription>{editingClientId ? 'Update client details below.' : 'Add a new client to your organization.'}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. TechCorp Inc." />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="contact@company.com" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+1 (555) 123-4567" />
              </div>
              <div className="border-t pt-4 mt-2">
                <p className="text-sm font-medium text-muted-foreground mb-3">Manager / Responsible Contact</p>
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="manager_name">Manager Name</Label>
                    <Input id="manager_name" value={formData.manager_name} onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })} placeholder="John Smith" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="manager_email">Manager Email</Label>
                    <Input id="manager_email" type="email" value={formData.manager_email} onChange={(e) => setFormData({ ...formData, manager_email: e.target.value })} placeholder="john@company.com" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="manager_phone">Manager Phone</Label>
                    <Input id="manager_phone" value={formData.manager_phone} onChange={(e) => setFormData({ ...formData, manager_phone: e.target.value })} placeholder="+1 (555) 987-6543" />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>{editingClientId ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search clients..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
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
                        <p className="text-sm text-muted-foreground">{client.email || 'No email'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1"><Briefcase className="h-3 w-3" />{clientProjects.length} projects</Badge>
                      <Badge variant={client.is_active ? 'default' : 'secondary'}>{client.is_active ? 'Active' : 'Inactive'}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(client)}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleActive(client)}>{client.is_active ? 'Deactivate' : 'Activate'}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="ml-14 mt-2 space-y-2">
                      <p className="text-sm font-medium text-muted-foreground mb-3">Associated projects:</p>
                      {clientProjects.length > 0 ? (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {clientProjects.map(project => (
                            <div key={project.id} className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                              <Briefcase className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">{project.name}</span>
                              <Badge variant={project.is_active ? 'default' : 'secondary'} className="ml-auto text-xs">
                                {project.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No projects yet</p>
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
          <p className="text-muted-foreground">No clients found</p>
        </div>
      )}
    </div>
  );
}
