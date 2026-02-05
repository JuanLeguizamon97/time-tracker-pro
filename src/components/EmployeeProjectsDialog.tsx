import { useState, useEffect } from 'react';
import { Loader2, FolderKanban } from 'lucide-react';
import { useActiveProjects } from '@/hooks/useProjects';
import { useEmployeeProjects, useBulkAssignProjects } from '@/hooks/useEmployeeProjects';
import { useAuth } from '@/contexts/AuthContext';
import { Profile } from '@/types';
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
  employee: Profile | null;
}

export function EmployeeProjectsDialog({ open, onOpenChange, employee }: EmployeeProjectsDialogProps) {
  const { user } = useAuth();
  const { data: projects = [], isLoading: projectsLoading } = useActiveProjects();
  const { data: employeeProjects = [], isLoading: assignmentsLoading } = useEmployeeProjects();
  const bulkAssign = useBulkAssignProjects();
  
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  useEffect(() => {
    if (employee && employeeProjects.length >= 0) {
      const assigned = employeeProjects
        .filter(ep => ep.user_id === employee.user_id)
        .map(ep => ep.project_id);
      setSelectedProjects(assigned);
    }
  }, [employee, employeeProjects]);

  const handleToggleProject = (projectId: string) => {
    setSelectedProjects(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const handleSave = async () => {
    if (!employee || !user) return;

    try {
      await bulkAssign.mutateAsync({
        userId: employee.user_id,
        projectIds: selectedProjects,
        assignedBy: user.id,
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
            Selecciona los proyectos para {employee?.name}
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
                <div key={project.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <Checkbox
                    id={project.id}
                    checked={selectedProjects.includes(project.id)}
                    onCheckedChange={() => handleToggleProject(project.id)}
                  />
                  <Label htmlFor={project.id} className="flex-1 cursor-pointer">
                    <span className="font-medium">{project.name}</span>
                    {project.clients && (
                      <p className="text-xs text-muted-foreground">{project.clients.name}</p>
                    )}
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
