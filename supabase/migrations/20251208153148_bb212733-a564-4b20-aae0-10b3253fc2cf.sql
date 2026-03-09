-- Add UPDATE and DELETE policies for rubric template creators
CREATE POLICY "Creators can update their rubrics"
ON public.rubric_templates FOR UPDATE
TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Creators can delete their rubrics"
ON public.rubric_templates FOR DELETE
TO authenticated
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::user_role));