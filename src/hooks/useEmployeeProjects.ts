import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface EmployeeProject {
  id: string;
  user_id: string;
  project_id: string;
  assigned_at: string;
  assigned_by: string | null;
}

export function useEmployeeProjects() {
  return useQuery({
    queryKey: ['employee-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_projects')
        .select('*');
      if (error) throw error;
      return data as EmployeeProject[];
    },
  });
}

export function useEmployeeProjectsByUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['employee-projects', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('employee_projects')
        .select('*, projects(id, name, client_id, clients(name))')
        .eq('user_id', userId);
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });
}

export function useAssignProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, projectId, assignedBy }: { userId: string; projectId: string; assignedBy: string }) => {
      const { data, error } = await supabase
        .from('employee_projects')
        .insert({
          user_id: userId,
          project_id: projectId,
          assigned_by: assignedBy,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-projects'] });
    },
  });
}

export function useUnassignProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, projectId }: { userId: string; projectId: string }) => {
      const { error } = await supabase
        .from('employee_projects')
        .delete()
        .eq('user_id', userId)
        .eq('project_id', projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-projects'] });
    },
  });
}

export function useBulkAssignProjects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, projectIds, assignedBy }: { userId: string; projectIds: string[]; assignedBy: string }) => {
      // First, delete all existing assignments for this user
      await supabase
        .from('employee_projects')
        .delete()
        .eq('user_id', userId);

      // Then insert new assignments
      if (projectIds.length > 0) {
        const { error } = await supabase
          .from('employee_projects')
          .insert(
            projectIds.map(projectId => ({
              user_id: userId,
              project_id: projectId,
              assigned_by: assignedBy,
            }))
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-projects'] });
    },
  });
}
