import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProjects } from '@/hooks/useProjects';
import { useCreateInvoice, useCreateInvoiceLines, useUpdateInvoice } from '@/hooks/useInvoices';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ManualLine {
  employee_name: string;
  role_name: string;
  hours: number;
  rate_snapshot: number;
}

export default function InvoiceManualPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefilledProjectId = searchParams.get('project_id') || '';

  const { data: projects = [] } = useProjects();
  const createInvoice = useCreateInvoice();
  const createLines = useCreateInvoiceLines();
  const updateInvoice = useUpdateInvoice();

  const [selectedProjectId, setSelectedProjectId] = useState(prefilledProjectId);
  const [lines, setLines] = useState<ManualLine[]>([
    { employee_name: '', role_name: '', hours: 0, rate_snapshot: 0 },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const activeProjects = useMemo(
    () => projects.filter(p => p.is_active && !p.is_internal),
    [projects]
  );

  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.hours) * Number(l.rate_snapshot)), 0),
    [lines]
  );

  const updateLine = (index: number, field: keyof ManualLine, value: string | number) => {
    setLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addLine = () => {
    setLines(prev => [...prev, { employee_name: '', role_name: '', hours: 0, rate_snapshot: 0 }]);
  };

  const removeLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!selectedProjectId) {
      toast.error('Please select a project.');
      return;
    }
    if (lines.length === 0) {
      toast.error('Add at least one line item.');
      return;
    }

    setIsSaving(true);
    try {
      const invoice = await createInvoice.mutateAsync({ project_id: selectedProjectId });

      const lineData = lines.map(l => ({
        invoice_id: invoice.id,
        user_id: '',
        employee_name: l.employee_name || 'Manual Entry',
        role_name: l.role_name || null,
        hours: Number(l.hours),
        rate_snapshot: Number(l.rate_snapshot),
        amount: Number(l.hours) * Number(l.rate_snapshot),
      }));

      await createLines.mutateAsync(lineData);
      const subtotalVal = lineData.reduce((sum, l) => sum + l.amount, 0);
      await updateInvoice.mutateAsync({ id: invoice.id, updates: { subtotal: subtotalVal, total: subtotalVal } });

      toast.success('Manual invoice created as Draft.');
      navigate(`/invoices/${invoice.id}/edit`);
    } catch (err) {
      console.error(err);
      toast.error('Something went wrong saving the invoice.');
      setIsSaving(false);
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
            <BreadcrumbLink onClick={() => navigate('/invoices/new')} className="cursor-pointer">
              New Invoice
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Manual Entry</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/invoices/new')} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manual Invoice</h1>
            <p className="text-sm text-muted-foreground">Enter line items manually — will be saved as Draft</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving || !selectedProjectId}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save as Draft
        </Button>
      </div>

      {/* Project selector */}
      <Card>
        <CardHeader>
          <CardTitle>Project</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm space-y-2">
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
          </div>
        </CardContent>
      </Card>

      {/* Line items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line Items</CardTitle>
          <Button variant="outline" size="sm" onClick={addLine} className="gap-2">
            <Plus className="h-4 w-4" /> Add Line
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Name / Description</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right w-28">Hours</TableHead>
                <TableHead className="text-right w-32">Rate (USD)</TableHead>
                <TableHead className="text-right w-32">Amount</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line, index) => (
                <TableRow key={index}>
                  <TableCell className="pl-6">
                    <Input
                      value={line.employee_name}
                      onChange={e => updateLine(index, 'employee_name', e.target.value)}
                      placeholder="Employee or description"
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={line.role_name}
                      onChange={e => updateLine(index, 'role_name', e.target.value)}
                      placeholder="Role (optional)"
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.5"
                      value={line.hours || ''}
                      onChange={e => updateLine(index, 'hours', parseFloat(e.target.value) || 0)}
                      className="h-8 text-right"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.rate_snapshot || ''}
                      onChange={e => updateLine(index, 'rate_snapshot', parseFloat(e.target.value) || 0)}
                      className="h-8 text-right"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${(Number(line.hours) * Number(line.rate_snapshot)).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLine(index)}
                      disabled={lines.length === 1}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end p-4 border-t">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Subtotal</p>
              <p className="text-xl font-bold text-primary">
                ${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
