import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Plus, Trash2, Clock, FileDown, FileSpreadsheet, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useInvoiceEditData, usePatchInvoice } from '@/hooks/useInvoices';
import { InvoiceEditLine, InvoiceExpense, InvoiceLinePatch, InvoiceExpensePatch } from '@/types';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Separator } from '@/components/ui/separator';

const EXPENSE_CATEGORIES = ['Airfare', 'Hotel', 'Parking / Transportation', 'Meals', 'Other'];

const ROLE_SECTION_LABELS: Record<string, string> = {
  manager: 'Hours Cost per Employee',
  contractor: 'Professional Fees',
  employee: 'Billable Hours',
};

const STATUS_OPTIONS = ['draft', 'sent', 'paid', 'cancelled', 'voided'];

type LocalLine = InvoiceEditLine & {
  _discountType: 'amount' | 'percent';
  _discountValue: number;
  _hours: number;
  _rate: number;
};

type LocalExpense = Partial<InvoiceExpense> & {
  _isNew?: boolean;
  _tempId?: string;
};

function computeLineTotals(line: LocalLine) {
  const subtotal = line._hours * line._rate;
  const discountDollars =
    line._discountType === 'percent'
      ? (subtotal * line._discountValue) / 100
      : line._discountValue;
  const discountHours = line._rate > 0 ? discountDollars / line._rate : 0;
  const total = Math.max(0, subtotal - discountDollars);
  return { subtotal, discountDollars, discountHours, total };
}

