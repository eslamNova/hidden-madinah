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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          caption_ar: string | null
          duration_seconds: number | null
          height: number | null
          id: string
          place_id: string
          provider: Database["public"]["Enums"]["media_provider"]
          sort_order: number
          thumb_url: string | null
          type: Database["public"]["Enums"]["media_type"]
          url: string
          width: number | null
        }
        Insert: {
          caption_ar?: string | null
          duration_seconds?: number | null
          height?: number | null
          id?: string
          place_id: string
          provider?: Database["public"]["Enums"]["media_provider"]
          sort_order?: number
          thumb_url?: string | null
          type?: Database["public"]["Enums"]["media_type"]
          url: string
          width?: number | null
        }
        Update: {
          caption_ar?: string | null
          duration_seconds?: number | null
          height?: number | null
          id?: string
          place_id?: string
          provider?: Database["public"]["Enums"]["media_provider"]
          sort_order?: number
          thumb_url?: string | null
          type?: Database["public"]["Enums"]["media_type"]
          url?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          has_stairs: boolean | null
          opening_hours: Json | null
          story_en: string | null
          summary_en: string | null
          visit_minutes: number | null
          walking_effort: string | null
          wheelchair_ok: boolean | null
          admin_notes_ar: string | null
          best_time_ar: string | null
          category: Database["public"]["Enums"]["place_category"]
          distance_from_prophets_mosque_km: number | null
          drive_time_from_haram_min: number | null
          featured: boolean
          featured_quote_ar: string | null
          featured_quote_source_ar: string | null
          google_maps_url: string | null
          how_to_get_there_ar: string | null
          id: string
          is_published: boolean
          last_updated: string
          lat: number | null
          lng: number | null
          name_ar: string
          name_en: string | null
          open_status_ar: string | null
          related_place_slugs: string[]
          slug: string
          story_ar: string | null
          summary_ar: string | null
          transport_cost_sar: number | null
          transport_note_ar: string | null
          transport_options: Json | null
          virtue_ar: string | null
          visiting_tips_ar: string | null
        }
        Insert: {
          has_stairs?: boolean | null
          opening_hours?: Json | null
          story_en?: string | null
          summary_en?: string | null
          visit_minutes?: number | null
          walking_effort?: string | null
          wheelchair_ok?: boolean | null
          admin_notes_ar?: string | null
          best_time_ar?: string | null
          category?: Database["public"]["Enums"]["place_category"]
          distance_from_prophets_mosque_km?: number | null
          drive_time_from_haram_min?: number | null
          featured?: boolean
          featured_quote_ar?: string | null
          featured_quote_source_ar?: string | null
          google_maps_url?: string | null
          how_to_get_there_ar?: string | null
          id?: string
          is_published?: boolean
          last_updated?: string
          lat?: number | null
          lng?: number | null
          name_ar: string
          name_en?: string | null
          open_status_ar?: string | null
          related_place_slugs?: string[]
          slug: string
          story_ar?: string | null
          summary_ar?: string | null
          transport_cost_sar?: number | null
          transport_note_ar?: string | null
          transport_options?: Json | null
          virtue_ar?: string | null
          visiting_tips_ar?: string | null
        }
        Update: {
          has_stairs?: boolean | null
          opening_hours?: Json | null
          story_en?: string | null
          summary_en?: string | null
          visit_minutes?: number | null
          walking_effort?: string | null
          wheelchair_ok?: boolean | null
          admin_notes_ar?: string | null
          best_time_ar?: string | null
          category?: Database["public"]["Enums"]["place_category"]
          distance_from_prophets_mosque_km?: number | null
          drive_time_from_haram_min?: number | null
          featured?: boolean
          featured_quote_ar?: string | null
          featured_quote_source_ar?: string | null
          google_maps_url?: string | null
          how_to_get_there_ar?: string | null
          id?: string
          is_published?: boolean
          last_updated?: string
          lat?: number | null
          lng?: number | null
          name_ar?: string
          name_en?: string | null
          open_status_ar?: string | null
          related_place_slugs?: string[]
          slug?: string
          story_ar?: string | null
          summary_ar?: string | null
          transport_cost_sar?: number | null
          transport_note_ar?: string | null
          transport_options?: Json | null
          virtue_ar?: string | null
          visiting_tips_ar?: string | null
        }
        Relationships: []
      }
      route_places: {
        Row: {
          place_id: string
          route_id: string
          sort_order: number
        }
        Insert: {
          place_id: string
          route_id: string
          sort_order?: number
        }
        Update: {
          place_id?: string
          route_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_places_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_places_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          cover_url: string | null
          description_ar: string | null
          id: string
          slug: string
          title_ar: string
        }
        Insert: {
          cover_url?: string | null
          description_ar?: string | null
          id?: string
          slug: string
          title_ar: string
        }
        Update: {
          cover_url?: string | null
          description_ar?: string | null
          id?: string
          slug?: string
          title_ar?: string
        }
        Relationships: []
      }
      claims: {
        Row: {
          content_level: Database["public"]["Enums"]["content_level"]
          created_at: string
          en_reviewed: boolean
          grading: string | null
          hadith_ref: string | null
          id: number
          kind: Database["public"]["Enums"]["claim_kind"]
          needs_samarrai_check: boolean
          page: number | null
          place_id: string | null
          quote_ar: string | null
          reviewed_at: string | null
          reviewer_note: string | null
          samarrai_ref: string | null
          source_id: string
          status: Database["public"]["Enums"]["review_status"]
          text_ar: string
          text_en: string | null
          themes: string[]
          topic: string | null
          vol: number | null
        }
        Insert: {
          content_level?: Database["public"]["Enums"]["content_level"]
          created_at?: string
          en_reviewed?: boolean
          grading?: string | null
          hadith_ref?: string | null
          id?: number
          kind?: Database["public"]["Enums"]["claim_kind"]
          needs_samarrai_check?: boolean
          page?: number | null
          place_id?: string | null
          quote_ar?: string | null
          reviewed_at?: string | null
          reviewer_note?: string | null
          samarrai_ref?: string | null
          source_id: string
          status?: Database["public"]["Enums"]["review_status"]
          text_ar: string
          text_en?: string | null
          themes?: string[]
          topic?: string | null
          vol?: number | null
        }
        Update: {
          content_level?: Database["public"]["Enums"]["content_level"]
          created_at?: string
          en_reviewed?: boolean
          grading?: string | null
          hadith_ref?: string | null
          id?: number
          kind?: Database["public"]["Enums"]["claim_kind"]
          needs_samarrai_check?: boolean
          page?: number | null
          place_id?: string | null
          quote_ar?: string | null
          reviewed_at?: string | null
          reviewer_note?: string | null
          samarrai_ref?: string | null
          source_id?: string
          status?: Database["public"]["Enums"]["review_status"]
          text_ar?: string
          text_en?: string | null
          themes?: string[]
          topic?: string | null
          vol?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_logs: {
        Row: {
          answer: string | null
          cached_tokens: number | null
          cited_claim_ids: number[]
          context: string | null
          created_at: string
          feedback: number | null
          id: number
          input_tokens: number | null
          lang: string | null
          latency_ms: number | null
          model: string | null
          output_tokens: number | null
          question: string | null
          refused: boolean
        }
        Insert: {
          answer?: string | null
          cached_tokens?: number | null
          cited_claim_ids?: number[]
          context?: string | null
          created_at?: string
          feedback?: number | null
          id?: number
          input_tokens?: number | null
          lang?: string | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          question?: string | null
          refused?: boolean
        }
        Update: {
          answer?: string | null
          cached_tokens?: number | null
          cited_claim_ids?: number[]
          context?: string | null
          created_at?: string
          feedback?: number | null
          id?: number
          input_tokens?: number | null
          lang?: string | null
          latency_ms?: number | null
          model?: string | null
          output_tokens?: number | null
          question?: string | null
          refused?: boolean
        }
        Relationships: []
      }
      journey_stops: {
        Row: {
          claim_ids: number[]
          human_moment_ar: string | null
          human_moment_en: string | null
          id: string
          journey_id: string
          lat: number | null
          lng: number | null
          place_id: string | null
          reflection_ar: string | null
          reflection_en: string | null
          script_ar: string | null
          script_en: string | null
          script_kids_ar: string | null
          sort_order: number
          status: Database["public"]["Enums"]["review_status"]
          title_ar: string | null
          title_en: string | null
        }
        Insert: {
          claim_ids?: number[]
          human_moment_ar?: string | null
          human_moment_en?: string | null
          id?: string
          journey_id: string
          lat?: number | null
          lng?: number | null
          place_id?: string | null
          reflection_ar?: string | null
          reflection_en?: string | null
          script_ar?: string | null
          script_en?: string | null
          script_kids_ar?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["review_status"]
          title_ar?: string | null
          title_en?: string | null
        }
        Update: {
          claim_ids?: number[]
          human_moment_ar?: string | null
          human_moment_en?: string | null
          id?: string
          journey_id?: string
          lat?: number | null
          lng?: number | null
          place_id?: string | null
          reflection_ar?: string | null
          reflection_en?: string | null
          script_ar?: string | null
          script_en?: string | null
          script_kids_ar?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["review_status"]
          title_ar?: string | null
          title_en?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journey_stops_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_stops_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      journeys: {
        Row: {
          cover_url: string | null
          created_at: string
          duration_min: number | null
          id: string
          intro_ar: string | null
          intro_en: string | null
          is_published: boolean
          mode: string | null
          slug: string
          sort_order: number
          subtitle_ar: string | null
          subtitle_en: string | null
          tags: string[]
          theme_ar: string | null
          theme_en: string | null
          title_ar: string
          title_en: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          duration_min?: number | null
          id?: string
          intro_ar?: string | null
          intro_en?: string | null
          is_published?: boolean
          mode?: string | null
          slug: string
          sort_order?: number
          subtitle_ar?: string | null
          subtitle_en?: string | null
          tags?: string[]
          theme_ar?: string | null
          theme_en?: string | null
          title_ar: string
          title_en?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          duration_min?: number | null
          id?: string
          intro_ar?: string | null
          intro_en?: string | null
          is_published?: boolean
          mode?: string | null
          slug?: string
          sort_order?: number
          subtitle_ar?: string | null
          subtitle_en?: string | null
          tags?: string[]
          theme_ar?: string | null
          theme_en?: string | null
          title_ar?: string
          title_en?: string | null
        }
        Relationships: []
      }
      quiz_items: {
        Row: {
          answer_index: number
          explanation_claim_id: number | null
          id: string
          journey_id: string
          options_ar: string[]
          options_en: string[] | null
          question_ar: string
          question_en: string | null
          sort_order: number
          status: Database["public"]["Enums"]["review_status"]
        }
        Insert: {
          answer_index: number
          explanation_claim_id?: number | null
          id?: string
          journey_id: string
          options_ar: string[]
          options_en?: string[] | null
          question_ar: string
          question_en?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["review_status"]
        }
        Update: {
          answer_index?: number
          explanation_claim_id?: number | null
          id?: string
          journey_id?: string
          options_ar?: string[]
          options_en?: string[] | null
          question_ar?: string
          question_en?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["review_status"]
        }
        Relationships: [
          {
            foreignKeyName: "quiz_items_explanation_claim_id_fkey"
            columns: ["explanation_claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_items_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_results: {
        Row: {
          completed_stops: number | null
          created_at: string
          familiarity: string | null
          id: number
          journey_slug: string
          lang: string | null
          post_score: number | null
          pre_score: number | null
          rating_clarity: number | null
          rating_flow: number | null
          total: number | null
          total_stops: number | null
        }
        Insert: {
          completed_stops?: number | null
          created_at?: string
          familiarity?: string | null
          id?: number
          journey_slug: string
          lang?: string | null
          post_score?: number | null
          pre_score?: number | null
          rating_clarity?: number | null
          rating_flow?: number | null
          total?: number | null
          total_stops?: number | null
        }
        Update: {
          completed_stops?: number | null
          created_at?: string
          familiarity?: string | null
          id?: number
          journey_slug?: string
          lang?: string | null
          post_score?: number | null
          pre_score?: number | null
          rating_clarity?: number | null
          rating_flow?: number | null
          total?: number | null
          total_stops?: number | null
        }
        Relationships: []
      }
      sources: {
        Row: {
          author_ar: string | null
          author_en: string | null
          edition_ar: string | null
          edition_en: string | null
          id: string
          notes_ar: string | null
          title_ar: string
          title_en: string | null
          url: string | null
        }
        Insert: {
          author_ar?: string | null
          author_en?: string | null
          edition_ar?: string | null
          edition_en?: string | null
          id: string
          notes_ar?: string | null
          title_ar: string
          title_en?: string | null
          url?: string | null
        }
        Update: {
          author_ar?: string | null
          author_en?: string | null
          edition_ar?: string | null
          edition_en?: string | null
          id?: string
          notes_ar?: string | null
          title_ar?: string
          title_en?: string | null
          url?: string | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          body: string
          consent: boolean
          created_at: string
          display_name: string | null
          id: number
          journey_slug: string | null
          lang: string | null
          status: Database["public"]["Enums"]["review_status"]
        }
        Insert: {
          body: string
          consent: boolean
          created_at?: string
          display_name?: string | null
          id?: number
          journey_slug?: string | null
          lang?: string | null
          status?: Database["public"]["Enums"]["review_status"]
        }
        Update: {
          body?: string
          consent?: boolean
          created_at?: string
          display_name?: string | null
          id?: number
          journey_slug?: string | null
          lang?: string | null
          status?: Database["public"]["Enums"]["review_status"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      guide_calls_since: { Args: { since: string }; Returns: number }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      claim_kind: "fact" | "virtue" | "humane" | "practical"
      content_level: "A" | "B" | "C" | "D"
      media_provider: "storage" | "youtube" | "bunny"
      media_type: "photo" | "video"
      place_category: "mosque" | "well" | "garden" | "historical_site" | "other"
      review_status: "pending" | "verified" | "rejected"
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
      claim_kind: ["fact", "virtue", "humane", "practical"],
      content_level: ["A", "B", "C", "D"],
      media_provider: ["storage", "youtube", "bunny"],
      media_type: ["photo", "video"],
      place_category: ["mosque", "well", "garden", "historical_site", "other"],
      review_status: ["pending", "verified", "rejected"],
    },
  },
} as const
