import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { TimeEntry } from '@/types';
import { format } from 'date-fns';

export function useTimeEntriesByWeek(weekStart: Date, employeeId?: string) {
  const ws = format(weekStart, 'yyyy-MM-dd');
  return useQuery({
    queryKey: ['time-entries', 'week', ws, employeeId],
    queryFn: () => {
      const params = new URLSearchParams({ week_start: ws });
      if (employeeId) params.set('id_employee', employeeId);
      return api.get<TimeEntry[]>(`/time-entries/?${params.toString()}`);
    },
  });
}

export function useTimeEntriesByDateRange(startDate: Date, endDate: Date, employeeId?: string) {
  const gte = format(startDate, 'yyyy-MM-dd');
  const lte = format(endDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['time-entries', 'range', gte, lte, employeeId],
    queryFn: () => {
      const params = new URLSearchParams({ week_start_gte: gte, week_start_lte: lte });
      if (employeeId) params.set('id_employee', employeeId);
      return api.get<TimeEntry[]>(`/time-entries/?${params.toString()}`);
    },
  });
}

export function useAllTimeEntriesByDateRange(startDate: Date, endDate: Date) {
  const gte = format(startDate, 'yyyy-MM-dd');
  const lte = format(endDate, 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['time-entries', 'range-all', gte, lte],
    queryFn: () => {
      const params = new URLSearchParams({ week_start_gte: gte, week_start_lte: lte });
      return api.get<TimeEntry[]>(`/time-entries/?${params.toString()}`);
    },
  });
}

export function useCreateTimeEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: Omit<TimeEntry, 'id_hours' | 'created_at'>) => {
      return api.post<TimeEntry>('/time-entries/', entry);
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
      return api.put<TimeEntry>(`/time-entries/${id}`, updates);
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
      return api.delete(`/time-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-entries'] });
    },
  });
}
