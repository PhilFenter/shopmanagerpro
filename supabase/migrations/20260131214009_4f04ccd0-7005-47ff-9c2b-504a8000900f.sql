-- Create storage bucket for job photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-photos', 'job-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for job photos
CREATE POLICY "Authenticated users can upload job photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can view job photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update their uploads"
ON storage.objects FOR UPDATE
USING (bucket_id = 'job-photos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete job photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'job-photos' AND has_role(auth.uid(), 'admin'));

-- Create job_photos table to track photo metadata
CREATE TABLE public.job_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  filename text NOT NULL,
  description text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;

-- RLS policies for job_photos
CREATE POLICY "Authenticated users can view job photos"
ON public.job_photos FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload job photos"
ON public.job_photos FOR INSERT
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Admins can delete job photos"
ON public.job_photos FOR DELETE
USING (has_role(auth.uid(), 'admin'));