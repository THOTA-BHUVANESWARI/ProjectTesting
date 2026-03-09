-- Add resume_url column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS resume_url TEXT,
ADD COLUMN IF NOT EXISTS resume_filename TEXT;

-- Create storage bucket for resumes
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Users can upload their own resume
CREATE POLICY "Users can upload own resume"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resumes' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS policy: Users can view their own resume
CREATE POLICY "Users can view own resume"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resumes' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS policy: Users can update their own resume
CREATE POLICY "Users can update own resume"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'resumes' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS policy: Users can delete their own resume
CREATE POLICY "Users can delete own resume"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resumes' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS policy: Interviewers and admins can view candidate resumes for their interviews
CREATE POLICY "Interviewers can view candidate resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resumes' AND 
  EXISTS (
    SELECT 1 FROM public.interviews i
    WHERE i.candidate_id::text = (storage.foldername(name))[1]
    AND (
      i.interviewer_id = auth.uid() OR
      has_role(auth.uid(), 'admin'::user_role)
    )
  )
);