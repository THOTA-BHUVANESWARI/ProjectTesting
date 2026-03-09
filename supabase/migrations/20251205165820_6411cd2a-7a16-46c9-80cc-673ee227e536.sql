-- Drop the new trigger we just created (duplicate functionality)
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_role();

-- Update the existing handle_new_user function to use role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_role_value user_role;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Get role from user metadata, default to 'candidate' if not specified
  user_role_value := COALESCE(
    (NEW.raw_user_meta_data ->> 'role')::user_role, 
    'candidate'::user_role
  );
  
  -- Insert role from metadata (or default to candidate)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role_value);
  
  RETURN NEW;
END;
$$;