export interface Employee {
  id: string;
  name: string;
  email: string;
  rate: number;
  isActive: boolean;
  createdAt: Date;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  projectId: string;
  date: Date;
  hours: number;
  description?: string;
  createdAt: Date;
}

export interface WeeklyTimesheet {
  employeeId: string;
  weekStart: Date;
  entries: TimeEntry[];
}
