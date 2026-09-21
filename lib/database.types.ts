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
      business_enquiries: {
        Row: {
          company_name: string
          contact_name: string
          created_at: string
          email: string | null
          enquiry_type: string
          estimated_daily_scm: number | null
          fleet_size: number | null
          id: string
          message: string | null
          operating_locations: string | null
          phone: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          company_name: string
          contact_name: string
          created_at?: string
          email?: string | null
          enquiry_type: string
          estimated_daily_scm?: number | null
          fleet_size?: number | null
          id?: string
          message?: string | null
          operating_locations?: string | null
          phone?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string | null
          enquiry_type?: string
          estimated_daily_scm?: number | null
          fleet_size?: number | null
          id?: string
          message?: string | null
          operating_locations?: string | null
          phone?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      marketplace_enquiries: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          listing_id: string
          message: string | null
          phone: string | null
          status: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          listing_id: string
          message?: string | null
          phone?: string | null
          status?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          message?: string | null
          phone?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_enquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          brand: string | null
          category: string
          certification: string | null
          city: string | null
          condition: string
          created_at: string
          description: string | null
          equipment_verification_status: string
          id: string
          image_url: string | null
          is_featured: boolean
          model: string | null
          price: number | null
          price_on_request: boolean
          quantity: number
          seller_id: string
          specifications: string | null
          state: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category: string
          certification?: string | null
          city?: string | null
          condition: string
          created_at?: string
          description?: string | null
          equipment_verification_status?: string
          id?: string
          image_url?: string | null
          is_featured?: boolean
          model?: string | null
          price?: number | null
          price_on_request?: boolean
          quantity?: number
          seller_id: string
          specifications?: string | null
          state?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category?: string
          certification?: string | null
          city?: string | null
          condition?: string
          created_at?: string
          description?: string | null
          equipment_verification_status?: string
          id?: string
          image_url?: string | null
          is_featured?: boolean
          model?: string | null
          price?: number | null
          price_on_request?: boolean
          quantity?: number
          seller_id?: string
          specifications?: string | null
          state?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "marketplace_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_sellers: {
        Row: {
          business_name: string
          city: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          phone: string | null
          state: string | null
          updated_at: string
          user_id: string
          verification_status: string
        }
        Insert: {
          business_name: string
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
          verification_status?: string
        }
        Update: {
          business_name?: string
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      search_events: {
        Row: {
          created_at: string
          destination: string | null
          event_type: string
          id: number
          origin: string | null
          query: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          destination?: string | null
          event_type: string
          id?: number
          origin?: string | null
          query?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          destination?: string | null
          event_type?: string
          id?: number
          origin?: string | null
          query?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      service_enquiries: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          message: string | null
          offering_id: string | null
          phone: string | null
          provider_id: string
          status: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          message?: string | null
          offering_id?: string | null
          phone?: string | null
          provider_id: string
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          message?: string | null
          offering_id?: string | null
          phone?: string | null
          provider_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_enquiries_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "service_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_enquiries_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_offerings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          price_from: number | null
          provider_id: string
          status: string
          title: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          price_from?: number | null
          provider_id: string
          status?: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          price_from?: number | null
          provider_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_offerings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      service_providers: {
        Row: {
          address: string | null
          business_name: string
          city: string | null
          created_at: string
          description: string | null
          email: string | null
          id: string
          phone: string | null
          provider_type: string
          state: string | null
          user_id: string
          verification_status: string
        }
        Insert: {
          address?: string | null
          business_name: string
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          provider_type: string
          state?: string | null
          user_id: string
          verification_status?: string
        }
        Update: {
          address?: string | null
          business_name?: string
          city?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          id?: string
          phone?: string | null
          provider_type?: string
          state?: string | null
          user_id?: string
          verification_status?: string
        }
        Relationships: []
      }
      station_claims: {
        Row: {
          business_name: string | null
          created_at: string
          id: string
          note: string | null
          phone: string | null
          reviewed_at: string | null
          station_id: string
          status: Database["public"]["Enums"]["claim_status"]
          user_id: string
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          id?: string
          note?: string | null
          phone?: string | null
          reviewed_at?: string | null
          station_id: string
          status?: Database["public"]["Enums"]["claim_status"]
          user_id: string
        }
        Update: {
          business_name?: string | null
          created_at?: string
          id?: string
          note?: string | null
          phone?: string | null
          reviewed_at?: string | null
          station_id?: string
          status?: Database["public"]["Enums"]["claim_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_claims_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      station_reports: {
        Row: {
          created_at: string
          id: string
          is_moderated: boolean
          note: string | null
          price_per_scm: number | null
          queue_minutes: number | null
          station_id: string
          status: Database["public"]["Enums"]["station_status"] | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_moderated?: boolean
          note?: string | null
          price_per_scm?: number | null
          queue_minutes?: number | null
          station_id: string
          status?: Database["public"]["Enums"]["station_status"] | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_moderated?: boolean
          note?: string | null
          price_per_scm?: number | null
          queue_minutes?: number | null
          station_id?: string
          status?: Database["public"]["Enums"]["station_status"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "station_reports_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          address: string
          city: string | null
          claimed_by: string | null
          created_at: string
          email: string | null
          id: string
          is_demo: boolean
          is_verified: boolean
          last_verified_at: string | null
          latitude: number | null
          longitude: number | null
          name: string
          open_now: boolean | null
          opening_hours: string | null
          operator_name: string | null
          phone: string | null
          price_per_scm: number | null
          queue_minutes: number | null
          registration_status: string
          state: string | null
          status: Database["public"]["Enums"]["station_status"]
          submitted_by: string | null
          updated_at: string
          vehicle_compatibility: string[]
        }
        Insert: {
          address: string
          city?: string | null
          claimed_by?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_demo?: boolean
          is_verified?: boolean
          last_verified_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          open_now?: boolean | null
          opening_hours?: string | null
          operator_name?: string | null
          phone?: string | null
          price_per_scm?: number | null
          queue_minutes?: number | null
          registration_status?: string
          state?: string | null
          status?: Database["public"]["Enums"]["station_status"]
          submitted_by?: string | null
          updated_at?: string
          vehicle_compatibility?: string[]
        }
        Update: {
          address?: string
          city?: string | null
          claimed_by?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_demo?: boolean
          is_verified?: boolean
          last_verified_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          open_now?: boolean | null
          opening_hours?: string | null
          operator_name?: string | null
          phone?: string | null
          price_per_scm?: number | null
          queue_minutes?: number | null
          registration_status?: string
          state?: string | null
          status?: Database["public"]["Enums"]["station_status"]
          submitted_by?: string | null
          updated_at?: string
          vehicle_compatibility?: string[]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_user_role: { Args: { p_role: string }; Returns: undefined }
      admin_equipment_verification: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      admin_marketplace_listing: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      admin_marketplace_seller: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      admin_moderate_station_report: {
        Args: { p_apply: boolean; p_report_id: string }
        Returns: undefined
      }
      admin_review_station_registration: {
        Args: { p_approve: boolean; p_station_id: string }
        Returns: undefined
      }
      admin_service_offering: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      admin_service_provider: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      admin_update_business_enquiry: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      approve_station_claim: {
        Args: { p_approve: boolean; p_claim_id: string }
        Returns: undefined
      }
      approve_station_registration: {
        Args: { p_approve: boolean; p_station_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "driver" | "operator" | "admin"
      claim_status: "pending" | "approved" | "rejected"
      station_status:
        | "available"
        | "low_supply"
        | "out_of_gas"
        | "offline"
        | "unknown"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["driver", "operator", "admin"],
      claim_status: ["pending", "approved", "rejected"],
      station_status: [
        "available",
        "low_supply",
        "out_of_gas",
        "offline",
        "unknown",
      ],
    },
  },
} as const
