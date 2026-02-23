import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Invoice, InvoiceLine, InvoiceTimeEntry, InvoiceStatus } from '@/types';

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });
}

export function useInvoicesByProject(projectId?: string) {
  return useQuery({
    queryKey: ['invoices', 'project', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
  });
}

export function useInvoiceLines(invoiceId?: string) {
  return useQuery({
    queryKey: ['invoice-lines', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_lines')
        .select('*')
        .eq('invoice_id', invoiceId!);
      if (error) throw error;
      return data as InvoiceLine[];
    },
  });
}

export function useInvoiceTimeEntries(invoiceId?: string) {
  return useQuery({
    queryKey: ['invoice-time-entries', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_time_entries')
        .select('*')
        .eq('invoice_id', invoiceId!);
      if (error) throw error;
      return data as InvoiceTimeEntry[];
    },
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoice: { project_id: string; notes?: string }) => {
      const { data, error } = await supabase
        .from('invoices')
        .insert({ project_id: invoice.project_id, notes: invoice.notes || null, status: 'draft' })
        .select()
        .single();
      if (error) throw error;
      return data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Invoice> }) => {
      const { data, error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function useCreateInvoiceLines() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lines: Omit<InvoiceLine, 'id' | 'created_at'>[]) => {
      const { data, error } = await supabase
        .from('invoice_lines')
        .insert(lines)
        .select();
      if (error) throw error;
      return data as InvoiceLine[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-lines'] });
    },
  });
}

export function useUpdateInvoiceLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InvoiceLine> }) => {
      const { data, error } = await supabase
        .from('invoice_lines')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as InvoiceLine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-lines'] });
    },
  });
}

export function useDeleteInvoiceLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoice_lines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-lines'] });
    },
  });
}

export function useLinkTimeEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entries: { invoice_id: string; time_entry_id: string }[]) => {
      const { data, error } = await supabase
        .from('invoice_time_entries')
        .insert(entries)
        .select();
      if (error) throw error;
      return data as InvoiceTimeEntry[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-time-entries'] });
    },
  });
}
