import { useState } from 'react';
import { Plus, Briefcase, Search, MoreHorizontal, Edit, Loader2 } from 'lucide-react';
import { useProjects, useCreateProject, useUpdateProject } from '@/hooks/useProjects';
import { useActiveClients } from '@/hooks/useClients';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Projects() {
  const { data: projects = [], isLoading } = useProjects();
  const { data: clients = [] } = useActiveClients();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', client_id: '' });

  const getClientName = (clientId: string) => clients.find(c => c.id === clientId)?.name || 'No client';

  const filteredProjects = projects.filter(
    project =>
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getClientName(project.client_id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!formData.name || !formData.client_id) { toast.error('Please fill in the required fields.'); return; }
    try {
      if (editingProject) {
        await updateProject.mutateAsync({ id: editingProject, updates: { name: formData.name, client_id: formData.client_id } });
        toast.success("Saved — you're all set.");
      } else {
        await createProject.mutateAsync({ name: formData.name, client_id: formData.client_id });
        toast.success('Project created successfully.');
      }
      setFormData({ name: '', client_id: '' });
      setEditingProject(null);
      setIsDialogOpen(false);
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  const handleEdit = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setFormData({ name: project.name, client_id: project.client_id });
      setEditingProject(projectId);
      setIsDialogOpen(true);
    }
  };

  const handleToggleActive = async (projectId: string, isActive: boolean) => {
    try {
      await updateProject.mutateAsync({ id: projectId, updates: { is_active: !isActive } });
      toast.success(isActive ? 'Project deactivated.' : 'Project activated.');
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  if (isLoading) {
    return (<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-muted-foreground">Manage your company's projects</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => { setEditingProject(null); setFormData({ name: '', client_id: '' }); }}>
              <Plus className="h-4 w-4" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProject ? 'Edit Project' : 'New Project'}</DialogTitle>
              <DialogDescription>{editingProject ? 'Update the project details below.' : 'Add a new project to your organization.'}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Project name *</Label>
                <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Corporate Web Portal" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="client">Client *</Label>
                <Select value={formData.client_id} onValueChange={(value) => setFormData({ ...formData, client_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select a client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (<SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSubmit}>{editingProject ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search projects..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredProjects.map(project => (
          <Card key={project.id} className="card-elevated group transition-all duration-200 hover:shadow-lg">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Briefcase className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{project.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{getClientName(project.client_id)}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(project.id)}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleToggleActive(project.id, project.is_active)}>{project.is_active ? 'Deactivate' : 'Activate'}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              <Badge variant={project.is_active ? 'default' : 'secondary'}>{project.is_active ? 'Active' : 'Inactive'}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No projects found</p>
        </div>
      )}
    </div>
  );
}
