export type AppRole = 'admin' | 'employee';

export interface Employee {
  id_employee: string;
  employee_name: string;
  employee_email: string;
  home_state: string | null;
  home_country: string | null;
  role: AppRole;
  hourly_rate: number | null;
}

export interface Client {
  primary_id_client: string;
  second_id_client: string;
  client_name: string;
  contact_name: string | null;
  contact_title: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_postal_code: number | null;
  billing_country: string | null;
  active: boolean;
}

export interface Project {
  id_project: string;
  id_client: string;
  project_name: string;
  billable_default: boolean;
  hourly_rate: number | null;
  active: boolean;
}

export interface TimeEntry {
  id_hours: string;
  id_employee: string;
  id_project: string;
  id_client: string;
  week_start: string;
  total_hours: number;
  billable: boolean;
  location_type: string;
  location_value: string | null;
  is_split_month: boolean;
  month_a_hours: number | null;
  month_b_hours: number | null;
  created_at: string;
}

export interface Week {
  week_start: string;
  week_end: string;
  week_number: number;
  year_number: number;
  is_split_month: boolean;
  month_a_key: number | null;
  month_b_key: number | null;
  qty_days_a: number | null;
  qty_days_b: number | null;
}

export interface AssignedProject {
  id: string;
  employee_id: string;
  project_id: string;
  client_id: string;
  active: boolean;
}

export interface AssignedProjectWithDetails extends AssignedProject {
  project_name: string;
  client_name: string;
}
