import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AssignedProject, AssignedProjectWithDetails } from '@/types';

export function useAssignedProjects(employeeId?: string) {
  const qs = employeeId ? `?employee_id=${employeeId}` : '';
  return useQuery({
    queryKey: ['assigned-projects', employeeId],
    queryFn: () => api.get<AssignedProject[]>(`/assigned-projects/${qs}`),
  });
}

export function useAssignedProjectsWithDetails(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['assigned-projects', 'details', employeeId],
    queryFn: () =>
      api.get<AssignedProjectWithDetails[]>(`/assigned-projects/employee/${employeeId}`),
    enabled: !!employeeId,
  });
}

export function useBulkAssignProjects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      employeeId,
      assignments,
    }: {
      employeeId: string;
      assignments: { project_id: string; client_id: string }[];
    }) => {
      return api.put<AssignedProject[]>(
        `/assigned-projects/employee/${employeeId}/bulk`,
        { assignments }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assigned-projects'] });
    },
  });
}
