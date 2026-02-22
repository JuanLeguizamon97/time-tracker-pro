import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TimeEntry } from '@/types';
import { format } from 'date-fns';

export function useTimeEntriesByWeek(weekStart: Date, userId?: string) {
  const ws = format(weekStart, 'yyyy-MM-dd');
  const we = format(new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['time-entries', 'week', ws, userId],
    queryFn: async () => {
      let query = supabase
        .from('time_entries')
        .select('*')
        .gte('date', ws)
        .lte('date', we);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error) throw error;
      return data as TimeEntry[];
    },
  });
}

export function useTimeEntriesByDateRange(startDate: Date, endDate: Date, userId?: string) {
  const gte = format(startDate, 'yyyy-MM-dd');
  const lte = format(endDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['time-entries', 'range', gte, lte, userId],
    queryFn: async () => {
      let query = supabase
        .from('time_entries')
        .select('*')
        .gte('date', gte)
        .lte('date', lte);
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error) throw error;
      return data as TimeEntry[];
    },
  });
}

export function useAllTimeEntriesByDateRange(startDate: Date, endDate: Date) {
  const gte = format(startDate, 'yyyy-MM-dd');
  const lte = format(endDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['time-entries', 'range-all', gte, lte],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*')
        .gte('date', gte)
        .lte('date', lte);
      if (error) throw error;
      return data as TimeEntry[];
    },
  });
}

export function useCreateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: Omit<TimeEntry, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('time_entries')
        .insert(entry)
        .select()
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    },
  });
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TimeEntry> }) => {
      const { data, error } = await supabase
        .from('time_entries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as TimeEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    },
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    },
  });
}
