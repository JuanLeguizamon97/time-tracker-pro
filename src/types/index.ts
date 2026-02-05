export type AppRole = 'admin' | 'employee';

export interface EmployeeProject {
  id: string;
  user_id: string;
  project_id: string;
  assigned_at: string;
  assigned_by: string | null;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  hourly_rate: number;
  is_active: boolean;
  supervisor_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  client_id: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string;
  date: string;
  hours: number;
  created_at: string;
}

export interface ProjectWithClient extends Project {
  clients?: Client;
}

export interface TimeEntryWithDetails extends TimeEntry {
  projects?: ProjectWithClient;
  profiles?: Profile;
}
