
-- Add permissive SELECT policies for anonymous/unauthenticated access (demo mode)
CREATE POLICY "Allow anonymous read clients" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read time_entries" ON public.time_entries FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read employee_projects" ON public.employee_projects FOR SELECT USING (true);
CREATE POLICY "Allow anonymous read user_roles" ON public.user_roles FOR SELECT USING (true);

-- Allow anonymous insert/update/delete for demo
CREATE POLICY "Allow anonymous write clients" ON public.clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous write projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous write profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous write time_entries" ON public.time_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous write employee_projects" ON public.employee_projects FOR ALL USING (true) WITH CHECK (true);
