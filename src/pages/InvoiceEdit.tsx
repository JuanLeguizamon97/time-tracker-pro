import { useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Loader2, Edit, RefreshCw, Calculator, Trash2, Paperclip,
  Upload, UserPlus, Receipt, Send, CheckCircle, XCircle, Ban, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { useInvoice, useInvoices, useUpdateInvoice, useInvoiceLines, useUpdateInvoiceLine, useDeleteInvoiceLine } from '@/hooks/useInvoices';
import { useInvoiceManualLines, useCreateInvoiceManualLine, useDeleteInvoiceManualLine, useInvoiceFees, useCreateInvoiceFee, useDeleteInvoiceFee, useCreateFeeAttachment, useDeleteFeeAttachment, useInvoiceFeeAttachments } from '@/hooks/useInvoiceExtras';
import { useProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { useProjectRoles, useUpdateProjectRole } from '@/hooks/useProjectRoles';
import { InvoiceLine, InvoiceStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', color: 'bg-primary/10 text-primary' },
  paid: { label: 'Paid', color: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelled', color: 'bg-destructive/10 text-destructive' },
  voided: { label: 'Voided', color: 'bg-muted text-muted-foreground' },
};

// ── Fee Attachments sub-component ──
function FeeAttachments({ feeId, isEditable }: { feeId: string; isEditable: boolean }) {
  const { data: attachments = [] } = useInvoiceFeeAttachments(feeId);
  const createAttachment = useCreateFeeAttachment();
  const deleteAttachment = useDeleteFeeAttachment();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await createAttachment.mutateAsync({ feeId, file });
      toast.success('File uploaded.');
    } catch { toast.error('Failed to upload file.'); }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="mt-1 space-y-1">
      {attachments.map(att => (
        <div key={att.id} className="flex items-center gap-2 text-xs">
          <Paperclip className="h-3 w-3 text-muted-foreground" />
          <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[200px]">{att.file_name}</a>
          {isEditable && (
            <Button variant="ghost" size="sm" className="h-5 px-1 text-destructive" onClick={() => deleteAttachment.mutateAsync({ id: att.id, fileUrl: att.file_url, feeId })}>
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

// ── Discount label helper ──
function discountDollars(line: InvoiceLine): number {
  if (line.discount_type === 'percentage') {
    return (Number(line.amount) * Number(line.discount)) / 100;
  }
  return Number(line.discount);
}

function discountHours(line: InvoiceLine): number {
  const rate = Number(line.rate_snapshot);
  if (rate === 0) return 0;
  return discountDollars(line) / rate;
}

// ── Main InvoiceEdit Page ──
export default function InvoiceEdit() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: invoice, isLoading: invoiceLoading } = useInvoice(invoiceId);
  const { data: lines = [], isLoading: linesLoading } = useInvoiceLines(invoiceId);
  const { data: manualLines = [] } = useInvoiceManualLines(invoiceId);
  const { data: fees = [] } = useInvoiceFees(invoiceId);
  const { data: allInvoices = [] } = useInvoices();
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: projectRoles = [] } = useProjectRoles(invoice?.project_id);

  const updateInvoice = useUpdateInvoice();
  const updateLine = useUpdateInvoiceLine();
  const deleteLine = useDeleteInvoiceLine();
  const updateProjectRole = useUpdateProjectRole();
  const createManualLine = useCreateInvoiceManualLine();
  const deleteManualLine = useDeleteInvoiceManualLine();
  const createFee = useCreateInvoiceFee();
  const deleteFee = useDeleteInvoiceFee();

  // ── Details editing state ──
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({ invoice_number: '', issue_date: '', due_date: '' });
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);

  // ── Billed time editing state (per-line) ──
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineForm, setLineForm] = useState({ hours: 0, rate: 0, discount: 0, discountType: 'fixed' as 'fixed' | 'percentage' });
  const [editingRateLineId, setEditingRateLineId] = useState<string | null>(null);

  // ── Manual line form ──
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({ person_name: '', hours: 0, rate_usd: 0, description: '' });

  // ── Fee form ──
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [feeForm, setFeeForm] = useState({ label: '', quantity: 1, unit_price_usd: 0, description: '' });

  const { project, client, isEditable } = useMemo(() => {
    const project = projects.find(p => p.id === invoice?.project_id);
    const client = project ? clients.find(c => c.id === project.client_id) : null;
    const isEditable = invoice?.status === 'draft' || invoice?.status === 'sent';
    return { project, client, isEditable };
  }, [projects, clients, invoice?.project_id, invoice?.status]);

  const { billedSubtotal, billedDiscounts, manualSubtotal, feesSubtotal, grandSubtotal, invoiceDiscountVal, grandTotal } = useMemo(() => {
    const billedSubtotal = lines.reduce((sum, l) => sum + Number(l.amount), 0);
    const billedDiscounts = lines.reduce((sum, l) => sum + discountDollars(l), 0);
    const manualSubtotal = manualLines.reduce((sum, l) => sum + Number(l.line_total), 0);
    const feesSubtotal = fees.reduce((sum, f) => sum + Number(f.fee_total), 0);
    const grandSubtotal = (billedSubtotal - billedDiscounts) + manualSubtotal + feesSubtotal;
    const invoiceDiscountVal = invoiceDiscount || Number(invoice?.discount || 0);
    const grandTotal = grandSubtotal - invoiceDiscountVal;
    return { billedSubtotal, billedDiscounts, manualSubtotal, feesSubtotal, grandSubtotal, invoiceDiscountVal, grandTotal };
  }, [lines, manualLines, fees, invoiceDiscount, invoice?.discount]);

  // ── Handlers ──
  const syncTotals = useCallback(async () => {
    if (!invoice) return;
    queryClient.invalidateQueries({ queryKey: ['invoice-lines'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-manual-lines'] });
    queryClient.invalidateQueries({ queryKey: ['invoice-fees'] });
    const newTotal = grandSubtotal - invoiceDiscountVal;
    await updateInvoice.mutateAsync({ id: invoice.id, updates: { subtotal: grandSubtotal, total: newTotal } });
  }, [invoice, grandSubtotal, invoiceDiscountVal, queryClient, updateInvoice]);

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    if (!invoice) return;
    try {
      await updateInvoice.mutateAsync({ id: invoice.id, updates: { status: newStatus, subtotal: grandSubtotal, total: grandTotal } });
      toast.success(`Invoice marked as ${STATUS_CONFIG[newStatus].label}.`);
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
      toast.success('Invoice details saved.');
    } catch { toast.error('Something went wrong.'); }
  };

  const handleSaveNotes = async () => {
    if (!invoice) return;
    try {
      await updateInvoice.mutateAsync({ id: invoice.id, updates: { notes } });
      setEditingNotes(false);
      toast.success('Saved.');
    } catch { toast.error('Something went wrong.'); }
  };

  const handleSaveInvoiceDiscount = async () => {
    if (!invoice) return;
    try {
      await updateInvoice.mutateAsync({ id: invoice.id, updates: { discount: invoiceDiscount, subtotal: grandSubtotal, total: grandSubtotal - invoiceDiscount } });
      toast.success('Discount saved.');
    } catch { toast.error('Something went wrong.'); }
  };

  const startEditingLine = (line: InvoiceLine) => {
    setEditingLineId(line.id);
    setLineForm({
      hours: Number(line.hours),
      rate: Number(line.rate_snapshot),
      discount: Number(line.discount),
      discountType: (line.discount_type as 'fixed' | 'percentage') || 'fixed',
    });
  };

  const handleSaveLine = async (lineId: string) => {
    const line = lines.find(l => l.id === lineId);
    if (!line) return;
    try {
      const amount = lineForm.hours * lineForm.rate;
      const matchingRole = projectRoles.find(r => r.name === line.role_name);
      if (matchingRole && lineForm.rate !== Number(line.rate_snapshot)) {
        await updateProjectRole.mutateAsync({ id: matchingRole.id, updates: { hourly_rate_usd: lineForm.rate } });
      }
      await updateLine.mutateAsync({
        id: lineId,
        updates: {
          hours: lineForm.hours,
          rate_snapshot: lineForm.rate,
          amount,
          discount: lineForm.discount,
          discount_type: lineForm.discountType,
        },
      });
      setEditingLineId(null);
      await syncTotals();
      toast.success('Line updated.');
    } catch { toast.error('Something went wrong.'); }
  };

  const handleRemoveLine = async (lineId: string) => {
    try {
      await deleteLine.mutateAsync(lineId);
      await syncTotals();
      toast.success('Line removed.');
    } catch { toast.error('Something went wrong.'); }
  };

  const handleUpdateToCurrentRates = async () => {
    if (!invoice || !isEditable) return;
    try {
      const assignments = await api.get<{ user_id: string; role_id: string | null }[]>(`/employee-projects?project_id=${invoice.project_id}`);
      const assignmentMap = new Map(assignments.map(a => [a.user_id, a.role_id]));
      for (const line of lines) {
        let newRate = Number(line.rate_snapshot);
        const roleId = assignmentMap.get(line.user_id);
        if (roleId) {
          const role = projectRoles.find(r => r.id === roleId);
          if (role) newRate = Number(role.hourly_rate_usd);
        }
        const newAmount = Number(line.hours) * newRate;
        await updateLine.mutateAsync({ id: line.id, updates: { rate_snapshot: newRate, amount: newAmount } });
      }
      await syncTotals();
      toast.success('Rates updated to current project rates.');
    } catch { toast.error('Something went wrong.'); }
  };

  const handleRecalcAllUnpaid = async () => {
    if (!invoice) return;
    try {
      const unpaid = allInvoices.filter(i => i.project_id === invoice.project_id && (i.status === 'draft' || i.status === 'sent'));
      const assignments = await api.get<{ user_id: string; role_id: string | null }[]>(`/employee-projects?project_id=${invoice.project_id}`);
      const assignmentMap = new Map(assignments.map(a => [a.user_id, a.role_id]));
      let count = 0;
      for (const inv of unpaid) {
        const invLines = await api.get<InvoiceLine[]>(`/invoice-lines?invoice_id=${inv.id}`);
        if (!invLines?.length) continue;
        let sub = 0;
        for (const line of invLines) {
          let r = Number(line.rate_snapshot);
          const roleId = assignmentMap.get(line.user_id);
          if (roleId) { const role = projectRoles.find(pr => pr.id === roleId); if (role) r = Number(role.hourly_rate_usd); }
          const a = Number(line.hours) * r;
          sub += a;
          await updateLine.mutateAsync({ id: line.id, updates: { rate_snapshot: r, amount: a } });
        }
        await updateInvoice.mutateAsync({ id: inv.id, updates: { subtotal: sub, total: sub - Number(inv.discount) } });
        count++;
      }
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-lines'] });
      toast.success(`Recalculated ${count} unpaid invoice${count !== 1 ? 's' : ''}.`);
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

  // ── Loading state ──
  if (invoiceLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />Back to Invoices
        </Button>
        <p className="text-muted-foreground">Invoice not found.</p>
      </div>
    );
  }

  const invoiceLabel = invoice.invoice_number ? `#${invoice.invoice_number}` : `#${invoice.id.slice(0, 8)}`;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/invoices" className="hover:text-foreground transition-colors">Invoices</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Edit Invoice {invoiceLabel}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/invoices')} className="gap-2 mt-0.5 shrink-0">
            <ArrowLeft className="h-4 w-4" />Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Invoice {invoiceLabel}</h1>
            <p className="text-muted-foreground">{project?.name}{client ? ` · ${client.name}` : ''}</p>
            {client?.manager_name && (
              <p className="text-xs text-muted-foreground mt-0.5">Attn: {client.manager_name}{client.manager_email ? ` · ${client.manager_email}` : ''}</p>
            )}
          </div>
        </div>
        <Badge className={`${STATUS_CONFIG[invoice.status as InvoiceStatus]?.color} text-sm px-3 py-1 shrink-0`}>
          {STATUS_CONFIG[invoice.status as InvoiceStatus]?.label}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="billed">Billed Time</TabsTrigger>
          <TabsTrigger value="manual">Manual People</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        {/* ── Details Tab ── */}
        <TabsContent value="details" className="space-y-6 mt-6">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Invoice Details</h2>
                {isEditable && !editingMeta && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                    setMetaForm({
                      invoice_number: invoice.invoice_number || '',
                      issue_date: invoice.issue_date || '',
                      due_date: invoice.due_date || '',
                    });
                    setEditingMeta(true);
                  }}>
                    <Edit className="h-3.5 w-3.5" />Edit
                  </Button>
                )}
              </div>
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
              {editingMeta && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveMeta}>Save Details</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingMeta(false)}>Cancel</Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Notes</h2>
                {isEditable && !editingNotes && (
                  <Button variant="ghost" size="sm" onClick={() => { setNotes(invoice.notes || ''); setEditingNotes(true); }}>
                    <Edit className="h-3.5 w-3.5 mr-1" />Edit
                  </Button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes..." rows={4} />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditingNotes(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleSaveNotes}>Save</Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{invoice.notes || 'No notes'}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Billed Time Tab ── */}
        <TabsContent value="billed" className="space-y-4 mt-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-foreground">Employee Lines</h2>
            {isEditable && (
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleUpdateToCurrentRates}>
                  <RefreshCw className="h-3.5 w-3.5" />Update to Current Rates
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                      <Calculator className="h-3.5 w-3.5" />Recalculate
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleRecalcAllUnpaid}>All unpaid invoices for this project</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {linesLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No billed time entries on this invoice.</p>
          ) : (
            <div className="space-y-3">
              {lines.map(line => {
                const isEditing = editingLineId === line.id;
                const dDiscount = discountDollars(line);
                const dHours = discountHours(line);
                const netAmount = Number(line.amount) - dDiscount;

                return (
                  <Card key={line.id} className={isEditing ? 'border-primary/50 ring-1 ring-primary/20' : ''}>
                    <CardContent className="p-4">
                      {isEditing ? (
                        /* ── Inline Edit Form ── */
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-semibold">{line.employee_name}</p>
                              <p className="text-xs text-muted-foreground">{line.role_name || '—'}</p>
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div>
                              <Label className="text-xs text-muted-foreground">Hours</Label>
                              <Input type="number" min="0" step="0.5" value={lineForm.hours || ''} onChange={(e) => setLineForm({ ...lineForm, hours: parseFloat(e.target.value) || 0 })} className="h-8 mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Rate (USD/h)</Label>
                              <Input type="number" min="0" step="0.5" value={lineForm.rate || ''} onChange={(e) => setLineForm({ ...lineForm, rate: parseFloat(e.target.value) || 0 })} className="h-8 mt-1" />
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Subtotal</Label>
                              <p className="text-sm font-medium mt-2">${(lineForm.hours * lineForm.rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-2">
                              <Label className="text-xs text-muted-foreground">Discount</Label>
                              <div className="flex gap-2 mt-1">
                                <Select value={lineForm.discountType} onValueChange={(v) => setLineForm({ ...lineForm, discountType: v as 'fixed' | 'percentage' })}>
                                  <SelectTrigger className="w-28 h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="fixed">$ Fixed</SelectItem>
                                    <SelectItem value="percentage">% Rate</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input
                                  type="number" min="0" step="0.01"
                                  value={lineForm.discount || ''}
                                  onChange={(e) => setLineForm({ ...lineForm, discount: parseFloat(e.target.value) || 0 })}
                                  placeholder={lineForm.discountType === 'percentage' ? '10' : '500'}
                                  className="h-8"
                                />
                              </div>
                              {lineForm.discount > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {lineForm.discountType === 'percentage'
                                    ? `= $${((lineForm.hours * lineForm.rate * lineForm.discount) / 100).toFixed(2)} (${(((lineForm.hours * lineForm.rate * lineForm.discount) / 100) / (lineForm.rate || 1)).toFixed(2)} hrs)`
                                    : `= ${(lineForm.discount / (lineForm.rate || 1)).toFixed(2)} hrs`}
                                </p>
                              )}
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Net Total</Label>
                              <p className="text-sm font-bold text-primary mt-2">
                                ${(lineForm.hours * lineForm.rate - (lineForm.discountType === 'percentage' ? (lineForm.hours * lineForm.rate * lineForm.discount) / 100 : lineForm.discount)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="outline" onClick={() => setEditingLineId(null)}>Cancel</Button>
                            <Button size="sm" onClick={() => handleSaveLine(line.id)}>Save Line</Button>
                          </div>
                        </div>
                      ) : (
                        /* ── Display Row ── */
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-3 flex-wrap">
                              <span className="font-semibold">{line.employee_name}</span>
                              <span className="text-xs text-muted-foreground">{line.role_name || '—'}</span>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                              <span>{Number(line.hours)}h × ${Number(line.rate_snapshot)}/h</span>
                              <span className="text-foreground font-medium">Subtotal: ${Number(line.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                            {dDiscount > 0 && (
                              <p className="text-xs text-warning mt-1">
                                Discount: {dHours.toFixed(2)} hrs / ${dDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                {line.discount_type === 'percentage' && ` (${Number(line.discount)}%)`}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">Net</p>
                              <p className="font-bold text-primary">${netAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            {isEditable && (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => startEditingLine(line)}><Edit className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleRemoveLine(line.id)}><XCircle className="h-3.5 w-3.5" /></Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="flex justify-end gap-8 text-sm pt-2">
            <span className="text-muted-foreground">Gross Billed: <span className="font-semibold text-foreground">${billedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
            {billedDiscounts > 0 && (
              <span className="text-muted-foreground">Discounts: <span className="font-semibold text-warning">-${billedDiscounts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
            )}
            <span className="text-muted-foreground">Net Billed: <span className="font-semibold text-foreground">${(billedSubtotal - billedDiscounts).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></span>
          </div>
        </TabsContent>

        {/* ── Manual People Tab ── */}
        <TabsContent value="manual" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Manual People Lines</h2>
            {isEditable && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowManualForm(true)}>
                <UserPlus className="h-4 w-4" />Add Person
              </Button>
            )}
          </div>

          {manualLines.length === 0 && !showManualForm ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No manual lines. Add people who aren't tied to time entries.</p>
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
                    <TableCell className="text-right font-semibold text-primary">${Number(ml.line_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    {isEditable && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteManualLine.mutateAsync(ml.id).then(() => syncTotals()).then(() => toast.success('Removed.'))}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {showManualForm && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-medium">Add Manual Person</h3>
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
          <p className="text-sm text-right text-muted-foreground">Manual Subtotal: <span className="font-semibold text-foreground">${manualSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
        </TabsContent>

        {/* ── Fees Tab ── */}
        <TabsContent value="fees" className="space-y-4 mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Additional Fees & Attachments</h2>
            {isEditable && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowFeeForm(true)}>
                <Receipt className="h-4 w-4" />Add Fee
              </Button>
            )}
          </div>

          {fees.length === 0 && !showFeeForm ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No additional fees. Add software licenses, travel expenses, etc.</p>
          ) : (
            <div className="space-y-3">
              {fees.map(fee => (
                <Card key={fee.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{fee.label}</p>
                      {fee.description && <p className="text-xs text-muted-foreground">{fee.description}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        {Number(fee.quantity)} × ${Number(fee.unit_price_usd)} = <span className="font-semibold text-primary">${Number(fee.fee_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </p>
                      <FeeAttachments feeId={fee.id} isEditable={isEditable} />
                    </div>
                    {isEditable && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteFee.mutateAsync(fee.id).then(() => syncTotals()).then(() => toast.success('Fee removed.'))}><Trash2 className="h-4 w-4" /></Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          {showFeeForm && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-medium">Add Fee</h3>
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
          <p className="text-sm text-right text-muted-foreground">Fees Subtotal: <span className="font-semibold text-foreground">${feesSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
        </TabsContent>

        {/* ── Summary Tab ── */}
        <TabsContent value="summary" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent className="p-6 space-y-3">
                <h2 className="font-semibold">Invoice Totals</h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gross Billed Time</span>
                    <span className="font-medium">${billedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {billedDiscounts > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Employee Discounts</span>
                      <span className="font-medium text-warning">-${billedDiscounts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Manual People</span>
                    <span className="font-medium">${manualSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Additional Fees</span>
                    <span className="font-medium">${feesSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">${grandSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Invoice Discount</span>
                    {isEditable ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number" min="0" step="0.01"
                          value={invoiceDiscount || invoice.discount || ''}
                          onChange={(e) => setInvoiceDiscount(parseFloat(e.target.value) || 0)}
                          className="w-28 h-8 text-right"
                        />
                        <Button size="sm" variant="outline" onClick={handleSaveInvoiceDiscount}>Save</Button>
                      </div>
                    ) : (
                      <span className="font-medium">-${Number(invoice.discount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    )}
                  </div>
                  <div className="flex justify-between border-t pt-2 text-base">
                    <span className="font-bold">Grand Total</span>
                    <span className="font-bold text-primary">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Status actions */}
            {isEditable && (
              <Card>
                <CardContent className="p-6 space-y-3">
                  <h2 className="font-semibold">Status Actions</h2>
                  <div className="flex flex-col gap-2">
                    {invoice.status === 'draft' && (
                      <>
                        <Button variant="outline" className="gap-2 justify-start" onClick={() => handleStatusChange('sent')}><Send className="h-4 w-4" />Mark as Sent</Button>
                        <Button variant="outline" className="gap-2 justify-start text-destructive hover:text-destructive" onClick={() => handleStatusChange('cancelled')}><Ban className="h-4 w-4" />Cancel Invoice</Button>
                      </>
                    )}
                    {invoice.status === 'sent' && (
                      <>
                        <Button className="gap-2 justify-start" onClick={() => handleStatusChange('paid')}><CheckCircle className="h-4 w-4" />Mark as Paid</Button>
                        <Button variant="outline" className="gap-2 justify-start" onClick={() => handleStatusChange('voided')}><XCircle className="h-4 w-4" />Void Invoice</Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
