export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      analysis_runs: {
        Row: {
          business_id: string
          error: string | null
          fetched_reviews: number | null
          finished_at: string | null
          id: string
          scrape_cost_usd: number | null
          scrape_latency_ms: number | null
          scrape_success: boolean | null
          started_at: string
          status: string
          trigger: string
        }
        Insert: {
          business_id: string
          error?: string | null
          fetched_reviews?: number | null
          finished_at?: string | null
          id?: string
          scrape_cost_usd?: number | null
          scrape_latency_ms?: number | null
          scrape_success?: boolean | null
          started_at?: string
          status: string
          trigger: string
        }
        Update: {
          business_id?: string
          error?: string | null
          fetched_reviews?: number | null
          finished_at?: string | null
          id?: string
          scrape_cost_usd?: number | null
          scrape_latency_ms?: number | null
          scrape_success?: boolean | null
          started_at?: string
          status?: string
          trigger?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_runs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          category: string | null
          current_tool: string | null
          geo_cell: string | null
          google_place_id: string | null
          id: string
          last_scraped_at: string | null
          lat: number | null
          lng: number | null
          name: string
          normalized_category: string | null
          rating: number | null
          review_count: number | null
          user_id: string
        }
        Insert: {
          category?: string | null
          current_tool?: string | null
          geo_cell?: string | null
          google_place_id?: string | null
          id?: string
          last_scraped_at?: string | null
          lat?: number | null
          lng?: number | null
          name: string
          normalized_category?: string | null
          rating?: number | null
          review_count?: number | null
          user_id: string
        }
        Update: {
          category?: string | null
          current_tool?: string | null
          geo_cell?: string | null
          google_place_id?: string | null
          id?: string
          last_scraped_at?: string | null
          lat?: number | null
          lng?: number | null
          name?: string
          normalized_category?: string | null
          rating?: number | null
          review_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_score_history: {
        Row: {
          business_id: string
          competitor_rank: number | null
          executive_summary: Json | null
          id: string
          score: number | null
          snapshot_at: string
        }
        Insert: {
          business_id: string
          competitor_rank?: number | null
          executive_summary?: Json | null
          id?: string
          score?: number | null
          snapshot_at?: string
        }
        Update: {
          business_id?: string
          competitor_rank?: number | null
          executive_summary?: Json | null
          id?: string
          score?: number | null
          snapshot_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinic_score_history_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      competitors: {
        Row: {
          business_id: string
          google_place_id: string
          id: string
          name: string
          rating: number | null
          review_count: number | null
          selected_at: string
        }
        Insert: {
          business_id: string
          google_place_id: string
          id?: string
          name: string
          rating?: number | null
          review_count?: number | null
          selected_at?: string
        }
        Update: {
          business_id?: string
          google_place_id?: string
          id?: string
          name?: string
          rating?: number | null
          review_count?: number | null
          selected_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitors_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          business_id: string
          created_at: string
          emailed_at: string | null
          id: string
          payload: Json
          type: string
        }
        Insert: {
          business_id: string
          created_at?: string
          emailed_at?: string | null
          id?: string
          payload?: Json
          type: string
        }
        Update: {
          business_id?: string
          created_at?: string
          emailed_at?: string | null
          id?: string
          payload?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      region_category_cache: {
        Row: {
          candidates: Json
          fetched_at: string
          geo_cell: string
          id: string
          normalized_category: string
          ttl_expires_at: string
        }
        Insert: {
          candidates?: Json
          fetched_at?: string
          geo_cell: string
          id?: string
          normalized_category: string
          ttl_expires_at: string
        }
        Update: {
          candidates?: Json
          fetched_at?: string
          geo_cell?: string
          id?: string
          normalized_category?: string
          ttl_expires_at?: string
        }
        Relationships: []
      }
      review_analysis: {
        Row: {
          analyzed_at: string
          confidence: number | null
          emotion: string | null
          id: string
          review_id: string
          theme: string | null
          urgency: string | null
        }
        Insert: {
          analyzed_at?: string
          confidence?: number | null
          emotion?: string | null
          id?: string
          review_id: string
          theme?: string | null
          urgency?: string | null
        }
        Update: {
          analyzed_at?: string
          confidence?: number | null
          emotion?: string | null
          id?: string
          review_id?: string
          theme?: string | null
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_analysis_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_name: string | null
          business_id: string
          id: string
          images_count: number | null
          is_local_guide: boolean | null
          likes: number | null
          original_language: string | null
          owner_reply: string | null
          owner_type: string
          place_id: string
          published_at: string | null
          rating: number | null
          review_id: string
          review_url: string | null
          scraped_at: string
          text: string | null
          translated_text: string | null
        }
        Insert: {
          author_name?: string | null
          business_id: string
          id?: string
          images_count?: number | null
          is_local_guide?: boolean | null
          likes?: number | null
          original_language?: string | null
          owner_reply?: string | null
          owner_type: string
          place_id: string
          published_at?: string | null
          rating?: number | null
          review_id: string
          review_url?: string | null
          scraped_at?: string
          text?: string | null
          translated_text?: string | null
        }
        Update: {
          author_name?: string | null
          business_id?: string
          id?: string
          images_count?: number | null
          is_local_guide?: boolean | null
          likes?: number | null
          original_language?: string | null
          owner_reply?: string | null
          owner_type?: string
          place_id?: string
          published_at?: string | null
          rating?: number | null
          review_id?: string
          review_url?: string | null
          scraped_at?: string
          text?: string | null
          translated_text?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          current_period_end: string | null
          id: string
          plan: string
          status: string
          user_id: string
        }
        Insert: {
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          user_id: string
        }
        Update: {
          current_period_end?: string | null
          id?: string
          plan?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          based_on_competitor_id: string | null
          business_id: string
          checklist_i18n: Json | null
          completed_at: string | null
          created_at: string
          description_i18n: Json | null
          effort_score: number | null
          id: string
          impact_score: number | null
          impact_score_breakdown: Json | null
          last_priority_recalc_at: string | null
          priority: string | null
          source_type: string
          status: string
          theme: string | null
          title_i18n: Json
        }
        Insert: {
          based_on_competitor_id?: string | null
          business_id: string
          checklist_i18n?: Json | null
          completed_at?: string | null
          created_at?: string
          description_i18n?: Json | null
          effort_score?: number | null
          id?: string
          impact_score?: number | null
          impact_score_breakdown?: Json | null
          last_priority_recalc_at?: string | null
          priority?: string | null
          source_type: string
          status?: string
          theme?: string | null
          title_i18n: Json
        }
        Update: {
          based_on_competitor_id?: string | null
          business_id?: string
          checklist_i18n?: Json | null
          completed_at?: string | null
          created_at?: string
          description_i18n?: Json | null
          effort_score?: number | null
          id?: string
          impact_score?: number | null
          impact_score_breakdown?: Json | null
          last_priority_recalc_at?: string | null
          priority?: string | null
          source_type?: string
          status?: string
          theme?: string | null
          title_i18n?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tasks_based_on_competitor_id_fkey"
            columns: ["based_on_competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_summary: {
        Row: {
          business_id: string
          competitor_id: string | null
          id: string
          negative_mentions: number
          owner_type: string
          period_end: string | null
          period_start: string | null
          positive_mentions: number
          theme: string
          treatment: string | null
          trend: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          competitor_id?: string | null
          id?: string
          negative_mentions?: number
          owner_type: string
          period_end?: string | null
          period_start?: string | null
          positive_mentions?: number
          theme: string
          treatment?: string | null
          trend?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          competitor_id?: string | null
          id?: string
          negative_mentions?: number
          owner_type?: string
          period_end?: string | null
          period_start?: string | null
          positive_mentions?: number
          theme?: string
          treatment?: string | null
          trend?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "theme_summary_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "theme_summary_competitor_id_fkey"
            columns: ["competitor_id"]
            isOneToOne: false
            referencedRelation: "competitors"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_businesses_in_geo_cell: {
        Args: { target_geo_cell: string }
        Returns: number
      }
      is_business_owner: {
        Args: { target_business_id: string }
        Returns: boolean
      }
      is_review_owner: {
        Args: { target_business_id: string; target_owner_type: string }
        Returns: boolean
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

