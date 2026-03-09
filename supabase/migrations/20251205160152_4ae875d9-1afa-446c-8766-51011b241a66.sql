-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('admin', 'interviewer', 'candidate');

-- Create enum for interview status
CREATE TYPE public.interview_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'candidate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Create interviews table
create extension if not exists "pgcrypto";

CREATE TABLE public.interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- in_progress, completed, etc.
  interviewer_id uuid REFERENCES profiles(id),
  candidate_id uuid REFERENCES profiles(id),
  room_code text UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create rubric_templates table
CREATE TABLE public.rubric_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create evaluations table
CREATE TABLE public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES auth.users(id),
  rubric_template_id UUID REFERENCES public.rubric_templates(id),
  scores JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  overall_rating INT CHECK (overall_rating >= 1 AND overall_rating <= 5),
  recommendation TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create feedback_notes table (timestamped feedback during interview)
CREATE TABLE public.feedback_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  evaluator_id UUID NOT NULL REFERENCES auth.users(id),
  timestamp_seconds INT NOT NULL,
  note TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create code_sessions table (for collaborative coding)
CREATE TABLE public.code_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'javascript',
  code_content TEXT NOT NULL DEFAULT '',
  problem_title TEXT,
  problem_description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
create table user_roles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  role text check (role in ('admin', 'interviewer', 'candidate')),
  created_at timestamp with time zone default now()
);
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamp with time zone default now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_sessions ENABLE ROW LEVEL SECURITY;
alter table profiles enable row level security;
alter table user_roles enable row level security;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Interviewers can view candidate profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'interviewer'));

-- User roles policies
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Interviews policies
CREATE POLICY "Users can view their interviews"
  ON public.interviews FOR SELECT
  TO authenticated
  USING (
    interviewer_id = auth.uid() OR 
    candidate_id = auth.uid() OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Interviewers and admins can create interviews"
  ON public.interviews FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'interviewer')
  );

CREATE POLICY "Interviewers can update their interviews"
  ON public.interviews FOR UPDATE
  TO authenticated
  USING (
    interviewer_id = auth.uid() OR 
    public.has_role(auth.uid(), 'admin')
  );

-- Rubric templates policies
CREATE POLICY "Anyone can view default rubrics"
  ON public.rubric_templates FOR SELECT
  TO authenticated
  USING (is_default = true OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Interviewers and admins can create rubrics"
  ON public.rubric_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'interviewer')
  );

-- Evaluations policies
CREATE POLICY "Evaluators can view their evaluations"
  ON public.evaluations FOR SELECT
  TO authenticated
  USING (
    evaluator_id = auth.uid() OR 
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Interviewers can create evaluations"
  ON public.evaluations FOR INSERT
  TO authenticated
  WITH CHECK (evaluator_id = auth.uid());

CREATE POLICY "Evaluators can update their evaluations"
  ON public.evaluations FOR UPDATE
  TO authenticated
  USING (evaluator_id = auth.uid());

-- Feedback notes policies
CREATE POLICY "Evaluators can manage their notes"
  ON public.feedback_notes FOR ALL
  TO authenticated
  USING (evaluator_id = auth.uid());

CREATE POLICY "Admins can view all notes"
  ON public.feedback_notes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Code sessions policies
CREATE POLICY "Interview participants can access code sessions"
  ON public.code_sessions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews i 
      WHERE i.id = interview_id 
      AND (i.interviewer_id = auth.uid() OR i.candidate_id = auth.uid())
    )
  );

-- Profiles: Insert
create policy "Users can insert their own profile"
on profiles
for insert
with check (auth.uid() = id);

-- Profiles: Select
create policy "Users can view their own profile"
on profiles
for select
using (auth.uid() = id);

-- Roles: Insert
create policy "Users can insert their own role"
on user_roles
for insert
with check (auth.uid() = user_id);

-- Roles: Select
create policy "Users can view their own role"
on user_roles
for select
using (auth.uid() = user_id);
-- Enable realtime for code_sessions
ALTER PUBLICATION supabase_realtime ADD TABLE public.code_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_notes;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Default role is candidate
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'candidate');
  
  RETURN NEW;
END;
$$;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Timestamp triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_interviews_updated_at
  BEFORE UPDATE ON public.interviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_evaluations_updated_at
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_code_sessions_updated_at
  BEFORE UPDATE ON public.code_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Insert default rubric template
INSERT INTO public.rubric_templates (name, description, criteria, is_default)
VALUES (
  'Technical Interview',
  'Standard technical interview rubric',
  '[
    {"name": "Problem Solving", "description": "Ability to break down problems and develop solutions", "weight": 25},
    {"name": "Code Quality", "description": "Clean, readable, and maintainable code", "weight": 20},
    {"name": "Technical Knowledge", "description": "Understanding of data structures, algorithms, and concepts", "weight": 25},
    {"name": "Communication", "description": "Ability to explain thought process clearly", "weight": 15},
    {"name": "Testing & Edge Cases", "description": "Consideration for edge cases and testing", "weight": 15}
  ]',
  true
);