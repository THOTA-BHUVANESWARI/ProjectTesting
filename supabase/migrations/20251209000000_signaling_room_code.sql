CREATE OR REPLACE FUNCTION public.generate_room_code()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT
    upper(
      chr(65 + floor(random() * 26)::int) ||
      chr(65 + floor(random() * 26)::int) ||
      chr(65 + floor(random() * 26)::int)
    ) || '-' ||
    lpad(floor(random() * 1000)::text, 3, '0');
$$;

CREATE OR REPLACE FUNCTION public.set_room_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.room_code IS NULL OR NEW.room_code = '' THEN
    LOOP
      NEW.room_code := public.generate_room_code();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.interviews WHERE room_code = NEW.room_code
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS interviews_set_room_code ON public.interviews;
CREATE TRIGGER interviews_set_room_code
  BEFORE INSERT ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.set_room_code();

DO $$
DECLARE
  r RECORD;
  code TEXT;
BEGIN
  FOR r IN 
    SELECT id FROM public.interviews 
    WHERE room_code IS NULL OR length(room_code) > 10
  LOOP
    LOOP
      code := public.generate_room_code();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.interviews WHERE room_code = code
      );
    END LOOP;
    UPDATE public.interviews SET room_code = code WHERE id = r.id;
  END LOOP;
END $$;

SELECT id, title, room_code, status FROM public.interviews;