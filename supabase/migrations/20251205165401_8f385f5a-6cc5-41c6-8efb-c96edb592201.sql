-- Create or replace function to handle new user role assignment
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_role_value user_role;
BEGIN
  -- Get role from user metadata, default to 'candidate' if not specified
  user_role_value := COALESCE(
    (new.raw_user_meta_data ->> 'role')::user_role, 
    'candidate'::user_role
  );
  
  -- Insert the role into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, user_role_value)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN new;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;

-- Create trigger to assign role when user is created
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();