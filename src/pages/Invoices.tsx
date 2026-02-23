import { useState, useMemo } from 'react';
import { Plus, FileText, DollarSign, ChevronRight, Loader2, Edit, Send, CheckCircle, XCircle, Ban, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useInvoices, useCreateInvoice, useUpdateInvoice, useInvoiceLines, useCreateInvoiceLines, useUpdateInvoiceLine, useDeleteInvoiceLine, useLinkTimeEntries } from '@/hooks/useInvoices';
import { useProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { useEmployees } from '@/hooks/useEmployees';
import { useProjectRoles } from '@/hooks/useProjectRoles';
import { Invoice, InvoiceLine, InvoiceStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', color: 'bg-primary/10 text-primary' },
  paid: { label: 'Paid', color: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelled', color: 'bg-destructive/10 text-destructive' },
  voided: { label: 'Voided', color: 'bg-muted text-muted-foreground' },
};

function InvoiceDetailDialog({ invoice, open, onOpenChange }: { invoice: Invoice | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: lines = [], isLoading } = useInvoiceLines(invoice?.id);
  const updateInvoice = useUpdateInvoice();
  const updateLine = useUpdateInvoiceLine();
  const deleteLine = useDeleteInvoiceLine();
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const queryClient = useQueryClient();

  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineHours, setLineHours] = useState(0);

  const project = projects.find(p => p.id === invoice?.project_id);
  const client = project ? clients.find(c => c.id === project.client_id) : null;
  const isEditable = invoice?.status === 'draft' || invoice?.status === 'sent';

  // Fetch project roles for "Update to current rates"
  const { data: projectRoles = [] } = useProjectRoles(invoice?.project_id);

  const subtotal = lines.reduce((sum, l) => sum + Number(l.amount), 0);

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (!invoice) return;
    try {
      const total = subtotal - (invoice.discount || 0);
      await updateInvoice.mutateAsync({ id: invoice.id, updates: { status: newStatus, subtotal, total } });
      toast.success(`Invoice marked as ${STATUS_CONFIG[newStatus].label}.`);
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  const handleSaveNotes = async () => {
    if (!invoice) return;
    try {
      await updateInvoice.mutateAsync({ id: invoice.id, updates: { notes } });
      setEditingNotes(false);
      toast.success("Saved — you're all set.");
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  const handleSaveDiscount = async () => {
    if (!invoice) return;
    try {
      const total = subtotal - discount;
      await updateInvoice.mutateAsync({ id: invoice.id, updates: { discount, subtotal, total } });
      toast.success("Saved — you're all set.");
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  const handleUpdateLineHours = async (lineId: string) => {
    const line = lines.find(l => l.id === lineId);
    if (!line) return;
    try {
      const amount = lineHours * Number(line.rate_snapshot);
      await updateLine.mutateAsync({ id: lineId, updates: { hours: lineHours, amount } });
      setEditingLineId(null);
      const newSubtotal = lines.reduce((sum, l) => sum + (l.id === lineId ? amount : Number(l.amount)), 0);
      await updateInvoice.mutateAsync({ id: invoice!.id, updates: { subtotal: newSubtotal, total: newSubtotal - (invoice!.discount || 0) } });
      toast.success("Saved — you're all set.");
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  const handleRemoveLine = async (lineId: string) => {
    if (!invoice) return;
    try {
      await deleteLine.mutateAsync(lineId);
      const newSubtotal = lines.filter(l => l.id !== lineId).reduce((sum, l) => sum + Number(l.amount), 0);
      await updateInvoice.mutateAsync({ id: invoice.id, updates: { subtotal: newSubtotal, total: newSubtotal - (invoice.discount || 0) } });
      toast.success('Employee line removed.');
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  const handleUpdateToCurrentRates = async () => {
    if (!invoice || !isEditable) return;
    try {
      // For each line, find matching project role and update rate
      const promises: Promise<unknown>[] = [];
      let newSubtotal = 0;

      for (const line of lines) {
        // Try to find the employee's assigned role for this project
        const { data: assignment } = await supabase
          .from('employee_projects')
          .select('role_id')
          .eq('user_id', line.user_id)
          .eq('project_id', invoice.project_id)
          .maybeSingle();

        let newRate = Number(line.rate_snapshot);
        if (assignment?.role_id) {
          const role = projectRoles.find(r => r.id === assignment.role_id);
          if (role) newRate = Number(role.hourly_rate_usd);
        }

        const newAmount = Number(line.hours) * newRate;
        newSubtotal += newAmount;
        promises.push(updateLine.mutateAsync({ id: line.id, updates: { rate_snapshot: newRate, amount: newAmount } }));
      }

      await Promise.all(promises);
      await updateInvoice.mutateAsync({ id: invoice.id, updates: { subtotal: newSubtotal, total: newSubtotal - (invoice.discount || 0) } });
      queryClient.invalidateQueries({ queryKey: ['invoice-lines'] });
      toast.success('Rates updated to current project rates.');
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">Invoice #{invoice.id.slice(0, 8)}</DialogTitle>
              <DialogDescription>{project?.name} · {client?.name || 'No client'}</DialogDescription>
            </div>
            <Badge className={STATUS_CONFIG[invoice.status as InvoiceStatus]?.color}>
              {STATUS_CONFIG[invoice.status as InvoiceStatus]?.label}
            </Badge>
          </div>
        </DialogHeader>

        {/* Employee Lines */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Employee Lines</h3>
            {isEditable && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleUpdateToCurrentRates}>
                <RefreshCw className="h-3.5 w-3.5" />Update to Current Rates
              </Button>
            )}
          </div>
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No employee lines yet. Generate from billable time entries.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="table-header">Employee</TableHead>
                  <TableHead className="table-header">Role</TableHead>
                  <TableHead className="table-header text-right">Hours</TableHead>
                  <TableHead className="table-header text-right">Rate</TableHead>
                  <TableHead className="table-header text-right">Amount</TableHead>
                  {isEditable && <TableHead className="table-header text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map(line => (
                  <TableRow key={line.id}>
                    <TableCell className="font-medium">{line.employee_name}</TableCell>
                    <TableCell className="text-muted-foreground">{line.role_name || '—'}</TableCell>
                    <TableCell className="text-right">
                      {editingLineId === line.id ? (
                        <div className="flex items-center gap-1 justify-end">
                          <Input type="number" min="0" step="0.5" value={lineHours} onChange={(e) => setLineHours(parseFloat(e.target.value) || 0)} className="w-20 h-8 text-right" />
                          <Button size="sm" variant="ghost" onClick={() => handleUpdateLineHours(line.id)}>✓</Button>
                        </div>
                      ) : (
                        <span className={isEditable ? 'cursor-pointer hover:text-primary' : ''} onClick={() => { if (isEditable) { setEditingLineId(line.id); setLineHours(Number(line.hours)); } }}>{Number(line.hours)}h</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">${Number(line.rate_snapshot)}/h</TableCell>
                    <TableCell className="text-right font-semibold text-primary">${Number(line.amount).toLocaleString()}</TableCell>
                    {isEditable && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRemoveLine(line.id)}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Totals */}
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">${subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-muted-foreground">Discount</span>
            {isEditable ? (
              <div className="flex items-center gap-2">
                <Input type="number" min="0" step="0.01" value={discount || invoice.discount || ''} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="w-28 h-8 text-right" />
                <Button size="sm" variant="outline" onClick={handleSaveDiscount}>Save</Button>
              </div>
            ) : (
              <span className="font-medium">-${Number(invoice.discount).toLocaleString()}</span>
            )}
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2">
            <span>Total</span>
            <span className="text-primary">${(subtotal - (discount || Number(invoice.discount))).toLocaleString()}</span>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Notes</Label>
            {isEditable && !editingNotes && (
              <Button variant="ghost" size="sm" onClick={() => { setNotes(invoice.notes || ''); setEditingNotes(true); }}>
                <Edit className="h-3 w-3 mr-1" />Edit
              </Button>
            )}
          </div>
          {editingNotes ? (
            <div className="space-y-2">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes to this invoice..." rows={3} />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditingNotes(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveNotes}>Save</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{invoice.notes || 'No notes'}</p>
          )}
        </div>

        {/* Status Actions */}
        {isEditable && (
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {invoice.status === 'draft' && (
              <>
                <Button variant="outline" className="gap-2" onClick={() => handleStatusChange('sent')}>
                  <Send className="h-4 w-4" />Mark as Sent
                </Button>
                <Button variant="outline" className="gap-2 text-destructive" onClick={() => handleStatusChange('cancelled')}>
                  <Ban className="h-4 w-4" />Cancel
                </Button>
              </>
            )}
            {invoice.status === 'sent' && (
              <>
                <Button className="gap-2" onClick={() => handleStatusChange('paid')}>
                  <CheckCircle className="h-4 w-4" />Mark as Paid
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => handleStatusChange('voided')}>
                  <XCircle className="h-4 w-4" />Void
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Invoices() {
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: employees = [] } = useEmployees();
  const createInvoice = useCreateInvoice();
  const createLines = useCreateInvoiceLines();
  const linkTimeEntries = useLinkTimeEntries();
  const updateInvoice = useUpdateInvoice();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const activeProjects = projects.filter(p => p.is_active && !p.is_internal);

  const filteredInvoices = statusFilter === 'all' ? invoices : invoices.filter(inv => inv.status === statusFilter);

  const getProjectName = (projectId: string) => projects.find(p => p.id === projectId)?.name || 'Unknown';
  const getClientName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project ? clients.find(c => c.id === project.client_id)?.name || 'No client' : 'No client';
  };

  const handleCreateInvoice = async () => {
    if (!selectedProjectId) { toast.error('Please select a project.'); return; }
    try {
      const invoice = await createInvoice.mutateAsync({ project_id: selectedProjectId });

      // Find billable, normal time entries not already invoiced
      const { data: existingLinked } = await supabase.from('invoice_time_entries').select('time_entry_id');
      const linkedIds = new Set((existingLinked || []).map(e => e.time_entry_id));

      const { data: entries } = await supabase
        .from('time_entries')
        .select('*')
        .eq('project_id', selectedProjectId)
        .eq('billable', true)
        .eq('status', 'normal');

      const availableEntries = (entries || []).filter(e => !linkedIds.has(e.id));

      if (availableEntries.length === 0) {
        toast.success('Invoice created (no billable entries to add yet).');
        setIsCreateOpen(false);
        setSelectedProjectId('');
        return;
      }

      // Get project roles and employee assignments for rate lookup
      const { data: projectRoles } = await supabase
        .from('project_roles')
        .select('*')
        .eq('project_id', selectedProjectId);

      const { data: assignments } = await supabase
        .from('employee_projects')
        .select('user_id, role_id')
        .eq('project_id', selectedProjectId);

      const assignmentMap = new Map((assignments || []).map(a => [a.user_id, a.role_id]));
      const rolesMap = new Map((projectRoles || []).map(r => [r.id, r]));

      // Aggregate by employee
      const employeeHours: Record<string, { hours: number; userId: string; name: string; entryIds: string[] }> = {};
      availableEntries.forEach(entry => {
        const emp = employees.find(e => e.user_id === entry.user_id);
        const key = entry.user_id;
        if (!employeeHours[key]) {
          employeeHours[key] = { hours: 0, userId: entry.user_id, name: emp?.name || 'Unknown', entryIds: [] };
        }
        employeeHours[key].hours += Number(entry.hours);
        employeeHours[key].entryIds.push(entry.id);
      });

      // Create lines using project role rates
      const lines = Object.values(employeeHours).map(eh => {
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

      await createLines.mutateAsync(lines);

      // Link time entries
      const links = Object.values(employeeHours).flatMap(eh =>
        eh.entryIds.map(id => ({ invoice_id: invoice.id, time_entry_id: id }))
      );
      await linkTimeEntries.mutateAsync(links);

      // Update totals
      const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
      await updateInvoice.mutateAsync({ id: invoice.id, updates: { subtotal, total: subtotal } });

      toast.success(`Invoice created with ${availableEntries.length} entries.`);
      setIsCreateOpen(false);
      setSelectedProjectId('');
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong creating the invoice.');
    }
  };

  const stats = useMemo(() => {
    const draft = invoices.filter(i => i.status === 'draft').length;
    const unpaid = invoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + Number(i.total), 0);
    const paid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.total), 0);
    return { draft, unpaid, paid };
  }, [invoices]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground">Create and manage project invoices</p>
        </div>
        <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />New Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted"><FileText className="h-6 w-6 text-muted-foreground" /></div>
              <div><p className="text-sm text-muted-foreground">Drafts</p><p className="text-2xl font-bold text-foreground">{stats.draft}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10"><DollarSign className="h-6 w-6 text-warning" /></div>
              <div><p className="text-sm text-muted-foreground">Unpaid</p><p className="text-2xl font-bold text-foreground">${stats.unpaid.toLocaleString()}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10"><CheckCircle className="h-6 w-6 text-success" /></div>
              <div><p className="text-sm text-muted-foreground">Collected</p><p className="text-2xl font-bold text-foreground">${stats.paid.toLocaleString()}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Label className="text-sm text-muted-foreground">Status:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoice List */}
      <Card className="card-elevated">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="table-header">Invoice</TableHead>
                <TableHead className="table-header">Project</TableHead>
                <TableHead className="table-header">Client</TableHead>
                <TableHead className="table-header">Status</TableHead>
                <TableHead className="table-header text-right">Total</TableHead>
                <TableHead className="table-header text-right">Date</TableHead>
                <TableHead className="table-header text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map(invoice => (
                <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/30 transition-colors duration-150" onClick={() => { setSelectedInvoice(invoice); setIsDetailOpen(true); }}>
                  <TableCell className="font-medium">#{invoice.id.slice(0, 8)}</TableCell>
                  <TableCell>{getProjectName(invoice.project_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{getClientName(invoice.project_id)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_CONFIG[invoice.status as InvoiceStatus]?.color}>
                      {STATUS_CONFIG[invoice.status as InvoiceStatus]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary">${Number(invoice.total).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{format(new Date(invoice.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedInvoice(invoice); setIsDetailOpen(true); }}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredInvoices.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No invoices yet. Create one to get started!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>Select a project to generate an invoice from its billable time entries. Rates are pulled from project roles.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Project *</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>
                  {activeProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Only billable time entries will be included. Internal projects are excluded.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateInvoice} disabled={createInvoice.isPending}>
              {createInvoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <InvoiceDetailDialog invoice={selectedInvoice} open={isDetailOpen} onOpenChange={setIsDetailOpen} />
    </div>
  );
}
