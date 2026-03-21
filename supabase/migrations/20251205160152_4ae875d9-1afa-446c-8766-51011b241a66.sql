-- ============================================================
--  COMPLETE SUPABASE SCHEMA  
--  Includes: tables, RLS, functions, triggers, realtime
--  Fix: candidates can now see interviews in the lobby
-- ============================================================

-- ============================================================
--  EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
--  ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'interviewer', 'candidate');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.interview_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================
--  TABLES
-- ============================================================

-- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  resume_url       TEXT,
  resume_filename  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID      NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       user_role NOT NULL DEFAULT 'candidate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- interviews
CREATE TABLE IF NOT EXISTS public.interviews (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT        NOT NULL,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'scheduled'
                              CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  interviewer_id UUID        REFERENCES public.profiles(id),
  candidate_id   UUID        REFERENCES public.profiles(id),
  room_code      TEXT        UNIQUE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- rubric_templates
CREATE TABLE IF NOT EXISTS public.rubric_templates (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL,
  description TEXT,
  criteria    JSONB   NOT NULL DEFAULT '[]',
  created_by  UUID    REFERENCES auth.users(id),
  is_default  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- evaluations
CREATE TABLE IF NOT EXISTS public.evaluations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id        UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  evaluator_id        UUID NOT NULL REFERENCES auth.users(id),
  rubric_template_id  UUID REFERENCES public.rubric_templates(id),
  scores              JSONB NOT NULL DEFAULT '{}',
  notes               TEXT,
  overall_rating      INT  CHECK (overall_rating >= 1 AND overall_rating <= 5),
  recommendation      TEXT,
  submitted_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- feedback_notes  (timestamped during interview)
CREATE TABLE IF NOT EXISTS public.feedback_notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id     UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  evaluator_id     UUID NOT NULL REFERENCES auth.users(id),
  timestamp_seconds INT  NOT NULL,
  note             TEXT NOT NULL,
  category         TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- code_sessions  (collaborative coding)
CREATE TABLE IF NOT EXISTS public.code_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id        UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  language            TEXT NOT NULL DEFAULT 'javascript',
  code_content        TEXT NOT NULL DEFAULT '',
  problem_title       TEXT,
  problem_description TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- interview_participants  (NEW – lets candidates register for open slots)
CREATE TABLE IF NOT EXISTS public.interview_participants (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id UUID NOT NULL REFERENCES public.interviews(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT NOT NULL DEFAULT 'registered'
               CHECK (status IN ('registered', 'attended', 'no_show')),
  UNIQUE(interview_id, candidate_id)
);


-- ============================================================
--  ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rubric_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_notes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.code_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_participants ENABLE ROW LEVEL SECURITY;


-- ============================================================
--  HELPER FUNCTIONS  (SECURITY DEFINER so RLS can call them)
-- ============================================================

-- Check if a user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Return the primary role of a user
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;

-- Auto-update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Handle new user signup: create profile + assign role from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role user_role;
BEGIN
  -- Insert profile row
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );

  -- Determine role from signup metadata, default to 'candidate'
  _role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::user_role,
    'candidate'::user_role
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;


-- ============================================================
--  TRIGGERS
-- ============================================================

-- New user → profile + role
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at maintenance
DROP TRIGGER IF EXISTS update_profiles_updated_at    ON public.profiles;
DROP TRIGGER IF EXISTS update_interviews_updated_at  ON public.interviews;
DROP TRIGGER IF EXISTS update_evaluations_updated_at ON public.evaluations;
DROP TRIGGER IF EXISTS update_code_sessions_updated_at ON public.code_sessions;

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


-- ============================================================
--  RLS POLICIES – profiles
-- ============================================================
DROP POLICY IF EXISTS "Users can insert their own profile"            ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile"              ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile"            ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"                  ON public.profiles;
DROP POLICY IF EXISTS "Interviewers can view candidate profiles"      ON public.profiles;
DROP POLICY IF EXISTS "Interviewers can view assigned candidate profiles" ON public.profiles;

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Unified SELECT: own row + admin + interviewer sees their candidates
CREATE POLICY "profiles_select"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.candidate_id = profiles.id
        AND i.interviewer_id = auth.uid()
    )
  );

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());


