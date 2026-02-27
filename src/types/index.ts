export type AppRole = 'admin' | 'employee';

export interface Employee {
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

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  manager_name: string | null;
  manager_email: string | null;
  manager_phone: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_internal: boolean;
  created_at: string;
}

export interface ProjectRole {
  id: string;
  project_id: string;
  name: string;
  hourly_rate_usd: number;
  created_at: string;
}

export type TimeEntryStatus = 'normal' | 'on_hold';

export interface TimeEntry {
  id: string;
  user_id: string;
  project_id: string;
  role_id: string | null;
  date: string;
  hours: number;
  billable: boolean;
  notes: string | null;
  status: TimeEntryStatus;
  created_at: string;
}

export interface EmployeeProject {
  id: string;
  user_id: string;
  project_id: string;
  role_id: string | null;
  assigned_at: string;
  assigned_by: string | null;
}

export interface EmployeeProjectWithDetails extends EmployeeProject {
  project_name: string;
  client_name: string;
  client_id: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'cancelled' | 'voided';

export interface Invoice {
  id: string;
  project_id: string;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  total: number;
  notes: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceManualLine {
  id: string;
  invoice_id: string;
  person_name: string;
  hours: number;
  rate_usd: number;
  description: string | null;
  line_total: number;
  created_at: string;
}

export interface InvoiceFee {
  id: string;
  invoice_id: string;
  label: string;
  quantity: number;
  unit_price_usd: number;
  description: string | null;
  fee_total: number;
  created_at: string;
}

export interface InvoiceFeeAttachment {
  id: string;
  fee_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  created_at: string;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  user_id: string;
  employee_name: string;
  role_name: string | null;
  hours: number;
  rate_snapshot: number;
  amount: number;
  created_at: string;
}

export interface InvoiceTimeEntry {
  id: string;
  invoice_id: string;
  time_entry_id: string;
  created_at: string;
}
