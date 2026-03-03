import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Invoice, InvoiceLine, InvoiceTimeEntry } from '@/types';

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: () => api.get<Invoice[]>('/invoices'),
  });
}

export function useInvoicesByProject(projectId?: string) {
  return useQuery({
    queryKey: ['invoices', 'project', projectId],
    enabled: !!projectId,
    queryFn: () => api.get<Invoice[]>(`/invoices?project_id=${projectId}`),
  });
}

export function useInvoiceLines(invoiceId?: string) {
  return useQuery({
    queryKey: ['invoice-lines', invoiceId],
    enabled: !!invoiceId,
    queryFn: () => api.get<InvoiceLine[]>(`/invoice-lines?invoice_id=${invoiceId}`),
  });
}

export function useInvoiceTimeEntries(invoiceId?: string) {
  return useQuery({
    queryKey: ['invoice-time-entries', invoiceId],
    enabled: !!invoiceId,
    queryFn: () => api.get<InvoiceTimeEntry[]>(`/invoice-time-entries?invoice_id=${invoiceId}`),
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invoice: { project_id: string; notes?: string }) =>
      api.post<Invoice>('/invoices', { project_id: invoice.project_id, notes: invoice.notes || null, status: 'draft' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Invoice> }) =>
      api.put<Invoice>(`/invoices/${id}`, updates),
    onSuccess: (updatedInvoice) => {
      queryClient.setQueryData<Invoice[]>(['invoices'], old =>
        old ? old.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv) : old
      );
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useCreateInvoiceLines() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lines: Omit<InvoiceLine, 'id' | 'created_at'>[]) =>
      api.post<InvoiceLine[]>('/invoice-lines/bulk', lines),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-lines'] });
    },
  });
}

export function useUpdateInvoiceLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<InvoiceLine> }) =>
      api.put<InvoiceLine>(`/invoice-lines/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-lines'] });
    },
  });
}

export function useDeleteInvoiceLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/invoice-lines/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-lines'] });
    },
  });
}

export function useLinkTimeEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entries: { invoice_id: string; time_entry_ids: string[] }) =>
      api.post<InvoiceTimeEntry[]>('/invoice-time-entries/bulk', entries),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-time-entries'] });
    },
  });
}
