import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProject, usePatchProject, useProjectCategories, useAdminEmployees } from '@/hooks/useProjects';
import { useActiveClients } from '@/hooks/useClients';
import { useEmployees } from '@/hooks/useEmployees';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchableCombobox } from '@/components/ui/SearchableCombobox';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

export default function ProjectEditPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const patchProject = usePatchProject();

  const { data: project, isLoading } = useProject(projectId);
  const { data: clients = [] } = useActiveClients();
  const { data: areaCategories = [] } = useProjectCategories('area_category');
  const { data: businessUnits = [] } = useProjectCategories('business_unit');
  const { data: adminEmployees = [] } = useAdminEmployees();
  const { data: allEmployees = [] } = useEmployees();

  const [initialized, setInitialized] = useState(false);
  const [name, setName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [clientId, setClientId] = useState('');
  const [areaCategory, setAreaCategory] = useState('');
  const [businessUnit, setBusinessUnit] = useState('');
  const [managerId, setManagerId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('active');
  const [isInternal, setIsInternal] = useState(false);
  const [referralId, setReferralId] = useState('');
  const [referralType, setReferralType] = useState('percentage');
  const [referralValue, setReferralValue] = useState('');
  const [description, setDescription] = useState('');

  // Initialize from server data once
  if (project && !initialized) {
    setName(project.name || '');
    setProjectCode(project.project_code || '');
    setClientId(project.client_id || '');
    setAreaCategory(project.area_category || '');
    setBusinessUnit(project.business_unit || '');
    setManagerId(project.manager_id || '');
    setStartDate(project.start_date || '');
    setEndDate(project.end_date || '');
    setStatus(project.status || 'active');
    setIsInternal(project.is_internal || false);
    setReferralId(project.referral_id || '');
    setReferralType(project.referral_type || 'percentage');
    setReferralValue(project.referral_value != null ? String(project.referral_value) : '');
    setDescription(project.description || '');
    setInitialized(true);
  }

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Project name is required.'); return; }
    if (!clientId) { toast.error('Client is required.'); return; }
    if (!projectId) return;
    try {
      await patchProject.mutateAsync({
        id: projectId,
        updates: {
          name,
          client_id: clientId,
          project_code: projectCode || undefined,
          area_category: areaCategory || undefined,
          business_unit: businessUnit || undefined,
          manager_id: managerId || undefined,
          start_date: startDate || undefined,
          end_date: endDate || undefined,
          status,
          is_internal: isInternal,
          referral_id: referralId || undefined,
          referral_type: referralId ? referralType : undefined,
          referral_value: referralId && referralValue ? parseFloat(referralValue) : undefined,
          description: description || undefined,
        },
      });
      toast.success('Project saved.');
      navigate(`/projects/${projectId}`);
    } catch {
      toast.error('Something went wrong. Please try again.');
    }
  };

  if (isLoading || !project) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const clientOptions = clients.map(c => ({ id: c.id, label: c.name }));
  const areaOptions = areaCategories.map(c => ({ id: c.value, label: c.value }));
  const buOptions = businessUnits.map(c => ({ id: c.value, label: c.value }));
  const managerOptions = adminEmployees.map(e => ({ id: e.id, label: e.name, sublabel: e.email }));
  const referralOptions = allEmployees.map(e => ({ id: e.id, label: e.name }));

  return (
    <div className="space-y-6 pb-12 max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/projects')} className="cursor-pointer">Projects</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate(`/projects/${projectId}`)} className="cursor-pointer">{project.name}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>Edit</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${projectId}`)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="text-xl font-bold text-foreground">Edit: {project.name}</h1>
        </div>
        <Button onClick={handleSave} disabled={patchProject.isPending} className="gap-2">
          {patchProject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Project Name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Project ID Code</Label>
              <Input value={projectCode} onChange={e => setProjectCode(e.target.value)} placeholder="e.g. IPC-2026-001" />
            </div>
            <div className="space-y-1">
              <Label>Client *</Label>
              <SearchableCombobox options={clientOptions} value={clientId || null} onChange={v => setClientId(v ?? '')} placeholder="Select client..." />
            </div>
            <div className="space-y-1">
              <Label>Area Category</Label>
              <SearchableCombobox options={areaOptions} value={areaCategory || null} onChange={v => setAreaCategory(v ?? '')} placeholder="Select category..." clearable />
            </div>
            <div className="space-y-1">
              <Label>Business Unit</Label>
              <SearchableCombobox options={buOptions} value={businessUnit || null} onChange={v => setBusinessUnit(v ?? '')} placeholder="Select unit..." clearable />
            </div>
            <div className="space-y-1">
              <Label>Project Manager</Label>
              <SearchableCombobox options={managerOptions} value={managerId || null} onChange={v => setManagerId(v ?? '')} placeholder="Select manager..." clearable />
            </div>
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Referral</Label>
              <SearchableCombobox options={referralOptions} value={referralId || null} onChange={v => setReferralId(v ?? '')} placeholder="Select referral..." clearable />
            </div>
          </div>

          {referralId && (
            <div className="grid gap-4 sm:grid-cols-2 border rounded-md p-3 bg-muted/30">
              <div className="space-y-1">
                <Label>Referral Type</Label>
                <Select value={referralType} onValueChange={setReferralType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Referral Value</Label>
                <Input type="number" min="0" step="0.01" value={referralValue} onChange={e => setReferralValue(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Switch checked={isInternal} onCheckedChange={setIsInternal} />
            <div>
              <Label>Internal project</Label>
              <p className="text-xs text-muted-foreground">Locks all time entries to non-billable.</p>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="resize-none text-sm" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
