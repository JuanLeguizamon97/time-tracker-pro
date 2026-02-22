import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { EmployeeProject, EmployeeProjectWithDetails } from '@/types';

export function useAssignedProjects(userId?: string) {
  return useQuery({
    queryKey: ['assigned-projects', userId],
    queryFn: async () => {
      let query = supabase.from('employee_projects').select('*');
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error) throw error;
      return data as EmployeeProject[];
    },
  });
}

export function useAssignedProjectsWithDetails(userId: string | undefined) {
  return useQuery({
    queryKey: ['assigned-projects', 'details', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_projects')
        .select(`
          *,
          projects!inner(name, client_id, clients!inner(name))
        `)
        .eq('user_id', userId!);
      if (error) throw error;

      return (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        project_id: row.project_id,
        assigned_at: row.assigned_at,
        assigned_by: row.assigned_by,
        project_name: row.projects.name,
        client_id: row.projects.client_id,
        client_name: row.projects.clients.name,
      })) as EmployeeProjectWithDetails[];
    },
    enabled: !!userId,
  });
}

export function useBulkAssignProjects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      assignments,
    }: {
      userId: string;
      assignments: { project_id: string }[];
    }) => {
      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from('employee_projects')
        .delete()
        .eq('user_id', userId);
      if (deleteError) throw deleteError;

      // Insert new ones
      if (assignments.length > 0) {
        const { data, error } = await supabase
          .from('employee_projects')
          .insert(assignments.map(a => ({ user_id: userId, project_id: a.project_id })))
          .select();
        if (error) throw error;
        return data as EmployeeProject[];
      }
      return [];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assigned-projects'] });
    },
  });
}
