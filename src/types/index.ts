export type AppRole = 'admin' | 'employee';

export interface Employee {
  id: string;
  user_id: string;
  name: string;
  email: string;
  hourly_rate: number;
  is_active: boolean;
  supervisor_id: string | null;
  title: string | null;
  department: string | null;
  business_unit: string | null;
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
  client_code: string | null;
  salutation: string | null;
  first_name: string | null;
  middle_initial: string | null;
  last_name: string | null;
  job_title: string | null;
  main_phone: string | null;
  work_phone: string | null;
  mobile: string | null;
  main_email: string | null;
  street_address_1: string | null;
  street_address_2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  rep: string | null;
  payment_terms: string | null;
  team_member: string | null;
  notes: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_internal: boolean;
  project_code: string | null;
  area_category: string | null;
  business_unit: string | null;
  manager_id: string | null;
  manager_name: string | null;
  referral_id: string | null;
  referral_type: string | null;
  referral_value: number | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface ProjectCategory {
  id: string;
  type: string;
  value: string;
  active: boolean;
}

export interface ProjectAssignment {
  id: string;
  user_id: string;
  employee_name: string;
  project_id: string;
  role_id: string | null;
  role_name: string | null;
  rate: number | null;
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
  cap_amount: number | null;
  notes: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceExpense {
  id: string;
  invoice_id: string;
  date: string;
  professional: string | null;
  vendor: string | null;
  description: string | null;
  category: string;
  amount_usd: number;
  payment_source: string | null;
  receipt_attached: boolean;
  notes: string | null;
  created_at: string;
}

export interface InvoiceEditLine {
  id: string;
  user_id: string;
  employee_name: string;
  title: string | null;
  role: string | null;
  hours: number;
  hourly_rate: number;
  discount_type: 'amount' | 'percent' | null;
  discount_value: number;
  amount: number;
}

export interface InvoiceEditData {
  invoice: Invoice;
  client: { id: string; name: string; email: string | null; phone: string | null } | null;
  project: { id: string; name: string; client_id: string } | null;
  lines: InvoiceEditLine[];
  expenses: InvoiceExpense[];
}

export interface InvoiceLinePatch {
  id: string;
  hours?: number;
  rate_snapshot?: number;
  discount_type?: 'amount' | 'percent' | null;
  discount_value?: number;
}

export interface InvoiceExpensePatch {
  id: string | null;
  invoice_id?: string;
  date?: string;
  professional?: string | null;
  vendor?: string | null;
  description?: string | null;
  category?: string;
  amount_usd?: number;
  payment_source?: string | null;
  receipt_attached?: boolean;
  notes?: string | null;
}

export interface InvoicePatch {
  status?: string;
  cap_amount?: number | null;
  invoice_number?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  notes?: string | null;
  lines?: InvoiceLinePatch[];
  expenses?: InvoiceExpensePatch[];
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
  discount_type: string | null;
  discount_value: number;
  created_at: string;
}

export interface InvoiceTimeEntry {
  id: string;
  invoice_id: string;
  time_entry_id: string;
  created_at: string;
}
