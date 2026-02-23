import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ProjectRole } from '@/types';

export function useProjectRoles(projectId?: string) {
  return useQuery({
    queryKey: ['project-roles', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_roles')
        .select('*')
        .eq('project_id', projectId!)
        .order('name');
      if (error) throw error;
      return data as ProjectRole[];
    },
  });
}

export function useCreateProjectRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (role: { project_id: string; name: string; hourly_rate_usd: number }) => {
      const { data, error } = await supabase
        .from('project_roles')
        .insert(role)
        .select()
        .single();
      if (error) throw error;
      return data as ProjectRole;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-roles'] });
    },
  });
}

export function useUpdateProjectRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ProjectRole> }) => {
      const { data, error } = await supabase
        .from('project_roles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ProjectRole;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-roles'] });
    },
  });
}

export function useDeleteProjectRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_roles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-roles'] });
    },
  });
}
