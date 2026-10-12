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
          fit: string | null;
          fit_reason: string | null;
          fit_source: string | null;
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
          fit?: string | null;
          fit_reason?: string | null;
          fit_source?: string | null;
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
          fit?: string | null;
          fit_reason?: string | null;
          fit_source?: string | null;
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
      shortlist_shares: {
        Row: {
          created_at: string;
          id: string;
          invite_email: string;
          owner_email: string;
          owner_id: string;
          permission: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invite_email: string;
          owner_email: string;
          owner_id: string;
          permission: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          invite_email?: string;
          owner_email?: string;
          owner_id?: string;
          permission?: string;
        };
        Relationships: [];
      };
      shortlist_comments: {
        Row: {
          author_email: string;
          author_id: string;
          body: string;
          course_id: string;
          created_at: string;
          id: string;
        };
        Insert: {
          author_email: string;
          author_id: string;
          body: string;
          course_id: string;
          created_at?: string;
          id?: string;
        };
        Update: {
          author_email?: string;
          author_id?: string;
          body?: string;
          course_id?: string;
          created_at?: string;
          id?: string;
        };
        Relationships: [];
      };
      application_documents: {
        Row: {
          course_id: string;
          created_at: string;
          details: string | null;
          file_name: string | null;
          id: string;
          label: string;
          required: boolean;
          storage_path: string | null;
          uploaded_at: string | null;
          uploaded_by: string | null;
        };
        Insert: {
          course_id: string;
          created_at?: string;
          details?: string | null;
          file_name?: string | null;
          id?: string;
          label: string;
          required?: boolean;
          storage_path?: string | null;
          uploaded_at?: string | null;
          uploaded_by?: string | null;
        };
        Update: {
          course_id?: string;
          created_at?: string;
          details?: string | null;
          file_name?: string | null;
          id?: string;
          label?: string;
          required?: boolean;
          storage_path?: string | null;
          uploaded_at?: string | null;
          uploaded_by?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      share_permission: {
        Args: { owner: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
