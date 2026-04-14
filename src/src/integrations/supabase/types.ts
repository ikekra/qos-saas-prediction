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
      admin_audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string
          after_value: number | null
          before_value: number | null
          bulk_count: number
          confirm_phrase: string | null
          created_at: string
          delta_value: number | null
          id: string
          ip_address: string | null
          metadata: Json
          reason: string | null
          request_id: string | null
          resource: string
          status: string
          target_email: string | null
          target_user_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id: string
          after_value?: number | null
          before_value?: number | null
          bulk_count?: number
          confirm_phrase?: string | null
          created_at?: string
          delta_value?: number | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          reason?: string | null
          request_id?: string | null
          resource?: string
          status: string
          target_email?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string
          after_value?: number | null
          before_value?: number | null
          bulk_count?: number
          confirm_phrase?: string | null
          created_at?: string
          delta_value?: number | null
          id?: string
          ip_address?: string | null
          metadata?: Json
          reason?: string | null
          request_id?: string | null
          resource?: string
          status?: string
          target_email?: string | null
          target_user_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      api_usage_logs: {
        Row: {
          created_at: string | null
          duration_ms: number | null
          endpoint: string
          id: string
          request_id: string
          tokens_used: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_ms?: number | null
          endpoint: string
          id?: string
          request_id: string
          tokens_used: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_ms?: number | null
          endpoint?: string
          id?: string
          request_id?: string
          tokens_used?: number
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          ip: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          ip?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          ip?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      efficiency_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          latency_ms: number | null
          prediction_response: Json | null
          request_payload: Json
          status: string
          status_code: number
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          prediction_response?: Json | null
          request_payload?: Json
          status?: string
          status_code: number
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          prediction_response?: Json | null
          request_payload?: Json
          status?: string
          status_code?: number
          user_id?: string
        }
        Relationships: []
      }
      marketing_leads: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          lead_type: string
          message: string | null
          name: string | null
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          lead_type: string
          message?: string | null
          name?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          lead_type?: string
          message?: string | null
          name?: string | null
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
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
      monthly_token_claims: {
        Row: {
          claim_month: string
          created_at: string
          id: string
          tokens_granted: number
          user_id: string
        }
        Insert: {
          claim_month: string
          created_at?: string
          id?: string
          tokens_granted: number
          user_id: string
        }
        Update: {
          claim_month?: string
          created_at?: string
          id?: string
          tokens_granted?: number
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_in_paise: number
          created_at: string | null
          currency: string
          gateway_order_id: string
          gateway_payment_id: string | null
          id: string
          idempotency_key: string
          pack_name: string | null
          plan_name: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          status: string
          subscription_id: string | null
          subscription_type: string | null
          team_id: string | null
          tokens_purchased: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_in_paise: number
          created_at?: string | null
          currency?: string
          gateway_order_id: string
          gateway_payment_id?: string | null
          id?: string
          idempotency_key: string
          pack_name?: string | null
          plan_name?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          subscription_id?: string | null
          subscription_type?: string | null
          team_id?: string | null
          tokens_purchased: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_in_paise?: number
          created_at?: string | null
          currency?: string
          gateway_order_id?: string
          gateway_payment_id?: string | null
          id?: string
          idempotency_key?: string
          pack_name?: string | null
          plan_name?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          status?: string
          subscription_id?: string | null
          subscription_type?: string | null
          team_id?: string | null
          tokens_purchased?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_quota_overview"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_run_cycles: {
        Row: {
          account_manager_webhook: string | null
          created_at: string
          hard_limit_alerted_at: string | null
          id: string
          plan: string
          reset_date: string
          run_limit: number
          runs_used: number
          scope_id: string
          scope_type: string
          soft_limit_alerted_at: string | null
          updated_at: string
        }
        Insert: {
          account_manager_webhook?: string | null
          created_at?: string
          hard_limit_alerted_at?: string | null
          id?: string
          plan: string
          reset_date: string
          run_limit: number
          runs_used?: number
          scope_id: string
          scope_type: string
          soft_limit_alerted_at?: string | null
          updated_at?: string
        }
        Update: {
          account_manager_webhook?: string | null
          created_at?: string
          hard_limit_alerted_at?: string | null
          id?: string
          plan?: string
          reset_date?: string
          run_limit?: number
          runs_used?: number
          scope_id?: string
          scope_type?: string
          soft_limit_alerted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      performance_test_run_logs: {
        Row: {
          actor_user_id: string | null
          created_at: string
          duration_ms: number | null
          id: string
          org_id: string | null
          plan: string
          quota_scope_id: string
          quota_scope_type: string
          result_summary: string | null
          run_number: number
          team_id: string | null
          test_run_id: string | null
          test_type: string
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          org_id?: string | null
          plan: string
          quota_scope_id: string
          quota_scope_type: string
          result_summary?: string | null
          run_number: number
          team_id?: string | null
          test_run_id?: string | null
          test_type: string
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          org_id?: string | null
          plan?: string
          quota_scope_id?: string
          quota_scope_type?: string
          result_summary?: string | null
          run_number?: number
          team_id?: string | null
          test_run_id?: string | null
          test_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_test_run_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_quota_overview"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "performance_test_run_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_test_run_logs_test_run_id_fkey"
            columns: ["test_run_id"]
            isOneToOne: false
            referencedRelation: "tests"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
        Relationships: [
          {
            foreignKeyName: "qos_predictions_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "web_services"
            referencedColumns: ["id"]
          },
        ]
      }
      quota_usage: {
        Row: {
          created_at: string
          cycle_end_date: string
          cycle_start_date: string
          id: string
          reset_at: string
          run_limit: number
          runs_used: number
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cycle_end_date: string
          cycle_start_date: string
          id?: string
          reset_at: string
          run_limit: number
          runs_used?: number
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cycle_end_date?: string
          cycle_start_date?: string
          id?: string
          reset_at?: string
          run_limit?: number
          runs_used?: number
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quota_usage_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_quota_overview"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "quota_usage_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
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
      services: {
        Row: {
          avg_latency: number | null
          avg_rating: number | null
          base_url: string
          category: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          name: string
          status: string | null
          tags: string[] | null
          total_ratings: number | null
          updated_at: string
        }
        Insert: {
          avg_latency?: number | null
          avg_rating?: number | null
          base_url: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name: string
          status?: string | null
          tags?: string[] | null
          total_ratings?: number | null
          updated_at?: string
        }
        Update: {
          avg_latency?: number | null
          avg_rating?: number | null
          base_url?: string
          category?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          name?: string
          status?: string | null
          tags?: string[] | null
          total_ratings?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string
          current_period_start: string
          deleted_at: string | null
          id: string
          plan: string
          razorpay_sub_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          deleted_at?: string | null
          id?: string
          plan: string
          razorpay_sub_id?: string | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          deleted_at?: string | null
          id?: string
          plan?: string
          razorpay_sub_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_activity_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          metadata: Json
          resource_id: string | null
          resource_type: string | null
          team_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          team_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          resource_id?: string | null
          resource_type?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_activity_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_quota_overview"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_activity_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          declined_at: string | null
          expires_at: string
          id: string
          invited_by: string
          invited_email: string
          role: Database["public"]["Enums"]["team_member_role"]
          status: Database["public"]["Enums"]["team_invitation_status"]
          team_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          expires_at: string
          id?: string
          invited_by: string
          invited_email: string
          role?: Database["public"]["Enums"]["team_member_role"]
          status?: Database["public"]["Enums"]["team_invitation_status"]
          team_id: string
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          declined_at?: string | null
          expires_at?: string
          id?: string
          invited_by?: string
          invited_email?: string
          role?: Database["public"]["Enums"]["team_member_role"]
          status?: Database["public"]["Enums"]["team_invitation_status"]
          team_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_quota_overview"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string | null
          role: Database["public"]["Enums"]["team_member_role"]
          status: Database["public"]["Enums"]["team_member_status"]
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["team_member_role"]
          status?: Database["public"]["Enums"]["team_member_status"]
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["team_member_role"]
          status?: Database["public"]["Enums"]["team_member_status"]
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_quota_overview"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          id: string
          max_members: number
          name: string
          owner_id: string
          plan: Database["public"]["Enums"]["team_plan"]
          slug: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          max_members?: number
          name: string
          owner_id: string
          plan: Database["public"]["Enums"]["team_plan"]
          slug: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          max_members?: number
          name?: string
          owner_id?: string
          plan?: Database["public"]["Enums"]["team_plan"]
          slug?: string
          updated_at?: string
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
      token_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string | null
          description: string
          endpoint: string | null
          id: string
          payment_id: string | null
          request_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string | null
          description: string
          endpoint?: string | null
          id?: string
          payment_id?: string | null
          request_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string | null
          description?: string
          endpoint?: string | null
          id?: string
          payment_id?: string | null
          request_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      topup_records: {
        Row: {
          account_user_id: string
          amount_paid: number
          billing_address: string | null
          created_at: string
          currency: string
          email: string
          full_name: string
          gst_id: string | null
          id: string
          notes: string | null
          package_selected: string
          payment_method: string
          status: string
          tokens_added: number
          user_id: string
        }
        Insert: {
          account_user_id: string
          amount_paid: number
          billing_address?: string | null
          created_at?: string
          currency?: string
          email: string
          full_name: string
          gst_id?: string | null
          id?: string
          notes?: string | null
          package_selected: string
          payment_method?: string
          status?: string
          tokens_added: number
          user_id: string
        }
        Update: {
          account_user_id?: string
          amount_paid?: number
          billing_address?: string | null
          created_at?: string
          currency?: string
          email?: string
          full_name?: string
          gst_id?: string | null
          id?: string
          notes?: string | null
          package_selected?: string
          payment_method?: string
          status?: string
          tokens_added?: number
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
      user_profiles: {
        Row: {
          account_manager_webhook: string | null
          created_at: string | null
          deleted_at: string | null
          email: string
          id: string
          lifetime_tokens_used: number
          performance_cycle_reset_at: string | null
          performance_org_id: string | null
          performance_plan: string | null
          performance_run_limit: number | null
          token_balance: number
          updated_at: string
        }
        Insert: {
          account_manager_webhook?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email: string
          id: string
          lifetime_tokens_used?: number
          performance_cycle_reset_at?: string | null
          performance_org_id?: string | null
          performance_plan?: string | null
          performance_run_limit?: number | null
          token_balance?: number
          updated_at?: string
        }
        Update: {
          account_manager_webhook?: string | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string
          id?: string
          lifetime_tokens_used?: number
          performance_cycle_reset_at?: string | null
          performance_org_id?: string | null
          performance_plan?: string | null
          performance_run_limit?: number | null
          token_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      web_services: {
        Row: {
          availability_score: number | null
          avg_latency: number | null
          base_latency_estimate: number | null
          base_url: string | null
          category: string
          created_at: string
          deleted_at: string | null
          description: string
          docs_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          provider: string
          reliability_score: number | null
          service_name: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          availability_score?: number | null
          avg_latency?: number | null
          base_latency_estimate?: number | null
          base_url?: string | null
          category: string
          created_at?: string
          deleted_at?: string | null
          description: string
          docs_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          provider: string
          reliability_score?: number | null
          service_name?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          availability_score?: number | null
          avg_latency?: number | null
          base_latency_estimate?: number | null
          base_url?: string | null
          category?: string
          created_at?: string
          deleted_at?: string | null
          description?: string
          docs_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          provider?: string
          reliability_score?: number | null
          service_name?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      team_member_usage_breakdown: {
        Row: {
          last_active_at: string | null
          runs_used: number | null
          team_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "performance_test_run_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_quota_overview"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "performance_test_run_logs_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_quota_overview: {
        Row: {
          cycle_end_date: string | null
          cycle_start_date: string | null
          max_members: number | null
          plan: Database["public"]["Enums"]["team_plan"] | null
          reset_at: string | null
          run_limit: number | null
          runs_remaining: number | null
          runs_used: number | null
          team_id: string | null
          team_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      acknowledge_performance_quota_alert: {
        Args: { p_alert_type: string; p_scope_id: string; p_scope_type: string }
        Returns: undefined
      }
      append_audit_log: {
        Args: {
          p_action: string
          p_admin_id: string
          p_after?: Json
          p_before?: Json
          p_ip?: string
          p_target_id?: string
          p_target_type: string
        }
        Returns: undefined
      }
      claim_free_monthly_tokens: { Args: { p_tokens?: number }; Returns: Json }
      credit_tokens: {
        Args: {
          p_amount: number
          p_pack_name: string
          p_payment_id: string
          p_user_id: string
        }
        Returns: Json
      }
      current_team_member_count: {
        Args: { p_team_id: string }
        Returns: number
      }
      deduct_tokens: {
        Args: {
          p_amount: number
          p_description: string
          p_endpoint: string
          p_request_id: string
          p_user_id: string
        }
        Returns: Json
      }
      ensure_team_quota_cycle: {
        Args: { p_run_limit: number; p_team_id: string }
        Returns: {
          created_at: string
          cycle_end_date: string
          cycle_start_date: string
          id: string
          reset_at: string
          run_limit: number
          runs_used: number
          team_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "quota_usage"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_token_admin_summary: {
        Args: never
        Returns: {
          total_lifetime_tokens_used: number
          total_token_balance: number
          total_users: number
        }[]
      }
      is_admin_user: { Args: { check_user_id?: string }; Returns: boolean }
      log_team_activity: {
        Args: {
          p_action: string
          p_actor_id: string
          p_metadata?: Json
          p_resource_id?: string
          p_resource_type?: string
          p_team_id: string
        }
        Returns: undefined
      }
      release_performance_test_run: {
        Args: { p_scope_id: string; p_scope_type: string }
        Returns: undefined
      }
      reserve_performance_test_run: {
        Args: {
          p_account_manager_webhook?: string
          p_plan: string
          p_reset_date: string
          p_run_limit: number
          p_scope_id: string
          p_scope_type: string
        }
        Returns: {
          blocked: boolean
          hard_alert_needed: boolean
          hard_limit_alerted_at: string
          plan: string
          reset_date: string
          run_limit: number
          run_number: number
          runs_remaining: number
          runs_used: number
          scope_id: string
          scope_type: string
          soft_alert_needed: boolean
          soft_limit_alerted_at: string
          success: boolean
        }[]
      }
      reserve_team_quota_run: {
        Args: { p_run_limit: number; p_team_id: string }
        Returns: {
          reset_at: string
          run_limit: number
          runs_remaining: number
          runs_used: number
          success: boolean
        }[]
      }
      team_plan_run_limit: {
        Args: { p_plan: Database["public"]["Enums"]["team_plan"] }
        Returns: number
      }
    }
    Enums: {
      admin_action_status: "attempt" | "success" | "failed" | "denied"
      team_invitation_status:
        | "pending"
        | "accepted"
        | "declined"
        | "revoked"
        | "expired"
      team_member_role: "owner" | "admin" | "member"
      team_member_status: "active" | "invited" | "suspended" | "removed"
      team_plan: "pro" | "enterprise"
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
      admin_action_status: ["attempt", "success", "failed", "denied"],
      team_invitation_status: [
        "pending",
        "accepted",
        "declined",
        "revoked",
        "expired",
      ],
      team_member_role: ["owner", "admin", "member"],
      team_member_status: ["active", "invited", "suspended", "removed"],
      team_plan: ["pro", "enterprise"],
    },
  },
} as const
