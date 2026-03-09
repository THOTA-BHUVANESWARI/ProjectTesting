export type UserRole = 'admin' | 'interviewer' | 'candidate';
export type InterviewStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface Interview {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: InterviewStatus;
  interviewer_id: string | null;
  candidate_id: string | null;
  room_code: string;
  created_at: string;
  updated_at: string;
}

export interface RubricTemplate {
  id: string;
  name: string;
  description: string | null;
  criteria: RubricCriteria[];
  created_by: string | null;
  is_default: boolean;
  created_at: string;
}

export interface RubricCriteria {
  name: string;
  description: string;
  weight: number;
}

export interface Evaluation {
  id: string;
  interview_id: string;
  evaluator_id: string;
  rubric_template_id: string | null;
  scores: Record<string, number>;
  notes: string | null;
  overall_rating: number | null;
  recommendation: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeedbackNote {
  id: string;
  interview_id: string;
  evaluator_id: string;
  timestamp_seconds: number;
  note: string;
  category: string | null;
  created_at: string;
}

export interface CodeSession {
  id: string;
  interview_id: string;
  language: string;
  code_content: string;
  problem_title: string | null;
  problem_description: string | null;
  updated_at: string;
}
