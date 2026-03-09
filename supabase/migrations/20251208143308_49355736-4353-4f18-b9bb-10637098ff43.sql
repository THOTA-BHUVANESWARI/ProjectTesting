-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Interviewers can view candidate profiles" ON public.profiles;

-- Create a properly scoped policy that only allows interviewers to view candidates in their assigned interviews
CREATE POLICY "Interviewers can view assigned candidate profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR
  has_role(auth.uid(), 'admin'::user_role) OR
  EXISTS (
    SELECT 1 FROM interviews i
    WHERE i.candidate_id = profiles.id
    AND i.interviewer_id = auth.uid()
  )
);