import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Employee, Client, Project, TimeEntry } from '@/types';
import { mockEmployees, mockClients, mockProjects, mockTimeEntries } from '@/data/mockData';

interface DataContextType {
  employees: Employee[];
  clients: Client[];
  projects: Project[];
  timeEntries: TimeEntry[];
  addEmployee: (employee: Omit<Employee, 'id' | 'createdAt'>) => void;
  updateEmployee: (id: string, employee: Partial<Employee>) => void;
  addClient: (client: Omit<Client, 'id' | 'createdAt'>) => void;
  updateClient: (id: string, client: Partial<Client>) => void;
  addProject: (project: Omit<Project, 'id' | 'createdAt'>) => void;
  updateProject: (id: string, project: Partial<Project>) => void;
  addTimeEntry: (entry: Omit<TimeEntry, 'id' | 'createdAt'>) => void;
  updateTimeEntry: (id: string, entry: Partial<TimeEntry>) => void;
  deleteTimeEntry: (id: string) => void;
  getProjectsByClient: (clientId: string) => Project[];
  getTimeEntriesByEmployee: (employeeId: string) => TimeEntry[];
  getTimeEntriesByProject: (projectId: string) => TimeEntry[];
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>(mockEmployees);
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(mockTimeEntries);

  const addEmployee = (employee: Omit<Employee, 'id' | 'createdAt'>) => {
    const newEmployee: Employee = {
      ...employee,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    setEmployees([...employees, newEmployee]);
  };

  const updateEmployee = (id: string, updates: Partial<Employee>) => {
    setEmployees(employees.map(e => e.id === id ? { ...e, ...updates } : e));
  };

  const addClient = (client: Omit<Client, 'id' | 'createdAt'>) => {
    const newClient: Client = {
      ...client,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    setClients([...clients, newClient]);
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients(clients.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const addProject = (project: Omit<Project, 'id' | 'createdAt'>) => {
    const newProject: Project = {
      ...project,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    setProjects([...projects, newProject]);
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    setProjects(projects.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const addTimeEntry = (entry: Omit<TimeEntry, 'id' | 'createdAt'>) => {
    const newEntry: TimeEntry = {
      ...entry,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    setTimeEntries([...timeEntries, newEntry]);
  };

  const updateTimeEntry = (id: string, updates: Partial<TimeEntry>) => {
    setTimeEntries(timeEntries.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteTimeEntry = (id: string) => {
    setTimeEntries(timeEntries.filter(t => t.id !== id));
  };

  const getProjectsByClient = (clientId: string) => {
    return projects.filter(p => p.clientId === clientId);
  };

  const getTimeEntriesByEmployee = (employeeId: string) => {
    return timeEntries.filter(t => t.employeeId === employeeId);
  };

  const getTimeEntriesByProject = (projectId: string) => {
    return timeEntries.filter(t => t.projectId === projectId);
  };

  return (
    <DataContext.Provider value={{
      employees,
      clients,
      projects,
      timeEntries,
      addEmployee,
      updateEmployee,
      addClient,
      updateClient,
      addProject,
      updateProject,
      addTimeEntry,
      updateTimeEntry,
      deleteTimeEntry,
      getProjectsByClient,
      getTimeEntriesByEmployee,
      getTimeEntriesByProject,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
