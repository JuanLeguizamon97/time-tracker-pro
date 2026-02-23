
-- Add is_internal flag to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

-- Add billable, notes, status fields to time_entries
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS billable boolean NOT NULL DEFAULT true;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'normal';
-- status: 'normal', 'on_hold'

-- Create project_roles table (project-specific roles with rates)
CREATE TABLE public.project_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  hourly_rate_usd numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read project_roles" ON public.project_roles FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write project_roles" ON public.project_roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admins can manage project_roles" ON public.project_roles FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated users can view project_roles" ON public.project_roles FOR SELECT USING (true);

-- Add role_id to employee_projects for role assignment
ALTER TABLE public.employee_projects ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.project_roles(id) ON DELETE SET NULL;

-- Create invoice_status enum-like check via text
-- Statuses: draft, sent, paid, cancelled, voided

-- Create invoices table
CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft',
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read invoices" ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admins can manage invoices" ON public.invoices FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can view invoices" ON public.invoices FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Create invoice_lines table (aggregated employee lines for editing)
CREATE TABLE public.invoice_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  employee_name text NOT NULL,
  role_name text,
  hours numeric NOT NULL DEFAULT 0,
  rate_snapshot numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read invoice_lines" ON public.invoice_lines FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write invoice_lines" ON public.invoice_lines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admins can manage invoice_lines" ON public.invoice_lines FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Create invoice_time_entries junction (tracks which entries are in which invoice)
CREATE TABLE public.invoice_time_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  time_entry_id uuid NOT NULL REFERENCES public.time_entries(id) ON DELETE RESTRICT,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(invoice_id, time_entry_id)
);

ALTER TABLE public.invoice_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read invoice_time_entries" ON public.invoice_time_entries FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write invoice_time_entries" ON public.invoice_time_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Admins can manage invoice_time_entries" ON public.invoice_time_entries FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for invoices updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
