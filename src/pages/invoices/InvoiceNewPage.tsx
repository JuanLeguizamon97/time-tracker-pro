import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProjects } from '@/hooks/useProjects';
import { useEmployees } from '@/hooks/useEmployees';
import { useCreateInvoice, useCreateInvoiceLines, useLinkTimeEntries, useUpdateInvoice } from '@/hooks/useInvoices';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

export default function InvoiceNewPage() {
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const { data: employees = [] } = useEmployees();

  const createInvoice = useCreateInvoice();
  const createLines = useCreateInvoiceLines();
  const linkTimeEntries = useLinkTimeEntries();
  const updateInvoice = useUpdateInvoice();

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const activeProjects = useMemo(
    () => projects.filter(p => p.is_active && !p.is_internal),
    [projects]
  );

  const handleCreate = async () => {
    if (!selectedProjectId) {
      toast.error('Please select a project.');
      return;
    }
    setIsCreating(true);
    try {
      const invoice = await createInvoice.mutateAsync({ project_id: selectedProjectId });

      const linkedIds = new Set(await api.get<string[]>('/invoice-time-entries/linked-ids'));
      const entries = await api.get<{ id: string; user_id: string; hours: number; billable: boolean; status: string }[]>(
        `/time-entries?project_id=${selectedProjectId}&billable=true&status=normal`
      );
      const availableEntries = entries.filter(e => !linkedIds.has(e.id));

      if (availableEntries.length > 0) {
        const projectRoles = await api.get<{ id: string; name: string; hourly_rate_usd: number }[]>(
          `/project-roles?project_id=${selectedProjectId}`
        );
        const assignments = await api.get<{ user_id: string; role_id: string | null }[]>(
          `/employee-projects?project_id=${selectedProjectId}`
        );
        const assignmentMap = new Map(assignments.map(a => [a.user_id, a.role_id]));
        const rolesMap = new Map(projectRoles.map(r => [r.id, r]));

        const employeeHours: Record<string, { hours: number; userId: string; name: string; entryIds: string[] }> = {};
        availableEntries.forEach(entry => {
          const emp = employees.find(e => e.user_id === entry.user_id);
          if (!employeeHours[entry.user_id]) {
            employeeHours[entry.user_id] = {
              hours: 0,
              userId: entry.user_id,
              name: emp?.name || 'Unknown',
              entryIds: [],
            };
          }
          employeeHours[entry.user_id].hours += Number(entry.hours);
          employeeHours[entry.user_id].entryIds.push(entry.id);
        });

        const lineData = Object.values(employeeHours).map(eh => {
          const roleId = assignmentMap.get(eh.userId);
          const role = roleId ? rolesMap.get(roleId) : null;
          const rate = role ? Number(role.hourly_rate_usd) : 0;
          return {
            invoice_id: invoice.id,
            user_id: eh.userId,
            employee_name: eh.name,
            role_name: role?.name || null,
            hours: eh.hours,
            rate_snapshot: rate,
            amount: eh.hours * rate,
          };
        });

        await createLines.mutateAsync(lineData);
        const timeEntryIds = Object.values(employeeHours).flatMap(eh => eh.entryIds);
        await linkTimeEntries.mutateAsync({ invoice_id: invoice.id, time_entry_ids: timeEntryIds });
        const subtotalVal = lineData.reduce((sum, l) => sum + l.amount, 0);
        await updateInvoice.mutateAsync({ id: invoice.id, updates: { subtotal: subtotalVal, total: subtotalVal } });
      }

      toast.success('Invoice created.');
      navigate(`/invoices/${invoice.id}/edit`);
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong creating the invoice.');
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => navigate('/invoices')} className="cursor-pointer">
              Invoices
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New Invoice</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Invoices
        </Button>
        <h1 className="text-2xl font-bold text-foreground">New Invoice</h1>
      </div>

      {/* Form */}
      <div className="max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Select Project</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Project *</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {activeProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The invoice will be pre-filled with all unlinked billable time entries for this project.
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => navigate('/invoices')}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isCreating || !selectedProjectId}>
                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Invoice
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