-- ============================================================
--  RLS POLICIES – user_roles
-- ============================================================
DROP POLICY IF EXISTS "Users can view their own roles"    ON public.user_roles;
DROP POLICY IF EXISTS "Users can insert their own role"   ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role"     ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles"       ON public.user_roles;

CREATE POLICY "user_roles_insert_own"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_roles_select_own"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "user_roles_admin_all"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- ============================================================
--  RLS POLICIES – interviews
--  KEY FIX: candidates can now browse the lobby
-- ============================================================
DROP POLICY IF EXISTS "Users can view their interviews"              ON public.interviews;
DROP POLICY IF EXISTS "Interviewers and admins can create interviews" ON public.interviews;
DROP POLICY IF EXISTS "Interviewers can update their interviews"     ON public.interviews;
DROP POLICY IF EXISTS "Interviewers can delete their interviews"     ON public.interviews;
DROP POLICY IF EXISTS "Candidates can join an interview by room code" ON public.interviews;

-- SELECT: interviewer/admin see all their rows;
--         candidates see every non-cancelled, non-completed interview (the lobby)
CREATE POLICY "interviews_select"
  ON public.interviews FOR SELECT TO authenticated
  USING (
    interviewer_id = auth.uid()
    OR candidate_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'candidate')
      AND status NOT IN ('cancelled', 'completed')
    )
  );

-- INSERT: interviewers and admins only
CREATE POLICY "interviews_insert"
  ON public.interviews FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'interviewer')
  );

-- UPDATE: interviewer who owns it, or admin, or candidate claiming an open slot
CREATE POLICY "interviews_update"
  ON public.interviews FOR UPDATE TO authenticated
  USING (
    interviewer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    -- candidate can claim an unassigned scheduled slot
    OR (
      public.has_role(auth.uid(), 'candidate')
      AND status = 'scheduled'
      AND candidate_id IS NULL
    )
  )
  WITH CHECK (
    interviewer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    -- candidate can only set candidate_id to themselves
    OR (
      public.has_role(auth.uid(), 'candidate')
      AND candidate_id = auth.uid()
    )
  );

-- DELETE: interviewer who owns it, or admin
CREATE POLICY "interviews_delete"
  ON public.interviews FOR DELETE TO authenticated
  USING (
    interviewer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );


-- ============================================================
--  RLS POLICIES – interview_participants  (NEW)
-- ============================================================
CREATE POLICY "participants_insert_self"
  ON public.interview_participants FOR INSERT TO authenticated
  WITH CHECK (
    candidate_id = auth.uid()
    AND public.has_role(auth.uid(), 'candidate')
  );

