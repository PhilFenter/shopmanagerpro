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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      job_stage_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_stage: Database["public"]["Enums"]["job_stage"] | null
          id: string
          job_id: string
          notes: string | null
          to_stage: Database["public"]["Enums"]["job_stage"]
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_stage?: Database["public"]["Enums"]["job_stage"] | null
          id?: string
          job_id: string
          notes?: string | null
          to_stage: Database["public"]["Enums"]["job_stage"]
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_stage?: Database["public"]["Enums"]["job_stage"] | null
          id?: string
          job_id?: string
          notes?: string | null
          to_stage?: Database["public"]["Enums"]["job_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "job_stage_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          description: string | null
          external_id: string | null
          id: string
          invoice_number: string | null
          material_cost: number | null
          order_number: string | null
          quantity: number
          sale_price: number | null
          service_type: Database["public"]["Enums"]["service_type"]
          source: string | null
          stage: Database["public"]["Enums"]["job_stage"]
          stage_updated_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          time_tracked: number
          timer_started_at: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          invoice_number?: string | null
          material_cost?: number | null
          order_number?: string | null
          quantity?: number
          sale_price?: number | null
          service_type?: Database["public"]["Enums"]["service_type"]
          source?: string | null
          stage?: Database["public"]["Enums"]["job_stage"]
          stage_updated_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          time_tracked?: number
          timer_started_at?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          description?: string | null
          external_id?: string | null
          id?: string
          invoice_number?: string | null
          material_cost?: number | null
          order_number?: string | null
          quantity?: number
          sale_price?: number | null
          service_type?: Database["public"]["Enums"]["service_type"]
          source?: string | null
          stage?: Database["public"]["Enums"]["job_stage"]
          stage_updated_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          time_tracked?: number
          timer_started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string
          email_template: string | null
          id: string
          notify_customer: boolean
          sms_template: string | null
          stage: Database["public"]["Enums"]["job_stage"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_template?: string | null
          id?: string
          notify_customer?: boolean
          sms_template?: string | null
          stage: Database["public"]["Enums"]["job_stage"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_template?: string | null
          id?: string
          notify_customer?: boolean
          sms_template?: string | null
          stage?: Database["public"]["Enums"]["job_stage"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          created_at: string
          duration: number | null
          ended_at: string | null
          id: string
          job_id: string
          notes: string | null
          started_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration?: number | null
          ended_at?: string | null
          id?: string
          job_id: string
          notes?: string | null
          started_at: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration?: number | null
          ended_at?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          started_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "team"
      job_stage:
        | "received"
        | "art_approved"
        | "in_production"
        | "production_complete"
        | "qc_complete"
        | "packaged"
        | "customer_notified"
        | "delivered"
      job_status: "pending" | "in_progress" | "completed" | "on_hold"
      service_type:
        | "embroidery"
        | "screen_print"
        | "dtf"
        | "leather_patch"
        | "other"
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
      app_role: ["admin", "team"],
      job_stage: [
        "received",
        "art_approved",
        "in_production",
        "production_complete",
        "qc_complete",
        "packaged",
        "customer_notified",
        "delivered",
      ],
      job_status: ["pending", "in_progress", "completed", "on_hold"],
      service_type: [
        "embroidery",
        "screen_print",
        "dtf",
        "leather_patch",
        "other",
      ],
    },
  },
} as const
