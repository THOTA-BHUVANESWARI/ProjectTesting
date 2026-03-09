-- Fix function search_path for update_updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Attach the trigger to the interviews table
CREATE TRIGGER trigger_update_interviews_updated
BEFORE UPDATE ON public.interviews
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();