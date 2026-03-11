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
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          organization: string | null
          preferences: Json | null
          role: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email: string
          id: string
          name: string
          organization?: string | null
          preferences?: Json | null
          role?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          organization?: string | null
          preferences?: Json | null
          role?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          owner: string
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          owner: string
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          owner?: string
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_fkey"
            columns: ["owner"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          service_id: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          service_id: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          service_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      qos_predictions: {
        Row: {
          availability: number
          created_at: string
          id: string
          latency: number
          predicted_efficiency: number
          reliability: number
          response_time: number
          service_id: string | null
          throughput: number
          user_id: string
        }
        Insert: {
          availability: number
          created_at?: string
          id?: string
          latency: number
          predicted_efficiency: number
          reliability: number
          response_time: number
          service_id?: string | null
          throughput: number
          user_id: string
        }
        Update: {
          availability?: number
          created_at?: string
          id?: string
          latency?: number
          predicted_efficiency?: number
          reliability?: number
          response_time?: number
          service_id?: string | null
          throughput?: number
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          availability: number | null
          avg_latency: number | null
          avg_rating: number | null
          base_url: string
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          latency: number | null
          name: string
          reliability: number | null
          response_time: number | null
          status: string | null
          tags: string[] | null
          throughput: number | null
          total_ratings: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          availability?: number | null
          avg_latency?: number | null
          avg_rating?: number | null
          base_url: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          latency?: number | null
          name: string
          reliability?: number | null
          response_time?: number | null
          status?: string | null
          tags?: string[] | null
          throughput?: number | null
          total_ratings?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          availability?: number | null
          avg_latency?: number | null
          avg_rating?: number | null
          base_url?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          latency?: number | null
          name?: string
          reliability?: number | null
          response_time?: number | null
          status?: string | null
          tags?: string[] | null
          throughput?: number | null
          total_ratings?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      test_results: {
        Row: {
          created_at: string
          error_rate: number | null
          id: string
          latency: number | null
          metadata: Json | null
          service_id: string
          status: string | null
          success_rate: number | null
          test_type: string
          throughput: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_rate?: number | null
          id?: string
          latency?: number | null
          metadata?: Json | null
          service_id: string
          status?: string | null
          success_rate?: number | null
          test_type: string
          throughput?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_rate?: number | null
          id?: string
          latency?: number | null
          metadata?: Json | null
          service_id?: string
          status?: string | null
          success_rate?: number | null
          test_type?: string
          throughput?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_results_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      web_services: {
        Row: {
          availability_score: number | null
          avg_latency: number | null
          base_url: string | null
          base_latency_estimate: number | null
          category: string
          created_at: string
          description: string
          docs_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          service_name: string | null
          provider: string
          reliability_score: number | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          availability_score?: number | null
          avg_latency?: number | null
          base_url?: string | null
          base_latency_estimate?: number | null
          category: string
          created_at?: string
          description: string
          docs_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          service_name?: string | null
          provider: string
          reliability_score?: number | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          availability_score?: number | null
          avg_latency?: number | null
          base_url?: string | null
          base_latency_estimate?: number | null
          category?: string
          created_at?: string
          description?: string
          docs_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          service_name?: string | null
          provider?: string
          reliability_score?: number | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      service_recommendations: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          score: number | null
          service_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          score?: number | null
          service_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          score?: number | null
          service_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_recommendations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "web_services"
            referencedColumns: ["id"]
          },
        ]
      }
      model_feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          prediction_id: string
          rating: number | null
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          prediction_id: string
          rating?: number | null
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          prediction_id?: string
          rating?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_feedback_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "qos_predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      tests: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          latency: number | null
          service_url: string
          status: string | null
          success_rate: number | null
          test_type: string
          throughput: number | null
          uptime: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          latency?: number | null
          service_url: string
          status?: string | null
          success_rate?: number | null
          test_type: string
          throughput?: number | null
          uptime?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          latency?: number | null
          service_url?: string
          status?: string | null
          success_rate?: number | null
          test_type?: string
          throughput?: number | null
          uptime?: number | null
          user_id?: string
        }
        Relationships: []
      }
      user_favorites: {
        Row: {
          created_at: string
          id: string
          service_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          service_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          service_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
