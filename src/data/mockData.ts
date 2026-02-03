import { Employee, Client, Project, TimeEntry } from '@/types';

export const mockEmployees: Employee[] = [
  { id: '1', name: 'Carlos García', email: 'carlos@empresa.com', rate: 45, isActive: true, createdAt: new Date('2024-01-15') },
  { id: '2', name: 'María López', email: 'maria@empresa.com', rate: 55, isActive: true, createdAt: new Date('2024-02-01') },
  { id: '3', name: 'Juan Martínez', email: 'juan@empresa.com', rate: 40, isActive: true, createdAt: new Date('2024-03-10') },
  { id: '4', name: 'Ana Rodríguez', email: 'ana@empresa.com', rate: 50, isActive: false, createdAt: new Date('2023-11-20') },
];

export const mockClients: Client[] = [
  { id: '1', name: 'TechCorp S.A.', email: 'contacto@techcorp.com', phone: '+34 912 345 678', isActive: true, createdAt: new Date('2024-01-01') },
  { id: '2', name: 'Innovate Labs', email: 'info@innovatelabs.com', phone: '+34 923 456 789', isActive: true, createdAt: new Date('2024-02-15') },
  { id: '3', name: 'Global Services', email: 'admin@globalservices.com', isActive: true, createdAt: new Date('2024-03-01') },
];

export const mockProjects: Project[] = [
  { id: '1', name: 'Portal Web Corporativo', clientId: '1', description: 'Desarrollo del portal web principal', isActive: true, createdAt: new Date('2024-01-10') },
  { id: '2', name: 'App Móvil E-commerce', clientId: '1', description: 'Aplicación móvil para ventas', isActive: true, createdAt: new Date('2024-02-01') },
  { id: '3', name: 'Sistema CRM', clientId: '2', description: 'Sistema de gestión de clientes', isActive: true, createdAt: new Date('2024-02-20') },
  { id: '4', name: 'Dashboard Analytics', clientId: '2', description: 'Panel de análisis de datos', isActive: true, createdAt: new Date('2024-03-05') },
  { id: '5', name: 'API Integration', clientId: '3', description: 'Integración con servicios externos', isActive: true, createdAt: new Date('2024-03-15') },
];

export const mockTimeEntries: TimeEntry[] = [
  { id: '1', employeeId: '1', projectId: '1', date: new Date('2026-01-27'), hours: 8, description: 'Desarrollo frontend', createdAt: new Date() },
  { id: '2', employeeId: '1', projectId: '1', date: new Date('2026-01-28'), hours: 7, description: 'Testing', createdAt: new Date() },
  { id: '3', employeeId: '1', projectId: '2', date: new Date('2026-01-29'), hours: 6, description: 'Diseño UI', createdAt: new Date() },
  { id: '4', employeeId: '2', projectId: '3', date: new Date('2026-01-27'), hours: 8, description: 'Backend API', createdAt: new Date() },
  { id: '5', employeeId: '2', projectId: '3', date: new Date('2026-01-28'), hours: 8, description: 'Database design', createdAt: new Date() },
  { id: '6', employeeId: '3', projectId: '4', date: new Date('2026-01-27'), hours: 5, description: 'Data analysis', createdAt: new Date() },
  { id: '7', employeeId: '3', projectId: '5', date: new Date('2026-01-28'), hours: 7, description: 'API integration', createdAt: new Date() },
];
