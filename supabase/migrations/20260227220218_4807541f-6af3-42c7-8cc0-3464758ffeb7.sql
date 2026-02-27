
-- 1) Add manager fields to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS manager_name text,
  ADD COLUMN IF NOT EXISTS manager_email text,
  ADD COLUMN IF NOT EXISTS manager_phone text;

-- 2) Add invoice metadata fields
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS issue_date date,
  ADD COLUMN IF NOT EXISTS due_date date;

-- 3) Manual people lines table
CREATE TABLE public.invoice_manual_lines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  hours numeric NOT NULL DEFAULT 0,
  rate_usd numeric NOT NULL DEFAULT 0,
  description text,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_manual_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read invoice_manual_lines" ON public.invoice_manual_lines FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write invoice_manual_lines" ON public.invoice_manual_lines FOR ALL USING (true) WITH CHECK (true);

-- 4) Additional fees table
CREATE TABLE public.invoice_fees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  label text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price_usd numeric NOT NULL DEFAULT 0,
  description text,
  fee_total numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read invoice_fees" ON public.invoice_fees FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write invoice_fees" ON public.invoice_fees FOR ALL USING (true) WITH CHECK (true);

-- 5) Fee attachments table
CREATE TABLE public.invoice_fee_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fee_id uuid NOT NULL REFERENCES public.invoice_fees(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_fee_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous read invoice_fee_attachments" ON public.invoice_fee_attachments FOR SELECT USING (true);
CREATE POLICY "Allow anonymous write invoice_fee_attachments" ON public.invoice_fee_attachments FOR ALL USING (true) WITH CHECK (true);

-- 6) Storage bucket for fee attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('invoice-attachments', 'invoice-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read invoice attachments" ON storage.objects FOR SELECT USING (bucket_id = 'invoice-attachments');
CREATE POLICY "Anyone can upload invoice attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'invoice-attachments');
CREATE POLICY "Anyone can delete invoice attachments" ON storage.objects FOR DELETE USING (bucket_id = 'invoice-attachments');