export default function InvoiceEditPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const patchInvoice = usePatchInvoice();

  const { data, isLoading } = useInvoiceEditData(invoiceId);

  // Local editable state — initialized from server data
  const [lines, setLines] = useState<LocalLine[]>([]);
  const [expenses, setExpenses] = useState<LocalExpense[]>([]);
  const [status, setStatus] = useState('');
  const [capAmount, setCapAmount] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Export state
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);

  // Expensify panel state
  const [expensifyOpen, setExpensifyOpen] = useState(false);
  const [expProjectCode, setExpProjectCode] = useState('');
  const [expEmail, setExpEmail] = useState('');
  const [expDateFrom, setExpDateFrom] = useState('');
  const [expDateTo, setExpDateTo] = useState('');
  const [expCopRate, setExpCopRate] = useState('');
  const [expensifySyncing, setExpensifySyncing] = useState(false);
  const [expensifyPreviewing, setExpensifyPreviewing] = useState(false);
  const [expensifyPreview, setExpensifyPreview] = useState<null | { count: number; reports: any[] }>(null);

  // Initialize local state once data loads
  if (data && !initialized) {
    setLines(
      data.lines.map(l => ({
        ...l,
        _discountType: (l.discount_type as 'amount' | 'percent') || 'amount',
        _discountValue: l.discount_value ?? 0,
        _hours: l.hours,
        _rate: l.hourly_rate,
      }))
    );
    setExpenses(data.expenses.map(e => ({ ...e })));
    setStatus(data.invoice.status);
    setCapAmount(data.invoice.cap_amount != null ? String(data.invoice.cap_amount) : '');
    setInvoiceNumber(data.invoice.invoice_number || '');
    setIssueDate(data.invoice.issue_date || '');
    setDueDate(data.invoice.due_date || '');
    setNotes(data.invoice.notes || '');
    setInitialized(true);
  }

  const updateLine = useCallback((id: string, updates: Partial<LocalLine>) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }, []);

  // Group lines by role
  const groupedLines = useMemo(() => {
    const groups: Record<string, LocalLine[]> = {};
    for (const line of lines) {
      const roleKey = (line.role || 'employee').toLowerCase();
      if (!groups[roleKey]) groups[roleKey] = [];
      groups[roleKey].push(line);
    }
    return groups;
  }, [lines]);

  // Summary computations
  const summary = useMemo(() => {
    let totalFees = 0;
    let totalDiscounts = 0;
    for (const line of lines) {
      const { total, discountDollars } = computeLineTotals(line);
      totalFees += total;
      totalDiscounts += discountDollars;
    }
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount_usd || 0), 0);
    const cap = capAmount ? parseFloat(capAmount) : null;
    const subtotalFees = totalFees;
    const totalDue = (cap != null ? Math.min(subtotalFees, cap) : subtotalFees) + totalExpenses;
    return { totalFees, totalDiscounts, totalExpenses, subtotalFees, totalDue, cap };
  }, [lines, expenses, capAmount]);

  // Expense category subtotals
  const expenseCategoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const cat of EXPENSE_CATEGORIES) totals[cat] = 0;
    for (const exp of expenses) {
      if (exp.category && exp.amount_usd) {
        totals[exp.category] = (totals[exp.category] || 0) + exp.amount_usd;
      }
    }
    return totals;
  }, [expenses]);

  const addExpense = () => {
    const tempId = `new_${Date.now()}`;
    setExpenses(prev => [
      ...prev,
      {
        _isNew: true,
        _tempId: tempId,
        date: format(new Date(), 'yyyy-MM-dd'),
        professional: '',
        vendor: '',
        description: '',
        category: 'Other',
        amount_usd: 0,
        payment_source: '',
        receipt_attached: false,
        notes: '',
      },
    ]);
  };

  const removeExpense = (idx: number) => {
    setExpenses(prev => prev.filter((_, i) => i !== idx));
  };

  const updateExpense = (idx: number, updates: Partial<LocalExpense>) => {
    setExpenses(prev => prev.map((e, i) => i === idx ? { ...e, ...updates } : e));
  };

  const handleSave = async () => {
    if (!invoiceId) return;
    try {
      const linePatches: InvoiceLinePatch[] = lines.map(l => ({
        id: l.id,
        hours: l._hours,
        rate_snapshot: l._rate,
        discount_type: l._discountType,
        discount_value: l._discountValue,
      }));

      const expensePatches: InvoiceExpensePatch[] = expenses.map(e => ({
        id: e._isNew ? null : (e.id || null),
        invoice_id: invoiceId,
        date: e.date || format(new Date(), 'yyyy-MM-dd'),
        professional: e.professional || null,
        vendor: e.vendor || null,
        description: e.description || null,
        category: e.category || 'Other',
        amount_usd: e.amount_usd || 0,
        payment_source: e.payment_source || null,
        receipt_attached: e.receipt_attached || false,
        notes: e.notes || null,
      }));

      await patchInvoice.mutateAsync({
        id: invoiceId,
        patch: {
          status,
          cap_amount: capAmount ? parseFloat(capAmount) : null,
          invoice_number: invoiceNumber || null,
          issue_date: issueDate || null,
          due_date: dueDate || null,
          notes: notes || null,
          lines: linePatches,
          expenses: expensePatches,
        },
      });
      toast.success('Invoice saved successfully.');
      setInitialized(false); // re-init from server on next render
    } catch {
      toast.error('Error saving invoice.');
    }
  };

  const handleExport = async (format: 'pdf' | 'xlsx') => {
    if (!invoiceId) return;
    const setter = format === 'pdf' ? setExportingPdf : setExportingXlsx;
    setter(true);
    try {
      const resp = await fetch(`/api/invoices/${invoiceId}/export/${format}`);
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceLabel}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}.`);
    } finally {
      setter(false);
    }
  };

  const handleExpensifyPreview = async () => {
    setExpensifyPreviewing(true);
    setExpensifyPreview(null);
    try {
      const params = new URLSearchParams();
      if (expProjectCode) params.set('project_code', expProjectCode);
      if (expEmail) params.set('employee_email', expEmail);
      if (expDateFrom) params.set('date_from', expDateFrom);
      if (expDateTo) params.set('date_to', expDateTo);
      const result = await api.get<{ count: number; reports: any[] }>(`/expensify/reports?${params}`);
      setExpensifyPreview(result);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to fetch Expensify reports.');
    } finally {
      setExpensifyPreviewing(false);
    }
  };

  const handleExpensifySync = async () => {
    if (!invoiceId) return;
    setExpensifySyncing(true);
    try {
      const params = new URLSearchParams({ invoice_id: invoiceId });
      if (expProjectCode) params.set('project_code', expProjectCode);
      if (expEmail) params.set('employee_email', expEmail);
      if (expDateFrom) params.set('date_from', expDateFrom);
      if (expDateTo) params.set('date_to', expDateTo);
      if (expCopRate) params.set('cop_rate', expCopRate);
      const result = await api.post<{ imported: number; skipped: number; conversion_notes: string[] }>(
        `/expensify/sync?${params}`, {}
      );
      toast.success(`Imported ${result.imported} expenses (${result.skipped} skipped).`);
      if (result.conversion_notes?.length) {
        toast.info(`Conversions: ${result.conversion_notes.join(' | ')}`);
      }
      setInitialized(false); // reload expenses from server
    } catch (e: any) {
      toast.error(e?.message || 'Expensify sync failed.');
    } finally {
      setExpensifySyncing(false);
    }
  };

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const invoiceLabel = data.invoice.invoice_number
    ? `INV-${data.invoice.invoice_number}`
    : `#${data.invoice.id.slice(0, 8)}`;

  const isNonBillable = !['approved'].includes(status.toLowerCase());

  return (
    <div className="space-y-6 pb-12">
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
            <BreadcrumbPage>{invoiceLabel}</BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Edit</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Invoices
          </Button>
          <h1 className="text-xl font-bold text-foreground">{invoiceLabel}</h1>
          {data.client && (
            <span className="text-muted-foreground text-sm">— {data.client.name}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data.invoice.issue_date && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                const params = new URLSearchParams({
                  project_id: data.invoice.project_id,
                  from: data.invoice.issue_date!,
                });
                navigate(`/history?${params.toString()}`);
              }}
            >
              <Clock className="h-4 w-4" /> View in Hours Tracker
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => handleExport('pdf')}
            disabled={exportingPdf}
          >
            {exportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => handleExport('xlsx')}
            disabled={exportingXlsx}
          >
            {exportingXlsx ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Excel
          </Button>
          <Button
            onClick={handleSave}
            disabled={patchInvoice.isPending}
            className="gap-2"
          >
            {patchInvoice.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Save className="h-4 w-4" />
            }
            Save Changes
          </Button>
        </div>
      </div>

      {/* Non-billable warning */}
      {isNonBillable && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          ⚠️ This invoice is in <strong className="mx-1 capitalize">{status}</strong> status and cannot be used for billing. Only <strong className="mx-1">Approved</strong> invoices are billable.
        </div>
      )}

      {/* Main two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column — main content */}
        <div className="flex-1 space-y-6 min-w-0">

          {/* Invoice Metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map(s => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Invoice Number</Label>
                  <Input
                    className="h-8"
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. 2026-001"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Issue Date</Label>
                  <Input
                    type="date"
                    className="h-8"
                    value={issueDate}
                    onChange={e => setIssueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Due Date</Label>
                  <Input
                    type="date"
                    className="h-8"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    className="resize-none text-sm"
                    rows={2}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Internal notes…"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Professionals Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Professionals</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {Object.keys(groupedLines).length === 0 ? (
                <p className="text-muted-foreground text-sm px-6 py-4">No time entries linked to this invoice.</p>
              ) : (
                Object.entries(groupedLines).map(([roleKey, roleLines]) => (
                  <div key={roleKey}>
                    <div className="px-6 py-2 bg-muted/40 border-y">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {ROLE_SECTION_LABELS[roleKey] || roleKey}
                      </span>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Name / Title</TableHead>
                          <TableHead className="text-xs text-right w-24">Hours</TableHead>
                          <TableHead className="text-xs text-right w-28">Rate ($/hr)</TableHead>
                          <TableHead className="text-xs text-right w-28">Subtotal</TableHead>
                          <TableHead className="text-xs w-56">Discount</TableHead>
                          <TableHead className="text-xs text-right w-28">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roleLines.map(line => {
                          const { subtotal, discountDollars, discountHours, total } = computeLineTotals(line);
                          return (
                            <TableRow key={line.id}>
                              <TableCell>
                                <div className="font-medium text-sm">{line.employee_name}</div>
                                {line.title && (
                                  <div className="text-xs text-muted-foreground">{line.title}</div>
                                )}
                                <Badge variant="outline" className="text-xs mt-1 capitalize">{line.role || 'employee'}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={line._hours}
                                  onChange={e => updateLine(line.id, { _hours: parseFloat(e.target.value) || 0 })}
                                  className="w-20 h-7 text-right text-sm ml-auto"
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-xs text-muted-foreground">$</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={line._rate}
                                    onChange={e => updateLine(line.id, { _rate: parseFloat(e.target.value) || 0 })}
                                    className="w-20 h-7 text-right text-sm"
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                ${subtotal.toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={line._discountValue}
                                      onChange={e => updateLine(line.id, { _discountValue: parseFloat(e.target.value) || 0 })}
                                      className="w-20 h-7 text-right text-sm"
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2 text-xs font-mono"
                                      onClick={() => updateLine(line.id, {
                                        _discountType: line._discountType === 'amount' ? 'percent' : 'amount'
                                      })}
                                    >
                                      {line._discountType === 'amount' ? '$' : '%'}
                                    </Button>
                                  </div>
                                  {(discountDollars > 0) && (
                                    <div className="text-xs text-muted-foreground">
                                      {discountHours.toFixed(2)} hrs / ${discountDollars.toFixed(2)}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-semibold text-sm">
                                ${total.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Expenses Section */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Expenses</CardTitle>
              <Button size="sm" variant="outline" onClick={addExpense} className="gap-1">
                <Plus className="h-3 w-3" /> Add Expense
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {expenses.length === 0 ? (
                <p className="text-muted-foreground text-sm">No expenses yet. Click "Add Expense" to add one.</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-32">Date</TableHead>
                          <TableHead className="text-xs w-32">Professional</TableHead>
                          <TableHead className="text-xs w-28">Vendor</TableHead>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs w-40">Category</TableHead>
                          <TableHead className="text-xs text-right w-28">Amount (USD)</TableHead>
                          <TableHead className="text-xs w-28">Payment Source</TableHead>
                          <TableHead className="text-xs text-center w-16">Receipt</TableHead>
                          <TableHead className="text-xs w-32">Notes</TableHead>
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenses.map((exp, idx) => (
                          <TableRow key={exp.id || exp._tempId || idx}>
                            <TableCell>
                              <Input
                                type="date"
                                className="h-7 text-xs w-28"
                                value={exp.date || ''}
                                onChange={e => updateExpense(idx, { date: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-7 text-xs w-28"
                                value={exp.professional || ''}
                                onChange={e => updateExpense(idx, { professional: e.target.value })}
                                placeholder="Name"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-7 text-xs w-24"
                                value={exp.vendor || ''}
                                onChange={e => updateExpense(idx, { vendor: e.target.value })}
                                placeholder="Vendor"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-7 text-xs min-w-32"
                                value={exp.description || ''}
                                onChange={e => updateExpense(idx, { description: e.target.value })}
                                placeholder="Description"
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={exp.category || 'Other'}
                                onValueChange={v => updateExpense(idx, { category: v })}
                              >
                                <SelectTrigger className="h-7 text-xs w-36">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {EXPENSE_CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat} className="text-xs">{cat}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-xs text-muted-foreground">$</span>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="h-7 text-xs w-20 text-right"
                                  value={exp.amount_usd || 0}
                                  onChange={e => updateExpense(idx, { amount_usd: parseFloat(e.target.value) || 0 })}
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-7 text-xs w-24"
                                value={exp.payment_source || ''}
                                onChange={e => updateExpense(idx, { payment_source: e.target.value })}
                                placeholder="e.g. Corp Card"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={exp.receipt_attached || false}
                                onCheckedChange={v => updateExpense(idx, { receipt_attached: !!v })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-7 text-xs w-28"
                                value={exp.notes || ''}
                                onChange={e => updateExpense(idx, { notes: e.target.value })}
                                placeholder="Notes"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => removeExpense(idx)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Category subtotals */}
                  <div className="flex flex-wrap gap-3 pt-2 border-t text-xs text-muted-foreground">
                    {EXPENSE_CATEGORIES.filter(c => expenseCategoryTotals[c] > 0).map(cat => (
                      <span key={cat}>{cat}: <span className="font-medium text-foreground">${expenseCategoryTotals[cat].toFixed(2)}</span></span>
                    ))}
                    {summary.totalExpenses > 0 && (
                      <span className="ml-auto font-semibold text-foreground">
                        Total Expenses: ${summary.totalExpenses.toFixed(2)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column — sticky summary */}
        <div className="w-full lg:w-72 shrink-0">
          <div className="lg:sticky lg:top-6 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invoice Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Fees</span>
                  <span className="font-medium">${summary.totalFees.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-destructive/80">
                  <span>Total Discounts</span>
                  <span>-${summary.totalDiscounts.toFixed(2)}</span>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Cap Amount</Label>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      className="h-7 text-sm"
                      value={capAmount}
                      onChange={e => setCapAmount(e.target.value)}
                      placeholder="No cap"
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal Fees</span>
                  <span>${summary.subtotalFees.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Expenses</span>
                  <span>${summary.totalExpenses.toFixed(2)}</span>
                </div>

                <Separator />

                <div className="flex justify-between text-base font-bold">
                  <span>Total Due</span>
                  <span className="text-primary">${summary.totalDue.toFixed(2)}</span>
                </div>

                {summary.cap != null && summary.cap < summary.subtotalFees && (
                  <p className="text-xs text-muted-foreground">
                    Capped at ${summary.cap.toFixed(2)} (fees exceed cap by ${(summary.subtotalFees - summary.cap).toFixed(2)})
                  </p>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={handleSave}
              disabled={patchInvoice.isPending}
              className="w-full gap-2"
            >
              {patchInvoice.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />
              }
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Expensify Sync Panel — full width below the two-column layout */}
      <Card>
        <CardHeader
          className="flex flex-row items-center justify-between cursor-pointer select-none"
          onClick={() => setExpensifyOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Expensify Sync</CardTitle>
            <Badge variant="outline" className="text-xs">Beta</Badge>
          </div>
          {expensifyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardHeader>

        {expensifyOpen && (
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Import <strong>Approved</strong> expenses from Expensify. COP amounts are auto-converted to USD.
              Expenses already imported (matched by Expensify ID) will be skipped.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1">
                <Label className="text-xs">Project Code (tag filter)</Label>
                <Input
                  className="h-8 text-sm"
                  value={expProjectCode}
                  onChange={e => setExpProjectCode(e.target.value)}
                  placeholder="e.g. IPC-2026-001"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Submitter Email</Label>
                <Input
                  className="h-8 text-sm"
                  value={expEmail}
                  onChange={e => setExpEmail(e.target.value)}
                  placeholder="employee@company.com"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date From</Label>
                <Input
                  type="date"
                  className="h-8 text-sm"
                  value={expDateFrom}
                  onChange={e => setExpDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Date To</Label>
                <Input
                  type="date"
                  className="h-8 text-sm"
                  value={expDateTo}
                  onChange={e => setExpDateTo(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">COP → USD Rate override</Label>
                <Input
                  type="number"
                  className="h-8 text-sm"
                  value={expCopRate}
                  onChange={e => setExpCopRate(e.target.value)}
                  placeholder="Default: 4,200"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleExpensifyPreview}
                disabled={expensifyPreviewing}
              >
                {expensifyPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Preview Reports
              </Button>
              <Button
                size="sm"
                className="gap-2"
                onClick={handleExpensifySync}
                disabled={expensifySyncing}
              >
                {expensifySyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                Import to Invoice
              </Button>
            </div>

            {expensifyPreview && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-2">
                <p className="font-medium">{expensifyPreview.count} approved report(s) found</p>
                {expensifyPreview.reports.length === 0 && (
                  <p className="text-xs text-muted-foreground">No approved reports match the filters.</p>
                )}
                {expensifyPreview.reports.map((r: any, i: number) => (
                  <div key={i} className="text-xs text-muted-foreground border-t pt-2">
                    <span className="font-medium text-foreground">{r.report_name || r.report_id}</span>
                    {' — '}{r.submitted_by}
                    {' — '}<span className="text-green-600 font-medium">${r.total_usd?.toFixed(2)}</span>
                    {r.conversion_note && (
                      <span className="ml-2 text-amber-600">({r.conversion_note})</span>
                    )}
                    {' — '}{r.expenses?.length ?? 0} expense(s)
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
