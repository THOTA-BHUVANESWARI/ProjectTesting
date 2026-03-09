-- Add DELETE policy for interviews table
CREATE POLICY "Interviewers can delete their interviews"
ON public.interviews FOR DELETE
USING (
  interviewer_id = auth.uid() OR
  has_role(auth.uid(), 'admin'::user_role)
);