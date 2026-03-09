-- Fix DELETE policy role configuration by recreating with TO authenticated
DROP POLICY IF EXISTS "Interviewers can delete their interviews" ON public.interviews;

CREATE POLICY "Interviewers can delete their interviews"
ON public.interviews FOR DELETE
TO authenticated
USING (
  interviewer_id = auth.uid() OR
  has_role(auth.uid(), 'admin'::user_role)
);