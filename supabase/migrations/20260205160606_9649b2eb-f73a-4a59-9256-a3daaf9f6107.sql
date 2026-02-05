-- Add supervisor_id to profiles (references another profile's user_id who is admin)
ALTER TABLE public.profiles 
ADD COLUMN supervisor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create employee_projects junction table for many-to-many relationship
CREATE TABLE public.employee_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(user_id, project_id)
);

-- Enable RLS
ALTER TABLE public.employee_projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies for employee_projects
CREATE POLICY "Admins can manage employee projects"
ON public.employee_projects
FOR ALL
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all employee projects"
ON public.employee_projects
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own project assignments"
ON public.employee_projects
FOR SELECT
USING (auth.uid() = user_id);

-- Update time_entries to only allow entries for assigned projects
DROP POLICY IF EXISTS "Users can insert their own time entries" ON public.time_entries;
CREATE POLICY "Users can insert their own time entries"
ON public.time_entries
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND (
    has_role(auth.uid(), 'admin') 
    OR EXISTS (
      SELECT 1 FROM public.employee_projects 
      WHERE employee_projects.user_id = auth.uid() 
      AND employee_projects.project_id = time_entries.project_id
    )
  )
);