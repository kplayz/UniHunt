export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      search_sessions: {
        Row: {
          created_at: string;
          criteria: Json;
          id: string;
          results: Json | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          criteria: Json;
          id?: string;
          results?: Json | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          criteria?: Json;
          id?: string;
          results?: Json | null;
          user_id?: string;
        };
        Relationships: [];
      };
      shortlisted_courses: {
        Row: {
          admission_requirements: string | null;
          country: string | null;
          course_level: string | null;
          course_name: string;
          course_type: string | null;
          course_url: string | null;
          created_at: string;
          duration: string | null;
          id: string;
          important_dates: Json | null;
          important_dates_checked_at: string | null;
          intake_period: string | null;
          is_manual: boolean;
          language: string | null;
          notes: string | null;
          qs_world_ranking: number | null;
          scholarship_info: string | null;
          specialization: string | null;
          tuition_fee: string | null;
          university_location: string | null;
          university_name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          admission_requirements?: string | null;
          country?: string | null;
          course_level?: string | null;
          course_name: string;
          course_type?: string | null;
          course_url?: string | null;
          created_at?: string;
          duration?: string | null;
          id?: string;
          important_dates?: Json | null;
          important_dates_checked_at?: string | null;
          intake_period?: string | null;
          is_manual?: boolean;
          language?: string | null;
          notes?: string | null;
          qs_world_ranking?: number | null;
          scholarship_info?: string | null;
          specialization?: string | null;
          tuition_fee?: string | null;
          university_location?: string | null;
          university_name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          admission_requirements?: string | null;
          country?: string | null;
          course_level?: string | null;
          course_name?: string;
          course_type?: string | null;
          course_url?: string | null;
          created_at?: string;
          duration?: string | null;
          id?: string;
          important_dates?: Json | null;
          important_dates_checked_at?: string | null;
          intake_period?: string | null;
          is_manual?: boolean;
          language?: string | null;
          notes?: string | null;
          qs_world_ranking?: number | null;
          scholarship_info?: string | null;
          specialization?: string | null;
          tuition_fee?: string | null;
          university_location?: string | null;
          university_name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
