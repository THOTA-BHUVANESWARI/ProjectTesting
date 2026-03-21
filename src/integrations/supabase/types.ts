export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          resume_url: string | null
          resume_filename: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          resume_url?: string | null
          resume_filename?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          resume_url?: string | null
          resume_filename?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: 'admin' | 'interviewer' | 'candidate'
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: 'admin' | 'interviewer' | 'candidate'
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: 'admin' | 'interviewer' | 'candidate'
          created_at?: string
        }
      }
      interviews: {
        Row: {
          id: string
          title: string
          description: string | null
          scheduled_at: string
          duration_minutes: number
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          interviewer_id: string | null
          candidate_id: string | null
          room_code: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          scheduled_at: string
          duration_minutes?: number
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          interviewer_id?: string | null
          candidate_id?: string | null
          room_code?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          scheduled_at?: string
          duration_minutes?: number
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          interviewer_id?: string | null
          candidate_id?: string | null
          room_code?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      evaluations: {
        Row: {
          id: string
          interview_id: string
          evaluator_id: string
          rubric_template_id: string | null
          scores: Json
          notes: string | null
          overall_rating: number | null
          recommendation: string | null
          submitted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          interview_id: string
          evaluator_id: string
          rubric_template_id?: string | null
          scores?: Json
          notes?: string | null
          overall_rating?: number | null
          recommendation?: string | null
          submitted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          interview_id?: string
          evaluator_id?: string
          rubric_template_id?: string | null
          scores?: Json
          notes?: string | null
          overall_rating?: number | null
          recommendation?: string | null
          submitted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      feedback_notes: {
        Row: {
          id: string
          interview_id: string
          evaluator_id: string
          timestamp_seconds: number
          note: string
          category: string | null
          created_at: string
        }
        Insert: {
          id?: string
          interview_id: string
          evaluator_id: string
          timestamp_seconds: number
          note: string
          category?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          interview_id?: string
          evaluator_id?: string
          timestamp_seconds?: number
          note?: string
          category?: string | null
          created_at?: string
        }
      }
      code_sessions: {
        Row: {
          id: string
          interview_id: string
          language: string
          code_content: string
          problem_title: string | null
          problem_description: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          interview_id: string
          language?: string
          code_content?: string
          problem_title?: string | null
          problem_description?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          interview_id?: string
          language?: string
          code_content?: string
          problem_title?: string | null
          problem_description?: string | null
          updated_at?: string
        }
      }
      rubric_templates: {
        Row: {
          id: string
          name: string
          description: string | null
          criteria: Json
          created_by: string | null
          is_default: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          criteria?: Json
          created_by?: string | null
          is_default?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          criteria?: Json
          created_by?: string | null
          is_default?: boolean
          created_at?: string
        }
      }
      interview_participants: {
        Row: {
          id: string
          interview_id: string
          candidate_id: string
          joined_at: string
          status: string
        }
        Insert: {
          id?: string
          interview_id: string
          candidate_id: string
          joined_at?: string
          status?: string
        }
        Update: {
          id?: string
          interview_id?: string
          candidate_id?: string
          joined_at?: string
          status?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: { _user_id: string; _role: string }
        Returns: boolean
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: string
      }
    }
    Enums: {
      user_role: 'admin' | 'interviewer' | 'candidate'
      interview_status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
    }
  }
}