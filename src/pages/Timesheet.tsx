import { useState, useMemo } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight, Plus, Save } from 'lucide-react';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Timesheet() {
  const { employees, projects, timeEntries, addTimeEntry, updateTimeEntry } = useData();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(employees[0]?.id || '');
  const [newEntries, setNewEntries] = useState<Record<string, Record<string, number>>>({});

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const activeProjects = projects.filter(p => p.isActive);
  const activeEmployees = employees.filter(e => e.isActive);

  const weekEntries = useMemo(() => {
    return timeEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entry.employeeId === selectedEmployeeId &&
        entryDate >= weekStart &&
        entryDate < addDays(weekStart, 7);
    });
  }, [timeEntries, selectedEmployeeId, weekStart]);

  const getHoursForDay = (projectId: string, date: Date): number => {
    const dateKey = format(date, 'yyyy-MM-dd');
    if (newEntries[projectId]?.[dateKey] !== undefined) {
      return newEntries[projectId][dateKey];
    }
    const entry = weekEntries.find(e => 
      e.projectId === projectId && isSameDay(new Date(e.date), date)
    );
    return entry?.hours || 0;
  };

  const handleHoursChange = (projectId: string, date: Date, hours: number) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setNewEntries(prev => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        [dateKey]: hours,
      },
    }));
  };

  const getTotalForDay = (date: Date): number => {
    return activeProjects.reduce((sum, project) => sum + getHoursForDay(project.id, date), 0);
  };

  const getTotalForProject = (projectId: string): number => {
    return weekDays.reduce((sum, day) => sum + getHoursForDay(projectId, day), 0);
  };

  const getTotalWeek = (): number => {
    return weekDays.reduce((sum, day) => sum + getTotalForDay(day), 0);
  };

  const handleSave = () => {
    Object.entries(newEntries).forEach(([projectId, dates]) => {
      Object.entries(dates).forEach(([dateKey, hours]) => {
        if (hours > 0) {
          const existingEntry = weekEntries.find(e => 
            e.projectId === projectId && format(new Date(e.date), 'yyyy-MM-dd') === dateKey
          );
          if (existingEntry) {
            updateTimeEntry(existingEntry.id, { hours });
          } else {
            addTimeEntry({
              employeeId: selectedEmployeeId,
              projectId,
              date: new Date(dateKey),
              hours,
            });
          }
        }
      });
    });
    setNewEntries({});
    toast.success('Horas guardadas correctamente');
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setSelectedDate(prev => addDays(prev, direction === 'prev' ? -7 : 7));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Registro Semanal</h1>
          <p className="text-muted-foreground">Registra las horas trabajadas por proyecto</p>
        </div>
        <Button onClick={handleSave} className="gap-2">
          <Save className="h-4 w-4" />
          Guardar Cambios
        </Button>
      </div>

      <Card className="card-elevated">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateWeek('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2 min-w-[200px]">
                    <CalendarIcon className="h-4 w-4" />
                    {format(weekStart, "'Semana del' d 'de' MMMM", { locale: es })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              <Button variant="outline" size="icon" onClick={() => navigateWeek('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Seleccionar empleado" />
              </SelectTrigger>
              <SelectContent>
                {activeEmployees.map(employee => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="table-header text-left py-3 px-2 min-w-[180px]">Proyecto</th>
                  {weekDays.map(day => (
                    <th key={day.toString()} className="table-header text-center py-3 px-2 min-w-[80px]">
                      <div className="flex flex-col">
                        <span>{format(day, 'EEE', { locale: es })}</span>
                        <span className="text-foreground font-semibold">{format(day, 'd')}</span>
                      </div>
                    </th>
                  ))}
                  <th className="table-header text-center py-3 px-2 min-w-[80px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {activeProjects.map(project => (
                  <tr key={project.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-2">
                      <span className="font-medium text-foreground">{project.name}</span>
                    </td>
                    {weekDays.map(day => (
                      <td key={day.toString()} className="py-3 px-2 text-center">
                        <Input
                          type="number"
                          min="0"
                          max="24"
                          step="0.5"
                          value={getHoursForDay(project.id, day) || ''}
                          onChange={(e) => handleHoursChange(project.id, day, parseFloat(e.target.value) || 0)}
                          className="time-input"
                        />
                      </td>
                    ))}
                    <td className="py-3 px-2 text-center">
                      <span className="font-semibold text-primary">{getTotalForProject(project.id)}h</span>
                    </td>
                  </tr>
                ))}
                <tr className="bg-muted/50">
                  <td className="py-3 px-2 font-semibold text-foreground">Total Diario</td>
                  {weekDays.map(day => (
                    <td key={day.toString()} className="py-3 px-2 text-center">
                      <span className="font-semibold text-foreground">{getTotalForDay(day)}h</span>
                    </td>
                  ))}
                  <td className="py-3 px-2 text-center">
                    <span className="font-bold text-lg text-primary">{getTotalWeek()}h</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
