import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, Plus, Trash2, Loader2, Tag, Users, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import {
  useProject, useProjectAssignments,
} from '@/hooks/useProjects';
import { useProjectRoles, useCreateProjectRole, useUpdateProjectRole, useDeleteProjectRole } from '@/hooks/useProjectRoles';
import { useEmployees } from '@/hooks/useEmployees';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ProjectRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

const STATUS_COLORS: Record<string, string> = {
  active: 'default',
  on_hold: 'secondary',
  completed: 'outline',
};

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/projects')} className="cursor-pointer">Projects</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>{project.name}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/projects')} className="gap-2 shrink-0">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground truncate">{project.name}</h1>
              {project.project_code && (
                <Badge variant="outline" className="font-mono text-xs">{project.project_code}</Badge>
              )}
              <Badge variant={(STATUS_COLORS[project.status] as any) || 'secondary'} className="capitalize">
                {project.status?.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
              {project.manager_name && (
                <span><span className="font-medium text-foreground">Manager:</span> {project.manager_name}</span>
              )}
              {project.area_category && (
                <span className="bg-muted rounded px-1.5 py-0.5 text-xs">{project.area_category}</span>
              )}
              {project.business_unit && (
                <span className="bg-muted rounded px-1.5 py-0.5 text-xs">{project.business_unit}</span>
              )}
              {project.start_date && (
                <span>From {project.start_date}{project.end_date ? ` → ${project.end_date}` : ''}</span>
              )}
            </div>
          </div>
        </div>
        <Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={() => navigate(`/projects/${project.id}/edit`)}>
          <Edit className="h-4 w-4" /> Edit Project
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <LayoutDashboard className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5">
            <Tag className="h-4 w-4" /> Roles & Rates
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-1.5">
            <Users className="h-4 w-4" /> Assignments
          </TabsTrigger>
        </TabsList>

        {/* ── Overview tab ── */}
        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-sm">Project Info</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <InfoRow label="Client" value={project.client_id} />
                <InfoRow label="Status" value={
                  <Badge variant={(STATUS_COLORS[project.status] as any) || 'secondary'} className="capitalize">
                    {project.status?.replace('_', ' ')}
                  </Badge>
                } />
                <InfoRow label="Manager" value={project.manager_name ?? '— Unassigned'} />
                {project.project_code && <InfoRow label="Project Code" value={<code className="text-xs bg-muted px-1.5 py-0.5 rounded">{project.project_code}</code>} />}
                {project.area_category && <InfoRow label="Area Category" value={project.area_category} />}
                {project.business_unit && <InfoRow label="Business Unit" value={project.business_unit} />}
                {project.start_date && <InfoRow label="Start Date" value={project.start_date} />}
                {project.end_date && <InfoRow label="End Date" value={project.end_date} />}
                <InfoRow label="Internal" value={project.is_internal ? 'Yes' : 'No'} />
              </CardContent>
            </Card>

            {/* Referral info */}
            {project.referral_id && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Referral</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoRow label="Type" value={project.referral_type ?? '—'} />
                  <InfoRow
                    label="Value"
                    value={
                      project.referral_value != null
                        ? project.referral_type === 'percentage'
                          ? `${project.referral_value}%`
                          : `$${Number(project.referral_value).toFixed(2)}`
                        : '—'
                    }
                  />
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {project.description && (
              <Card className="sm:col-span-2">
                <CardHeader><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{project.description}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ── Roles & Rates tab ── */}
        <TabsContent value="roles" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <ProjectRolesPanel projectId={project.id} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Assignments tab ── */}
        <TabsContent value="assignments" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <ProjectAssignmentsPanel projectId={project.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

// ── Roles & Rates Panel ──────────────────────────────────────────────────────
function ProjectRolesPanel({ projectId }: { projectId: string }) {
  const { data: roles = [], isLoading } = useProjectRoles(projectId);
  const createRole = useCreateProjectRole();
  const updateRole = useUpdateProjectRole();
  const deleteRole = useDeleteProjectRole();

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<ProjectRole | null>(null);
  const [form, setForm] = useState({ name: '', hourly_rate_usd: 0 });

  const handleAdd = async () => {
    if (!form.name) { toast.error('Please enter a role name.'); return; }
    try {
      await createRole.mutateAsync({ project_id: projectId, name: form.name, hourly_rate_usd: form.hourly_rate_usd });
      toast.success('Role added.');
      setForm({ name: '', hourly_rate_usd: 0 });
      setIsAddOpen(false);
    } catch { toast.error('Something went wrong.'); }
  };

  const handleUpdate = async () => {
    if (!editingRole || !form.name) return;
    try {
      await updateRole.mutateAsync({ id: editingRole.id, updates: { name: form.name, hourly_rate_usd: form.hourly_rate_usd } });
      toast.success('Role saved.');
      setEditingRole(null);
    } catch { toast.error('Something went wrong.'); }
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
          <Plus className="h-4 w-4" /> Add Role
        </Button>
      </div>

      {roles.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No roles defined. Add one to set billing rates.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role Name</TableHead>
              <TableHead className="text-right">Rate (USD/h)</TableHead>
              <TableHead className="text-right w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map(role => (
              <TableRow key={role.id}>
                <TableCell className="font-medium">{role.name}</TableCell>
                <TableCell className="text-right font-semibold text-primary">${Number(role.hourly_rate_usd)}/h</TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setForm({ name: role.name, hourly_rate_usd: Number(role.hourly_rate_usd) }); setEditingRole(role); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(role.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={isAddOpen || !!editingRole} onOpenChange={v => { if (!v) { setIsAddOpen(false); setEditingRole(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingRole ? 'Edit Role' : 'Add Role'}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1">
              <Label>Role name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Senior Developer" />
            </div>
            <div className="space-y-1">
              <Label>Hourly rate (USD)</Label>
              <Input type="number" min="0" step="0.5" value={form.hourly_rate_usd || ''} onChange={e => setForm({ ...form, hourly_rate_usd: parseFloat(e.target.value) || 0 })} />
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

// ── Assignments Panel ────────────────────────────────────────────────────────
function ProjectAssignmentsPanel({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const { data: assignments = [], isLoading } = useProjectAssignments(projectId);
  const { data: roles = [] } = useProjectRoles(projectId);
  const { data: employees = [] } = useEmployees();

  const [employeeSearch, setEmployeeSearch] = useState('');

  const assignedIds = new Set(assignments.map(a => a.user_id));
  const filteredEmployees = employees.filter(
    e => !assignedIds.has(e.user_id) &&
      e.name.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const handleAssign = async (userId: string) => {
    try {
      await api.post('/employee-projects', { user_id: userId, project_id: projectId });
      queryClient.invalidateQueries({ queryKey: ['project-assignments', projectId] });
      queryClient.invalidateQueries({ queryKey: ['assigned-projects'] });
      toast.success('Employee assigned.');
      setEmployeeSearch('');
    } catch { toast.error('Something went wrong.'); }
  };

  const handleUnassign = async (assignmentId: string) => {
    try {
      await api.delete(`/employee-projects/${assignmentId}`);
      queryClient.invalidateQueries({ queryKey: ['project-assignments', projectId] });
      queryClient.invalidateQueries({ queryKey: ['assigned-projects'] });
      toast.success('Employee removed from project.');
    } catch { toast.error('Something went wrong.'); }
  };

  const handleChangeRole = async (assignmentId: string, roleId: string) => {
    try {
      await api.put(`/employee-projects/${assignmentId}`, { role_id: roleId === '__none__' ? null : roleId });
      queryClient.invalidateQueries({ queryKey: ['project-assignments', projectId] });
      queryClient.invalidateQueries({ queryKey: ['assigned-projects'] });
      toast.success('Role updated.');
    } catch { toast.error('Something went wrong.'); }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Add employee</Label>
        <div className="relative max-w-xs">
          <Input
            value={employeeSearch}
            onChange={e => setEmployeeSearch(e.target.value)}
            placeholder="Search by name..."
            className="h-9"
          />
          {employeeSearch && filteredEmployees.length > 0 && (
            <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
              {filteredEmployees.slice(0, 10).map(emp => (
                <button
                  key={emp.id}
                  type="button"
                  className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent text-left gap-2"
                  onClick={() => handleAssign(emp.user_id)}
                >
                  <span className="font-medium">{emp.name}</span>
                  {emp.email && <span className="text-xs text-muted-foreground">{emp.email}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">No employees assigned yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map(a => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.employee_name}</TableCell>
                <TableCell>
                  <Select value={a.role_id || '__none__'} onValueChange={v => handleChangeRole(a.id, v)}>
                    <SelectTrigger className="w-52 h-8">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No role</SelectItem>
                      {roles.map(role => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name} — ${Number(role.hourly_rate_usd)}/h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleUnassign(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
