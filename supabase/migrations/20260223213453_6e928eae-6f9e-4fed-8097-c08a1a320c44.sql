
-- Add role_id to time_entries for audit linkage to project roles
ALTER TABLE public.time_entries 
ADD COLUMN role_id uuid REFERENCES public.project_roles(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_time_entries_role_id ON public.time_entries(role_id);
