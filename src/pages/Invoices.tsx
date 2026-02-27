import { useState, useMemo, useRef } from 'react';
import { Plus, FileText, DollarSign, ChevronRight, Loader2, Edit, Send, CheckCircle, XCircle, Ban, RefreshCw, Calculator, Upload, Trash2, Paperclip, UserPlus, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { useInvoices, useCreateInvoice, useUpdateInvoice, useInvoiceLines, useCreateInvoiceLines, useUpdateInvoiceLine, useDeleteInvoiceLine, useLinkTimeEntries } from '@/hooks/useInvoices';
import { useInvoiceManualLines, useCreateInvoiceManualLine, useUpdateInvoiceManualLine, useDeleteInvoiceManualLine, useInvoiceFees, useCreateInvoiceFee, useUpdateInvoiceFee, useDeleteInvoiceFee, useCreateFeeAttachment, useDeleteFeeAttachment } from '@/hooks/useInvoiceExtras';
import { useProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { useEmployees } from '@/hooks/useEmployees';
import { useProjectRoles, useUpdateProjectRole } from '@/hooks/useProjectRoles';
import { Invoice, InvoiceLine, InvoiceStatus, InvoiceManualLine, InvoiceFee, InvoiceFeeAttachment } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', color: 'bg-primary/10 text-primary' },
  paid: { label: 'Paid', color: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelled', color: 'bg-destructive/10 text-destructive' },
  voided: { label: 'Voided', color: 'bg-muted text-muted-foreground' },
};

// ── Fee Attachments sub-component ──
function FeeAttachments({ feeId, isEditable }: { feeId: string; isEditable: boolean }) {
  const { data: attachments = [] } = useQuery({
    queryKey: ['invoice-fee-attachments', feeId],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoice_fee_attachments').select('*').eq('fee_id', feeId);
      if (error) throw error;
      return data as InvoiceFeeAttachment[];
    },
  });
  const createAttachment = useCreateFeeAttachment();
  const deleteAttachment = useDeleteFeeAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const filePath = `${feeId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('invoice-attachments').upload(filePath, file);
    if (uploadError) { toast.error('Failed to upload file.'); return; }
    const { data: urlData } = supabase.storage.from('invoice-attachments').getPublicUrl(filePath);
    await createAttachment.mutateAsync({ fee_id: feeId, file_name: file.name, file_url: urlData.publicUrl, file_size: file.size });
    toast.success('File uploaded.');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="mt-1 space-y-1">
      {attachments.map(att => (
        <div key={att.id} className="flex items-center gap-2 text-xs">
          <Paperclip className="h-3 w-3 text-muted-foreground" />
          <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[200px]">{att.file_name}</a>
          {isEditable && (
            <Button variant="ghost" size="sm" className="h-5 px-1 text-destructive" onClick={() => deleteAttachment.mutateAsync({ id: att.id, fileUrl: att.file_url })}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      ))}
      {isEditable && (
        <>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1 text-muted-foreground" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3 w-3" /> Attach file
          </Button>
        </>
      )}
    </div>
  );
}

// ── Invoice Detail Dialog ──
function InvoiceDetailDialog({ invoice, open, onOpenChange }: { invoice: Invoice | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: lines = [], isLoading } = useInvoiceLines(invoice?.id);
  const { data: manualLines = [] } = useInvoiceManualLines(invoice?.id);
  const { data: fees = [] } = useInvoiceFees(invoice?.id);
  const updateInvoice = useUpdateInvoice();
  const updateLine = useUpdateInvoiceLine();
  const deleteLine = useDeleteInvoiceLine();
  const updateProjectRole = useUpdateProjectRole();
  const createManualLine = useCreateInvoiceManualLine();
  const updateManualLine = useUpdateInvoiceManualLine();
  const deleteManualLine = useDeleteInvoiceManualLine();
  const createFee = useCreateInvoiceFee();
  const updateFee = useUpdateInvoiceFee();
  const deleteFee = useDeleteInvoiceFee();
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: allInvoices = [] } = useInvoices();
  const queryClient = useQueryClient();

  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineHours, setLineHours] = useState(0);
  const [editingRateLineId, setEditingRateLineId] = useState<string | null>(null);
  const [lineRate, setLineRate] = useState(0);

  // Invoice metadata editing
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({ invoice_number: '', issue_date: '', due_date: '' });

  // Manual line form
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ person_name: '', hours: 0, rate_usd: 0, description: '' });

  // Fee form
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [feeForm, setFeeForm] = useState({ label: '', quantity: 1, unit_price_usd: 0, description: '' });

  const project = projects.find(p => p.id === invoice?.project_id);
  const client = project ? clients.find(c => c.id === project.client_id) : null;
  const isEditable = invoice?.status === 'draft' || invoice?.status === 'sent';

  const { data: projectRoles = [] } = useProjectRoles(invoice?.project_id);

  const billedSubtotal = lines.reduce((sum, l) => sum + Number(l.amount), 0);
  const manualSubtotal = manualLines.reduce((sum, l) => sum + Number(l.line_total), 0);
  const feesSubtotal = fees.reduce((sum, f) => sum + Number(f.fee_total), 0);
  const grandSubtotal = billedSubtotal + manualSubtotal + feesSubtotal;
  const discountVal = discount || Number(invoice?.discount || 0);
  const grandTotal = grandSubtotal - discountVal;

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (!invoice) return;
    try {
      await updateInvoice.mutateAsync({ id: invoice.id, updates: { status: newStatus, subtotal: grandSubtotal, total: grandTotal } });
      toast.success(`Invoice marked as ${STATUS_CONFIG[newStatus].label}.`);
    } catch { toast.error('Something went wrong. Please try again.'); }
  };

  const handleSaveNotes = async () => {
    if (!invoice) return;
    try {
      await updateInvoice.mutateAsync({ id: invoice.id, updates: { notes } });
      setEditingNotes(false);
      toast.success("Saved.");
    } catch { toast.error('Something went wrong.'); }
  };

  const handleSaveDiscount = async () => {
    if (!invoice) return;
    try {
      await updateInvoice.mutateAsync({ id: invoice.id, updates: { discount, subtotal: grandSubtotal, total: grandSubtotal - discount } });
      toast.success("Saved.");
    } catch { toast.error('Something went wrong.'); }
  };

  const handleSaveMeta = async () => {
    if (!invoice) return;
    try {
      await updateInvoice.mutateAsync({
        id: invoice.id,
        updates: {
          invoice_number: metaForm.invoice_number || null,
          issue_date: metaForm.issue_date || null,
          due_date: metaForm.due_date || null,
        } as any,
      });
      setEditingMeta(false);
      toast.success("Invoice details saved.");
    } catch { toast.error('Something went wrong.'); }
  };

  const handleUpdateLineHours = async (lineId: string) => {
    const line = lines.find(l => l.id === lineId);
    if (!line) return;
    try {
      const amount = lineHours * Number(line.rate_snapshot);
      await updateLine.mutateAsync({ id: lineId, updates: { hours: lineHours, amount } });
      setEditingLineId(null);
      await syncTotals();
      toast.success("Saved.");
    } catch { toast.error('Something went wrong.'); }
  };

  const handleUpdateLineRate = async (lineId: string) => {
    const line = lines.find(l => l.id === lineId);
    if (!line || !invoice) return;
    try {
      const matchingRole = projectRoles.find(r => r.name === line.role_name);
      if (matchingRole) {
        await updateProjectRole.mutateAsync({ id: matchingRole.id, updates: { hourly_rate_usd: lineRate } });
      }
      const newAmount = Number(line.hours) * lineRate;
      await updateLine.mutateAsync({ id: lineId, updates: { rate_snapshot: lineRate, amount: newAmount } });
      setEditingRateLineId(null);
      await syncTotals();
      toast.success('Rate updated. Project role rate has been updated too.');
    } catch { toast.error('Something went wrong.'); }
  };

  const handleRemoveLine = async (lineId: string) => {
    if (!invoice) return;
    try {
      await deleteLine.mutateAsync(lineId);
      await syncTotals();
      toast.success('Line removed.');
    } catch { toast.error('Something went wrong.'); }
  };

  const handleAddManualLine = async () => {
    if (!invoice || !manualForm.person_name) return;
    try {
      const lineTotal = manualForm.hours * manualForm.rate_usd;
      await createManualLine.mutateAsync({
        invoice_id: invoice.id,
        person_name: manualForm.person_name,
        hours: manualForm.hours,
        rate_usd: manualForm.rate_usd,
        description: manualForm.description || null,
        line_total: lineTotal,
      });
      setManualForm({ person_name: '', hours: 0, rate_usd: 0, description: '' });
      setShowManualForm(false);
      await syncTotals();
      toast.success('Manual line added.');
    } catch { toast.error('Something went wrong.'); }
  };

  const handleDeleteManualLine = async (id: string) => {
    try {
      await deleteManualLine.mutateAsync(id);
      await syncTotals();
      toast.success('Manual line removed.');
    } catch { toast.error('Something went wrong.'); }
  };

  const handleAddFee = async () => {
    if (!invoice || !feeForm.label) return;
    try {
      const feeTotal = feeForm.quantity * feeForm.unit_price_usd;
      await createFee.mutateAsync({
        invoice_id: invoice.id,
        label: feeForm.label,
        quantity: feeForm.quantity,
        unit_price_usd: feeForm.unit_price_usd,
        description: feeForm.description || null,
        fee_total: feeTotal,
      });
      setFeeForm({ label: '', quantity: 1, unit_price_usd: 0, description: '' });
      setShowFeeForm(false);
      await syncTotals();
      toast.success('Fee added.');
    } catch { toast.error('Something went wrong.'); }
  };

  const handleDeleteFee = async (id: string) => {
    try {
      await deleteFee.mutateAsync(id);
      await syncTotals();
      toast.success('Fee removed.');
    } catch { toast.error('Something went wrong.'); }
  };

  const syncTotals = async () => {
    if (!invoice) return;
    // Refetch to get latest
    queryClient.invalidateQueries({ queryKey: ['invoice-lines'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-manual-lines'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-fees'] });
    // Update totals using current known values (will be slightly stale but close enough)
    const newSubtotal = billedSubtotal + manualSubtotal + feesSubtotal;
    await updateInvoice.mutateAsync({ id: invoice.id, updates: { subtotal: newSubtotal, total: newSubtotal - discountVal } });
  };

  const handleUpdateToCurrentRates = async () => {
    if (!invoice || !isEditable) return;
    try {
      let newBilledSubtotal = 0;
      for (const line of lines) {
        const { data: assignment } = await supabase
          .from('employee_projects').select('role_id').eq('user_id', line.user_id).eq('project_id', invoice.project_id).maybeSingle();
        let newRate = Number(line.rate_snapshot);
        if (assignment?.role_id) {
          const role = projectRoles.find(r => r.id === assignment.role_id);
          if (role) newRate = Number(role.hourly_rate_usd);
        }
        const newAmount = Number(line.hours) * newRate;
        newBilledSubtotal += newAmount;
        await updateLine.mutateAsync({ id: line.id, updates: { rate_snapshot: newRate, amount: newAmount, role_name: projectRoles.find(r => r.id === assignment?.role_id)?.name || line.role_name } });
      }
      const total = newBilledSubtotal + manualSubtotal + feesSubtotal - discountVal;
      await updateInvoice.mutateAsync({ id: invoice.id, updates: { subtotal: newBilledSubtotal + manualSubtotal + feesSubtotal, total } });
      queryClient.invalidateQueries({ queryKey: ['invoice-lines'] });
      toast.success('Rates updated to current project rates.');
    } catch { toast.error('Something went wrong.'); }
  };

  const handleRecalcAllUnpaid = async () => {
    if (!invoice) return;
    try {
      const unpaid = allInvoices.filter(i => i.project_id === invoice.project_id && (i.status === 'draft' || i.status === 'sent'));
      let count = 0;
      for (const inv of unpaid) {
        const { data: invLines } = await supabase.from('invoice_lines').select('*').eq('invoice_id', inv.id);
        if (!invLines?.length) continue;
        let sub = 0;
        for (const line of invLines) {
          const { data: assignment } = await supabase.from('employee_projects').select('role_id').eq('user_id', line.user_id).eq('project_id', inv.project_id).maybeSingle();
          let r = Number(line.rate_snapshot);
          if (assignment?.role_id) { const role = projectRoles.find(pr => pr.id === assignment.role_id); if (role) r = Number(role.hourly_rate_usd); }
          const a = Number(line.hours) * r;
          sub += a;
          await supabase.from('invoice_lines').update({ rate_snapshot: r, amount: a }).eq('id', line.id);
        }
        await supabase.from('invoices').update({ subtotal: sub, total: sub - Number(inv.discount) }).eq('id', inv.id);
        count++;
      }
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-lines'] });
      toast.success(`Recalculated ${count} unpaid invoice${count !== 1 ? 's' : ''}.`);
    } catch { toast.error('Something went wrong.'); }
  };

  const handleRecalcLatestUnpaid = async () => {
    if (!invoice) return;
    try {
      const unpaid = allInvoices.filter(i => i.project_id === invoice.project_id && (i.status === 'draft' || i.status === 'sent')).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      if (!unpaid.length) { toast.info('No unpaid invoices.'); return; }
      const latest = unpaid[0];
      const { data: invLines } = await supabase.from('invoice_lines').select('*').eq('invoice_id', latest.id);
      if (!invLines?.length) { toast.info('No lines.'); return; }
      let sub = 0;
      for (const line of invLines) {
        const { data: assignment } = await supabase.from('employee_projects').select('role_id').eq('user_id', line.user_id).eq('project_id', latest.project_id).maybeSingle();
        let r = Number(line.rate_snapshot);
        if (assignment?.role_id) { const role = projectRoles.find(pr => pr.id === assignment.role_id); if (role) r = Number(role.hourly_rate_usd); }
        const a = Number(line.hours) * r;
        sub += a;
        await supabase.from('invoice_lines').update({ rate_snapshot: r, amount: a }).eq('id', line.id);
      }
      await supabase.from('invoices').update({ subtotal: sub, total: sub - Number(latest.discount) }).eq('id', latest.id);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-lines'] });
      toast.success('Recalculated latest unpaid invoice.');
    } catch { toast.error('Something went wrong.'); }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">Invoice {invoice.invoice_number ? `#${invoice.invoice_number}` : `#${invoice.id.slice(0, 8)}`}</DialogTitle>
              <DialogDescription>{project?.name} · {client?.name || 'No client'}</DialogDescription>
              {client?.manager_name && (
                <p className="text-xs text-muted-foreground mt-1">Attn: {client.manager_name}{client.manager_email ? ` · ${client.manager_email}` : ''}</p>
              )}
            </div>
            <Badge className={STATUS_CONFIG[invoice.status as InvoiceStatus]?.color}>
              {STATUS_CONFIG[invoice.status as InvoiceStatus]?.label}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details" className="text-xs">Details</TabsTrigger>
            <TabsTrigger value="billed" className="text-xs">Billed Time</TabsTrigger>
            <TabsTrigger value="manual" className="text-xs">Manual People</TabsTrigger>
            <TabsTrigger value="fees" className="text-xs">Fees</TabsTrigger>
            <TabsTrigger value="summary" className="text-xs">Summary</TabsTrigger>
          </TabsList>

          {/* ── Invoice Details Tab ── */}
          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label className="text-xs text-muted-foreground">Invoice Number</Label>
                {editingMeta ? (
                  <Input value={metaForm.invoice_number} onChange={(e) => setMetaForm({ ...metaForm, invoice_number: e.target.value })} placeholder="INV-001" className="h-8 mt-1" />
                ) : (
                  <p className="text-sm font-medium mt-1">{invoice.invoice_number || '—'}</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Issue Date</Label>
                {editingMeta ? (
                  <Input type="date" value={metaForm.issue_date} onChange={(e) => setMetaForm({ ...metaForm, issue_date: e.target.value })} className="h-8 mt-1" />
                ) : (
                  <p className="text-sm font-medium mt-1">{invoice.issue_date ? format(new Date(invoice.issue_date), 'MMM d, yyyy') : '—'}</p>
                )}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Due Date</Label>
                {editingMeta ? (
                  <Input type="date" value={metaForm.due_date} onChange={(e) => setMetaForm({ ...metaForm, due_date: e.target.value })} className="h-8 mt-1" />
                ) : (
                  <p className="text-sm font-medium mt-1">{invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : '—'}</p>
                )}
              </div>
            </div>
            {isEditable && (
              editingMeta ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveMeta}>Save Details</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingMeta(false)}>Cancel</Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setMetaForm({ invoice_number: invoice.invoice_number || '', issue_date: invoice.issue_date || '', due_date: invoice.due_date || '' }); setEditingMeta(true); }}>
                  <Edit className="h-3.5 w-3.5" /> Edit Details
                </Button>
              )
            )}

            {/* Notes */}
            <div className="space-y-2 border-t pt-4">
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
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes..." rows={3} />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditingNotes(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveNotes}>Save</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{invoice.notes || 'No notes'}</p>
              )}
            </div>
          </TabsContent>

          {/* ── Billed Time Tab ── */}
          <TabsContent value="billed" className="space-y-4 mt-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold text-foreground">Employee Lines (from time entries)</h3>
              {isEditable && (
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleUpdateToCurrentRates}>
                    <RefreshCw className="h-3.5 w-3.5" />Update to Current Rates
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs"><Calculator className="h-3.5 w-3.5" />Recalculate</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleRecalcAllUnpaid}>All unpaid invoices for this project</DropdownMenuItem>
                      <DropdownMenuItem onClick={handleRecalcLatestUnpaid}>Latest unpaid invoice for this project</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
            {isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : lines.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No billed time entries yet.</p>
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
                      <TableCell className="text-right">
                        {editingRateLineId === line.id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <Input type="number" min="0" step="0.5" value={lineRate} onChange={(e) => setLineRate(parseFloat(e.target.value) || 0)} className="w-20 h-8 text-right" />
                            <Button size="sm" variant="ghost" onClick={() => handleUpdateLineRate(line.id)}>✓</Button>
                          </div>
                        ) : (
                          <span className={isEditable ? 'cursor-pointer hover:text-primary' : ''} onClick={() => { if (isEditable) { setEditingRateLineId(line.id); setLineRate(Number(line.rate_snapshot)); } }}>${Number(line.rate_snapshot)}/h</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">${Number(line.amount).toLocaleString()}</TableCell>
                      {isEditable && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRemoveLine(line.id)}><XCircle className="h-4 w-4" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="text-sm text-right text-muted-foreground">Billed Time Subtotal: <span className="font-semibold text-foreground">${billedSubtotal.toLocaleString()}</span></p>
          </TabsContent>

          {/* ── Manual People Tab ── */}
          <TabsContent value="manual" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Manual People Lines</h3>
              {isEditable && (
                <Button size="sm" className="gap-1.5" onClick={() => setShowManualForm(true)}>
                  <UserPlus className="h-4 w-4" />Add Person
                </Button>
              )}
            </div>

            {manualLines.length === 0 && !showManualForm ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No manual lines. Add people who aren't tied to time entries.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="table-header">Person</TableHead>
                    <TableHead className="table-header">Description</TableHead>
                    <TableHead className="table-header text-right">Hours</TableHead>
                    <TableHead className="table-header text-right">Rate</TableHead>
                    <TableHead className="table-header text-right">Amount</TableHead>
                    {isEditable && <TableHead className="table-header text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualLines.map(ml => (
                    <TableRow key={ml.id}>
                      <TableCell className="font-medium">{ml.person_name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{ml.description || '—'}</TableCell>
                      <TableCell className="text-right">{Number(ml.hours)}h</TableCell>
                      <TableCell className="text-right">${Number(ml.rate_usd)}/h</TableCell>
                      <TableCell className="text-right font-semibold text-primary">${Number(ml.line_total).toLocaleString()}</TableCell>
                      {isEditable && (
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteManualLine(ml.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {showManualForm && (
              <Card className="p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label className="text-xs">Person Name *</Label><Input value={manualForm.person_name} onChange={(e) => setManualForm({ ...manualForm, person_name: e.target.value })} placeholder="Jane Doe" className="h-8 mt-1" /></div>
                  <div><Label className="text-xs">Description</Label><Input value={manualForm.description} onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })} placeholder="Consulting" className="h-8 mt-1" /></div>
                  <div><Label className="text-xs">Hours</Label><Input type="number" min="0" step="0.5" value={manualForm.hours || ''} onChange={(e) => setManualForm({ ...manualForm, hours: parseFloat(e.target.value) || 0 })} className="h-8 mt-1" /></div>
                  <div><Label className="text-xs">Rate (USD/h)</Label><Input type="number" min="0" step="0.5" value={manualForm.rate_usd || ''} onChange={(e) => setManualForm({ ...manualForm, rate_usd: parseFloat(e.target.value) || 0 })} className="h-8 mt-1" /></div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setShowManualForm(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleAddManualLine}>Add Line (${(manualForm.hours * manualForm.rate_usd).toFixed(2)})</Button>
                </div>
              </Card>
            )}
            <p className="text-sm text-right text-muted-foreground">Manual People Subtotal: <span className="font-semibold text-foreground">${manualSubtotal.toLocaleString()}</span></p>
          </TabsContent>

          {/* ── Fees Tab ── */}
          <TabsContent value="fees" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Additional Fees & Attachments</h3>
              {isEditable && (
                <Button size="sm" className="gap-1.5" onClick={() => setShowFeeForm(true)}>
                  <Receipt className="h-4 w-4" />Add Fee
                </Button>
              )}
            </div>

            {fees.length === 0 && !showFeeForm ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No additional fees. Add software licenses, travel, etc.</p>
            ) : (
              <div className="space-y-3">
                {fees.map(fee => (
                  <Card key={fee.id} className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{fee.label}</p>
                        {fee.description && <p className="text-xs text-muted-foreground">{fee.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{Number(fee.quantity)} × ${Number(fee.unit_price_usd)} = <span className="font-semibold text-primary">${Number(fee.fee_total).toLocaleString()}</span></p>
                        <FeeAttachments feeId={fee.id} isEditable={isEditable} />
                      </div>
                      {isEditable && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteFee(fee.id)}><Trash2 className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {showFeeForm && (
              <Card className="p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label className="text-xs">Label *</Label><Input value={feeForm.label} onChange={(e) => setFeeForm({ ...feeForm, label: e.target.value })} placeholder="Software license" className="h-8 mt-1" /></div>
                  <div><Label className="text-xs">Description</Label><Input value={feeForm.description} onChange={(e) => setFeeForm({ ...feeForm, description: e.target.value })} placeholder="Annual subscription" className="h-8 mt-1" /></div>
                  <div><Label className="text-xs">Quantity</Label><Input type="number" min="1" value={feeForm.quantity || ''} onChange={(e) => setFeeForm({ ...feeForm, quantity: parseInt(e.target.value) || 1 })} className="h-8 mt-1" /></div>
                  <div><Label className="text-xs">Unit Price (USD)</Label><Input type="number" min="0" step="0.01" value={feeForm.unit_price_usd || ''} onChange={(e) => setFeeForm({ ...feeForm, unit_price_usd: parseFloat(e.target.value) || 0 })} className="h-8 mt-1" /></div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setShowFeeForm(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleAddFee}>Add Fee (${(feeForm.quantity * feeForm.unit_price_usd).toFixed(2)})</Button>
                </div>
              </Card>
            )}
            <p className="text-sm text-right text-muted-foreground">Fees Subtotal: <span className="font-semibold text-foreground">${feesSubtotal.toLocaleString()}</span></p>
          </TabsContent>

          {/* ── Summary Tab ── */}
          <TabsContent value="summary" className="space-y-4 mt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Billed Time</span>
                <span className="font-medium">${billedSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Manual People</span>
                <span className="font-medium">${manualSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Additional Fees</span>
                <span className="font-medium">${feesSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">${grandSubtotal.toLocaleString()}</span>
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
                <span>Grand Total</span>
                <span className="text-primary">${grandTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Status Actions */}
            {isEditable && (
              <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                {invoice.status === 'draft' && (
                  <>
                    <Button variant="outline" className="gap-2" onClick={() => handleStatusChange('sent')}><Send className="h-4 w-4" />Mark as Sent</Button>
                    <Button variant="outline" className="gap-2 text-destructive" onClick={() => handleStatusChange('cancelled')}><Ban className="h-4 w-4" />Cancel</Button>
                  </>
                )}
                {invoice.status === 'sent' && (
                  <>
                    <Button className="gap-2" onClick={() => handleStatusChange('paid')}><CheckCircle className="h-4 w-4" />Mark as Paid</Button>
                    <Button variant="outline" className="gap-2" onClick={() => handleStatusChange('voided')}><XCircle className="h-4 w-4" />Void</Button>
                  </>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Invoices Page ──
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
      const { data: existingLinked } = await supabase.from('invoice_time_entries').select('time_entry_id');
      const linkedIds = new Set((existingLinked || []).map(e => e.time_entry_id));
      const { data: entries } = await supabase.from('time_entries').select('*').eq('project_id', selectedProjectId).eq('billable', true).eq('status', 'normal');
      const availableEntries = (entries || []).filter(e => !linkedIds.has(e.id));

      if (availableEntries.length === 0) {
        toast.success('Invoice created (no billable entries to add yet).');
        setIsCreateOpen(false); setSelectedProjectId(''); return;
      }

      const { data: projectRoles } = await supabase.from('project_roles').select('*').eq('project_id', selectedProjectId);
      const { data: assignments } = await supabase.from('employee_projects').select('user_id, role_id').eq('project_id', selectedProjectId);
      const assignmentMap = new Map((assignments || []).map(a => [a.user_id, a.role_id]));
      const rolesMap = new Map((projectRoles || []).map(r => [r.id, r]));

      const employeeHours: Record<string, { hours: number; userId: string; name: string; entryIds: string[] }> = {};
      availableEntries.forEach(entry => {
        const emp = employees.find(e => e.user_id === entry.user_id);
        const key = entry.user_id;
        if (!employeeHours[key]) employeeHours[key] = { hours: 0, userId: entry.user_id, name: emp?.name || 'Unknown', entryIds: [] };
        employeeHours[key].hours += Number(entry.hours);
        employeeHours[key].entryIds.push(entry.id);
      });

      const lineData = Object.values(employeeHours).map(eh => {
        const roleId = assignmentMap.get(eh.userId);
        const role = roleId ? rolesMap.get(roleId) : null;
        const rate = role ? Number(role.hourly_rate_usd) : 0;
        return { invoice_id: invoice.id, user_id: eh.userId, employee_name: eh.name, role_name: role?.name || null, hours: eh.hours, rate_snapshot: rate, amount: eh.hours * rate };
      });

      await createLines.mutateAsync(lineData);
      const links = Object.values(employeeHours).flatMap(eh => eh.entryIds.map(id => ({ invoice_id: invoice.id, time_entry_id: id })));
      await linkTimeEntries.mutateAsync(links);
      const subtotalVal = lineData.reduce((sum, l) => sum + l.amount, 0);
      await updateInvoice.mutateAsync({ id: invoice.id, updates: { subtotal: subtotalVal, total: subtotalVal } });
      toast.success(`Invoice created with ${availableEntries.length} entries.`);
      setIsCreateOpen(false); setSelectedProjectId('');
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
          <p className="text-muted-foreground">Create and manage project invoices — rates come from project roles</p>
        </div>
        <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />New Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="stat-card"><CardContent className="p-6"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted"><FileText className="h-6 w-6 text-muted-foreground" /></div><div><p className="text-sm text-muted-foreground">Drafts</p><p className="text-2xl font-bold text-foreground">{stats.draft}</p></div></div></CardContent></Card>
        <Card className="stat-card"><CardContent className="p-6"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10"><DollarSign className="h-6 w-6 text-warning" /></div><div><p className="text-sm text-muted-foreground">Unpaid</p><p className="text-2xl font-bold text-foreground">${stats.unpaid.toLocaleString()}</p></div></div></CardContent></Card>
        <Card className="stat-card"><CardContent className="p-6"><div className="flex items-center gap-4"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10"><CheckCircle className="h-6 w-6 text-success" /></div><div><p className="text-sm text-muted-foreground">Collected</p><p className="text-2xl font-bold text-foreground">${stats.paid.toLocaleString()}</p></div></div></CardContent></Card>
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
                  <TableCell className="font-medium">{invoice.invoice_number ? `#${invoice.invoice_number}` : `#${invoice.id.slice(0, 8)}`}</TableCell>
                  <TableCell>{getProjectName(invoice.project_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{getClientName(invoice.project_id)}</TableCell>
                  <TableCell><Badge className={STATUS_CONFIG[invoice.status as InvoiceStatus]?.color}>{STATUS_CONFIG[invoice.status as InvoiceStatus]?.label}</Badge></TableCell>
                  <TableCell className="text-right font-semibold text-primary">${Number(invoice.total).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{format(new Date(invoice.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedInvoice(invoice); setIsDetailOpen(true); }}><ChevronRight className="h-4 w-4" /></Button></TableCell>
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
            <DialogDescription>Select a project to generate an invoice from its billable time entries.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Project *</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger>
                <SelectContent>{activeProjects.map(p => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateInvoice} disabled={createInvoice.isPending}>
              {createInvoice.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InvoiceDetailDialog invoice={selectedInvoice} open={isDetailOpen} onOpenChange={setIsDetailOpen} />
    </div>
  );
}
