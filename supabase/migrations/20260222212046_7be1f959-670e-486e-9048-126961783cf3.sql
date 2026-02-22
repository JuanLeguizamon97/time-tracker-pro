
-- Drop FK constraints on profiles for demo mode
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_supervisor_id_fkey;

-- Drop FK on employee_projects 
ALTER TABLE public.employee_projects DROP CONSTRAINT IF EXISTS employee_projects_user_id_fkey;

-- Drop FK on time_entries user_id
ALTER TABLE public.time_entries DROP CONSTRAINT IF EXISTS time_entries_user_id_fkey;
