import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { InvoiceManualLine, InvoiceFee, InvoiceFeeAttachment } from '@/types';

// Manual People Lines
export function useInvoiceManualLines(invoiceId?: string) {
  return useQuery({
    queryKey: ['invoice-manual-lines', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_manual_lines')
        .select('*')
        .eq('invoice_id', invoiceId!);
      if (error) throw error;
      return data as InvoiceManualLine[];
    },
  });
}

export function useCreateInvoiceManualLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (line: Omit<InvoiceManualLine, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('invoice_manual_lines')
        .insert(line)
        .select()
        .single();
      if (error) throw error;
      return data as InvoiceManualLine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-manual-lines'] });
    },
  });
}

export function useUpdateInvoiceManualLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InvoiceManualLine> }) => {
      const { data, error } = await supabase
        .from('invoice_manual_lines')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as InvoiceManualLine;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-manual-lines'] });
    },
  });
}

export function useDeleteInvoiceManualLine() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoice_manual_lines').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-manual-lines'] });
    },
  });
}

// Invoice Fees
export function useInvoiceFees(invoiceId?: string) {
  return useQuery({
    queryKey: ['invoice-fees', invoiceId],
    enabled: !!invoiceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_fees')
        .select('*')
        .eq('invoice_id', invoiceId!);
      if (error) throw error;
      return data as InvoiceFee[];
    },
  });
}

export function useCreateInvoiceFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (fee: Omit<InvoiceFee, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('invoice_fees')
        .insert(fee)
        .select()
        .single();
      if (error) throw error;
      return data as InvoiceFee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-fees'] });
    },
  });
}

export function useUpdateInvoiceFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<InvoiceFee> }) => {
      const { data, error } = await supabase
        .from('invoice_fees')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as InvoiceFee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-fees'] });
    },
  });
}

export function useDeleteInvoiceFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('invoice_fees').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-fees'] });
    },
  });
}

// Fee Attachments
export function useInvoiceFeeAttachments(feeId?: string) {
  return useQuery({
    queryKey: ['invoice-fee-attachments', feeId],
    enabled: !!feeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_fee_attachments')
        .select('*')
        .eq('fee_id', feeId!);
      if (error) throw error;
      return data as InvoiceFeeAttachment[];
    },
  });
}

export function useCreateFeeAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attachment: Omit<InvoiceFeeAttachment, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('invoice_fee_attachments')
        .insert(attachment)
        .select()
        .single();
      if (error) throw error;
      return data as InvoiceFeeAttachment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-fee-attachments'] });
    },
  });
}

export function useDeleteFeeAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fileUrl }: { id: string; fileUrl: string }) => {
      // Delete from storage
      const path = fileUrl.split('/invoice-attachments/')[1];
      if (path) {
        await supabase.storage.from('invoice-attachments').remove([path]);
      }
      // Delete record
      const { error } = await supabase.from('invoice_fee_attachments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-fee-attachments'] });
    },
  });
}
