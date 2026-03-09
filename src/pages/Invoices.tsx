import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, DollarSign, ChevronRight, Loader2, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useInvoices } from '@/hooks/useInvoices';
import { useProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { Invoice, InvoiceStatus } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useCallback } from 'react';

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground' },
  sent: { label: 'Sent', color: 'bg-primary/10 text-primary' },
  paid: { label: 'Paid', color: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelled', color: 'bg-destructive/10 text-destructive' },
  voided: { label: 'Voided', color: 'bg-muted text-muted-foreground' },
};

export default function Invoices() {
  const navigate = useNavigate();
  const { data: invoices = [], isLoading } = useInvoices();
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();

  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredInvoices = useMemo(
    () => statusFilter === 'all' ? invoices : invoices.filter(inv => inv.status === statusFilter),
    [invoices, statusFilter]
  );

  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);

  const getProjectName = useCallback(
    (projectId: string) => projectMap.get(projectId)?.name || 'Unknown',
    [projectMap]
  );
  const getClientName = useCallback((projectId: string) => {
    const project = projectMap.get(projectId);
    return project ? clientMap.get(project.client_id)?.name || 'No client' : 'No client';
  }, [projectMap, clientMap]);

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
        <Button className="gap-2" onClick={() => navigate('/invoices/new')}>
          <Plus className="h-4 w-4" />New Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Drafts</p>
                <p className="text-2xl font-bold text-foreground">{stats.draft}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <DollarSign className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Unpaid</p>
                <p className="text-2xl font-bold text-foreground">${stats.unpaid.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Collected</p>
                <p className="text-2xl font-bold text-foreground">${stats.paid.toLocaleString()}</p>
              </div>
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

      {/* Invoice Table */}
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
                <TableRow
                  key={invoice.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors duration-150"
                  onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
                >
                  <TableCell className="font-medium">
                    {invoice.invoice_number ? `#${invoice.invoice_number}` : `#${invoice.id.slice(0, 8)}`}
                  </TableCell>
                  <TableCell>{getProjectName(invoice.project_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{getClientName(invoice.project_id)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_CONFIG[invoice.status as InvoiceStatus]?.color}>
                      {STATUS_CONFIG[invoice.status as InvoiceStatus]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary">
                    ${Number(invoice.total).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); navigate(`/invoices/${invoice.id}/edit`); }}
                    >
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
    </div>
  );
}
