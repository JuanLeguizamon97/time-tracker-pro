import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TimeEntry, TimeEntryWithDetails } from '@/types';
import { format } from 'date-fns';

export function useTimeEntries() {
  return useQuery({
    queryKey: ['time-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_entries')
        .select('*, projects(*, clients(*))')
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as TimeEntryWithDetails[];
    },
  });
}

export function useTimeEntriesByUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['time-entries', 'user', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('time_entries')
        .select('*, projects(*, clients(*))')
        .eq('user_id', userId)
        .order('date', { ascending: false });
      
      if (error) throw error;
      return data as TimeEntryWithDetails[];
    },
    enabled: !!userId,
  });
}

export function useTimeEntriesByDateRange(startDate: Date, endDate: Date, userId?: string) {
  return useQuery({
    queryKey: ['time-entries', 'range', format(startDate, 'yyyy-MM-dd'), format(endDate, 'yyyy-MM-dd'), userId],
    queryFn: async () => {
      let query = supabase
        .from('time_entries')
        .select('*, projects(*, clients(*))')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query.order('date', { ascending: false });
      
      if (error) throw error;
      return data as TimeEntryWithDetails[];
    },
  });
}

export function useUpsertTimeEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (entry: Omit<TimeEntry, 'id' | 'created_at'>) => {
      // Check if entry already exists
      const { data: existing } = await supabase
        .from('time_entries')
        .select('id')
        .eq('user_id', entry.user_id)
        .eq('project_id', entry.project_id)
        .eq('date', entry.date)
        .maybeSingle();
      
      if (existing) {
        const { data, error } = await supabase
          .from('time_entries')
          .update({ hours: entry.hours })
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('time_entries')
          .insert(entry)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
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
