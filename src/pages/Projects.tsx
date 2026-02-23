import { useState } from 'react';
import { Plus, Briefcase, Search, MoreHorizontal, Edit, Loader2, Users, Tag, Trash2 } from 'lucide-react';
import { useProjects, useCreateProject, useUpdateProject } from '@/hooks/useProjects';
import { useActiveClients } from '@/hooks/useClients';
import { useProjectRoles, useCreateProjectRole, useUpdateProjectRole, useDeleteProjectRole } from '@/hooks/useProjectRoles';
import { useAssignedProjects } from '@/hooks/useAssignedProjects';
import { useEmployees } from '@/hooks/useEmployees';
import { Project, ProjectRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

// ── Roles & Rates Panel ──
function ProjectRolesPanel({ project }: { project: Project }) {
  const { data: roles = [], isLoading } = useProjectRoles(project.id);
  const createRole = useCreateProjectRole();
  const updateRole = useUpdateProjectRole();
  const deleteRole = useDeleteProjectRole();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<ProjectRole | null>(null);
  const [form, setForm] = useState({ name: '', hourly_rate_usd: 0 });

  const handleAdd = async () => {
    if (!form.name) { toast.error('Please enter a role name.'); return; }
    try {
      await createRole.mutateAsync({ project_id: project.id, name: form.name, hourly_rate_usd: form.hourly_rate_usd });
      toast.success("Role added — you're all set.");
      setForm({ name: '', hourly_rate_usd: 0 });
      setIsAddOpen(false);
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  const handleUpdate = async () => {
    if (!editingRole || !form.name) return;
    try {
      await updateRole.mutateAsync({ id: editingRole.id, updates: { name: form.name, hourly_rate_usd: form.hourly_rate_usd } });
      toast.success("Saved — you're all set.");
      setEditingRole(null);
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRole.mutateAsync(id);
      toast.success('Role removed.');
    } catch { toast.error('Cannot remove this role — it may be in use.'); }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Define roles and hourly rates (USD) for this project.</p>
        <Button size="sm" className="gap-1.5" onClick={() => { setForm({ name: '', hourly_rate_usd: 0 }); setIsAddOpen(true); }}>
          <Plus className="h-4 w-4" />Add Role
        </Button>
      </div>

      {roles.length === 0 ? (
        <div className="text-center py-8">
          <Tag className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">No roles defined yet. Add one to set billing rates.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="table-header">Role Name</TableHead>
              <TableHead className="table-header text-right">Rate (USD/h)</TableHead>
              <TableHead className="table-header text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map(role => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">{role.name}</TableCell>
                <TableCell className="text-right font-semibold text-primary">${Number(role.hourly_rate_usd)}/h</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => { setForm({ name: role.name, hourly_rate_usd: Number(role.hourly_rate_usd) }); setEditingRole(role); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(role.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add/Edit Role Dialog */}
      <Dialog open={isAddOpen || !!editingRole} onOpenChange={(v) => { if (!v) { setIsAddOpen(false); setEditingRole(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Edit Role' : 'Add Role'}</DialogTitle>
            <DialogDescription>Set the role name and hourly rate in USD.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Role name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Senior Developer" />
            </div>
            <div className="grid gap-2">
              <Label>Hourly rate (USD)</Label>
              <Input type="number" min="0" step="0.5" value={form.hourly_rate_usd || ''} onChange={(e) => setForm({ ...form, hourly_rate_usd: parseFloat(e.target.value) || 0 })} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddOpen(false); setEditingRole(null); }}>Cancel</Button>
            <Button onClick={editingRole ? handleUpdate : handleAdd}>{editingRole ? 'Save' : 'Add Role'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Assignments Panel ──
function ProjectAssignmentsPanel({ project }: { project: Project }) {
  const { data: roles = [] } = useProjectRoles(project.id);
  const { data: allAssignments = [], isLoading } = useAssignedProjects();
  const { data: employees = [] } = useEmployees();
  const queryClient = useQueryClient();

  const projectAssignments = allAssignments.filter(a => a.project_id === project.id);

  const handleAssign = async (userId: string) => {
    try {
      await supabase.from('employee_projects').insert({ user_id: userId, project_id: project.id });
      queryClient.invalidateQueries({ queryKey: ['assigned-projects'] });
      toast.success("Employee assigned — you're all set.");
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  const handleUnassign = async (assignmentId: string) => {
    try {
      await supabase.from('employee_projects').delete().eq('id', assignmentId);
      queryClient.invalidateQueries({ queryKey: ['assigned-projects'] });
      toast.success('Employee removed from project.');
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  const handleChangeRole = async (assignmentId: string, roleId: string) => {
    try {
      await supabase.from('employee_projects').update({ role_id: roleId === '__none__' ? null : roleId }).eq('id', assignmentId);
      queryClient.invalidateQueries({ queryKey: ['assigned-projects'] });
      toast.success("Role updated — you're all set.");
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  const unassignedEmployees = employees.filter(emp => !projectAssignments.some(a => a.user_id === emp.user_id));

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Assign employees and select their role for billing.</p>
        {unassignedEmployees.length > 0 && (
          <Select onValueChange={(v) => handleAssign(v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Assign employee..." />
            </SelectTrigger>
            <SelectContent>
              {unassignedEmployees.map(emp => (
                <SelectItem key={emp.user_id} value={emp.user_id}>{emp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {projectAssignments.length === 0 ? (
        <div className="text-center py-8">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground text-sm">No employees assigned yet.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="table-header">Employee</TableHead>
              <TableHead className="table-header">Role</TableHead>
              <TableHead className="table-header text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectAssignments.map(assignment => {
              const emp = employees.find(e => e.user_id === assignment.user_id);
              return (
                <TableRow key={assignment.id}>
                  <TableCell className="font-medium">{emp?.name || 'Unknown'}</TableCell>
                  <TableCell>
                    <Select value={assignment.role_id || '__none__'} onValueChange={(v) => handleChangeRole(assignment.id, v)}>
                      <SelectTrigger className="w-[180px] h-8">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No role</SelectItem>
                        {roles.map(role => (
                          <SelectItem key={role.id} value={role.id}>{role.name} — ${Number(role.hourly_rate_usd)}/h</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleUnassign(assignment.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ── Main Projects Page ──
export default function Projects() {
  const { data: projects = [], isLoading } = useProjects();
  const { data: clients = [] } = useActiveClients();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({ name: '', client_id: '', is_internal: false });

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
        await updateProject.mutateAsync({ id: editingProject, updates: { name: formData.name, client_id: formData.client_id, is_internal: formData.is_internal } });
        toast.success("Saved — you're all set.");
      } else {
        await createProject.mutateAsync({ name: formData.name, client_id: formData.client_id, is_internal: formData.is_internal } as any);
        toast.success('Project created successfully.');
      }
      setFormData({ name: '', client_id: '', is_internal: false });
      setEditingProject(null);
      setIsDialogOpen(false);
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  const handleEdit = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setFormData({ name: project.name, client_id: project.client_id, is_internal: project.is_internal });
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
          <p className="text-muted-foreground">Manage projects, roles & rates, and employee assignments</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={() => { setEditingProject(null); setFormData({ name: '', client_id: '', is_internal: false }); }}>
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
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.is_internal}
                  onCheckedChange={(v) => setFormData({ ...formData, is_internal: v })}
                />
                <div>
                  <Label>Internal project</Label>
                  <p className="text-xs text-muted-foreground">Internal projects lock all time entries to non-billable.</p>
                </div>
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

      {/* Project list or detail */}
      {selectedProject ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedProject(null)}>← Back to Projects</Button>
            <h2 className="text-xl font-bold text-foreground">{selectedProject.name}</h2>
            <Badge variant={selectedProject.is_internal ? 'secondary' : 'default'}>{selectedProject.is_internal ? 'Internal' : 'External'}</Badge>
            <span className="text-sm text-muted-foreground">{getClientName(selectedProject.client_id)}</span>
          </div>
          <Tabs defaultValue="roles" className="w-full">
            <TabsList>
              <TabsTrigger value="roles" className="gap-1.5"><Tag className="h-4 w-4" />Roles & Rates</TabsTrigger>
              <TabsTrigger value="assignments" className="gap-1.5"><Users className="h-4 w-4" />Assignments</TabsTrigger>
            </TabsList>
            <TabsContent value="roles" className="mt-4">
              <Card className="card-elevated">
                <CardContent className="pt-6">
                  <ProjectRolesPanel project={selectedProject} />
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="assignments" className="mt-4">
              <Card className="card-elevated">
                <CardContent className="pt-6">
                  <ProjectAssignmentsPanel project={selectedProject} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map(project => (
              <Card key={project.id} className="card-elevated group transition-all duration-200 hover:shadow-lg cursor-pointer" onClick={() => setSelectedProject(project)}>
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
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(project.id); }}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleActive(project.id, project.is_active); }}>{project.is_active ? 'Deactivate' : 'Activate'}</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Badge variant={project.is_active ? 'default' : 'secondary'}>{project.is_active ? 'Active' : 'Inactive'}</Badge>
                    {project.is_internal && <Badge variant="outline">Internal</Badge>}
                  </div>
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
        </>
      )}
    </div>
  );
}
