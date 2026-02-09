import { useState, useEffect } from 'react';
import { Loader2, FolderKanban } from 'lucide-react';
import { useActiveProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { useAssignedProjects, useBulkAssignProjects } from '@/hooks/useAssignedProjects';
import { Employee } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface EmployeeProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
}

export function EmployeeProjectsDialog({ open, onOpenChange, employee }: EmployeeProjectsDialogProps) {
  const { data: projects = [], isLoading: projectsLoading } = useActiveProjects();
  const { data: clients = [] } = useClients();
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignedProjects();
  const bulkAssign = useBulkAssignProjects();

  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  useEffect(() => {
    if (employee) {
      const assigned = assignments
        .filter(a => a.employee_id === employee.id_employee)
        .map(a => a.project_id);
      setSelectedProjects(assigned);
    }
  }, [employee, assignments]);

  const handleToggleProject = (projectId: string) => {
    setSelectedProjects(prev =>
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };

  const getClientName = (clientId: string) => {
    return clients.find(c => c.second_id_client === clientId)?.client_name || '';
  };

  const handleSave = async () => {
    if (!employee) return;

    try {
      const assignmentItems = selectedProjects.map(projectId => {
        const project = projects.find(p => p.id_project === projectId);
        return {
          project_id: projectId,
          client_id: project?.id_client || '',
        };
      });

      await bulkAssign.mutateAsync({
        employeeId: employee.id_employee,
        assignments: assignmentItems,
      });
      toast.success('Proyectos asignados correctamente');
      onOpenChange(false);
    } catch (error) {
      toast.error('Error al asignar proyectos');
      console.error(error);
    }
  };

  const isLoading = projectsLoading || assignmentsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            Asignar Proyectos
          </DialogTitle>
          <DialogDescription>
            Selecciona los proyectos para {employee?.employee_name}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="max-h-[300px] overflow-y-auto space-y-3 py-4">
            {projects.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No hay proyectos activos disponibles
              </p>
            ) : (
              projects.map(project => (
                <div
                  key={project.id_project}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                >
                  <Checkbox
                    id={project.id_project}
                    checked={selectedProjects.includes(project.id_project)}
                    onCheckedChange={() => handleToggleProject(project.id_project)}
                  />
                  <Label htmlFor={project.id_project} className="flex-1 cursor-pointer">
                    <span className="font-medium">{project.project_name}</span>
                    <p className="text-xs text-muted-foreground">
                      {getClientName(project.id_client)}
                    </p>
                  </Label>
                </div>
              ))
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={bulkAssign.isPending}>
            {bulkAssign.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
