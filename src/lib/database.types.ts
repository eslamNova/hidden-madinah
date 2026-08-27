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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      media_provider: "storage" | "youtube" | "bunny"
      media_type: "photo" | "video"
      place_category: "mosque" | "well" | "garden" | "historical_site" | "other"
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
      media_provider: ["storage", "youtube", "bunny"],
      media_type: ["photo", "video"],
      place_category: ["mosque", "well", "garden", "historical_site", "other"],
    },
  },
} as const