CREATE POLICY "participants_select"
  ON public.interview_participants FOR SELECT TO authenticated
  USING (
    candidate_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id
        AND (i.interviewer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "participants_update_status"
  ON public.interview_participants FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id
        AND (i.interviewer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "participants_delete"
  ON public.interview_participants FOR DELETE TO authenticated
  USING (
    candidate_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );


-- ============================================================
--  RLS POLICIES – rubric_templates
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view default rubrics"           ON public.rubric_templates;
DROP POLICY IF EXISTS "Interviewers and admins can create rubrics" ON public.rubric_templates;
DROP POLICY IF EXISTS "Creators can update their rubrics"         ON public.rubric_templates;
DROP POLICY IF EXISTS "Creators can delete their rubrics"         ON public.rubric_templates;

CREATE POLICY "rubrics_select"
  ON public.rubric_templates FOR SELECT TO authenticated
  USING (
    is_default = true
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "rubrics_insert"
  ON public.rubric_templates FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'interviewer')
  );

CREATE POLICY "rubrics_update"
  ON public.rubric_templates FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "rubrics_delete"
  ON public.rubric_templates FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );


-- ============================================================
--  RLS POLICIES – evaluations
-- ============================================================
DROP POLICY IF EXISTS "Evaluators can view their evaluations"  ON public.evaluations;
DROP POLICY IF EXISTS "Interviewers can create evaluations"    ON public.evaluations;
DROP POLICY IF EXISTS "Evaluators can update their evaluations" ON public.evaluations;

CREATE POLICY "evaluations_select"
  ON public.evaluations FOR SELECT TO authenticated
  USING (
    evaluator_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "evaluations_insert"
  ON public.evaluations FOR INSERT TO authenticated
  WITH CHECK (evaluator_id = auth.uid());

CREATE POLICY "evaluations_update"
  ON public.evaluations FOR UPDATE TO authenticated
  USING (evaluator_id = auth.uid());


-- ============================================================
--  RLS POLICIES – feedback_notes
-- ============================================================
DROP POLICY IF EXISTS "Evaluators can manage their notes" ON public.feedback_notes;
DROP POLICY IF EXISTS "Admins can view all notes"         ON public.feedback_notes;

CREATE POLICY "feedback_notes_own"
  ON public.feedback_notes FOR ALL TO authenticated
  USING (evaluator_id = auth.uid());

CREATE POLICY "feedback_notes_admin_select"
  ON public.feedback_notes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- ============================================================
--  RLS POLICIES – code_sessions
-- ============================================================
DROP POLICY IF EXISTS "Interview participants can access code sessions" ON public.code_sessions;

CREATE POLICY "code_sessions_participants"
  ON public.code_sessions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.id = interview_id
        AND (
          i.interviewer_id = auth.uid()
          OR i.candidate_id = auth.uid()
          -- registered participant also gets access
          OR EXISTS (
            SELECT 1 FROM public.interview_participants p
            WHERE p.interview_id = i.id
              AND p.candidate_id = auth.uid()
          )
        )
    )
  );


-- ============================================================
--  STORAGE – resumes bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

-- Drop old policies first to avoid duplicates
DROP POLICY IF EXISTS "Users can upload own resume"               ON storage.objects;
DROP POLICY IF EXISTS "Users can view own resume"                 ON storage.objects;
DROP POLICY IF EXISTS "Users can update own resume"               ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own resume"               ON storage.objects;
DROP POLICY IF EXISTS "Interviewers can view candidate resumes"   ON storage.objects;

CREATE POLICY "resume_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "resume_select_own"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "resume_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "resume_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'resumes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Interviewers / admins can view resumes of candidates in their interviews
CREATE POLICY "resume_select_interviewer"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'resumes'
    AND EXISTS (
      SELECT 1 FROM public.interviews i
      WHERE i.candidate_id::text = (storage.foldername(name))[1]
        AND (
          i.interviewer_id = auth.uid()
          OR public.has_role(auth.uid(), 'admin')
        )
    )
  );


-- ============================================================
--  REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.code_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.interviews;


-- ============================================================
--  SEED DATA – default rubric template
-- ============================================================
INSERT INTO public.rubric_templates (name, description, criteria, is_default)
VALUES (
  'Technical Interview',
  'Standard technical interview rubric',
  '[
    {"name": "Problem Solving",    "description": "Ability to break down problems and develop solutions", "weight": 25},
    {"name": "Code Quality",       "description": "Clean, readable, and maintainable code",               "weight": 20},
    {"name": "Technical Knowledge","description": "Understanding of data structures, algorithms, and concepts", "weight": 25},
    {"name": "Communication",      "description": "Ability to explain thought process clearly",           "weight": 15},
    {"name": "Testing & Edge Cases","description": "Consideration for edge cases and testing",            "weight": 15}
  ]',
  true
)
ON CONFLICT DO NOTHING;