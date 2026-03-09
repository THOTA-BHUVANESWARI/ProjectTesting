export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      code_sessions: {
        Row: {
          code_content: string
          id: string
          interview_id: string
          language: string
          problem_description: string | null
          problem_title: string | null
          updated_at: string
        }
        Insert: {
          code_content?: string
          id?: string
          interview_id: string
          language?: string
          problem_description?: string | null
          problem_title?: string | null
          updated_at?: string
        }
        Update: {
          code_content?: string
          id?: string
          interview_id?: string
          language?: string
          problem_description?: string | null
          problem_title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_sessions_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          created_at: string
          evaluator_id: string
          id: string
          interview_id: string
          notes: string | null
          overall_rating: number | null
          recommendation: string | null
          rubric_template_id: string | null
          scores: Json
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          evaluator_id: string
          id?: string
          interview_id: string
          notes?: string | null
          overall_rating?: number | null
          recommendation?: string | null
          rubric_template_id?: string | null
          scores?: Json
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          evaluator_id?: string
          id?: string
          interview_id?: string
          notes?: string | null
          overall_rating?: number | null
          recommendation?: string | null
          rubric_template_id?: string | null
          scores?: Json
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_rubric_template_id_fkey"
            columns: ["rubric_template_id"]
            isOneToOne: false
            referencedRelation: "rubric_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_notes: {
        Row: {
          category: string | null
          created_at: string
          evaluator_id: string
          id: string
          interview_id: string
          note: string
          timestamp_seconds: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          evaluator_id: string
          id?: string
          interview_id: string
          note: string
          timestamp_seconds: number
        }
        Update: {
          category?: string | null
          created_at?: string
          evaluator_id?: string
          id?: string
          interview_id?: string
          note?: string
          timestamp_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "feedback_notes_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interviews: {
        Row: {
          candidate_id: string | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          interviewer_id: string | null
          room_code: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["interview_status"]
          title: string
          updated_at: string
        }
        Insert: {
          candidate_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          interviewer_id?: string | null
          room_code?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["interview_status"]
          title: string
          updated_at?: string
        }
        Update: {
          candidate_id?: string | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          interviewer_id?: string | null
          room_code?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["interview_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          resume_filename: string | null
          resume_url: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          resume_filename?: string | null
          resume_url?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          resume_filename?: string | null
          resume_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rubric_templates: {
        Row: {
          created_at: string
          created_by: string | null
          criteria: Json
          description: string | null
          id: string
          is_default: boolean | null
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          criteria?: Json
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          criteria?: Json
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      interview_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      user_role: "admin" | "interviewer" | "candidate"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      interview_status: ["scheduled", "in_progress", "completed", "cancelled"],
      user_role: ["admin", "interviewer", "candidate"],
    },
  },
} as const
