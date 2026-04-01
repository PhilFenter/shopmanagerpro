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
      action_items: {
        Row: {
          checklist: Json | null
          completed_at: string | null
          created_at: string
          created_by: string
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          due_date: string | null
          id: string
          job_id: string | null
          notes: string | null
          priority: string | null
          quote_id: string | null
          source: string | null
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          checklist?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          priority?: string | null
          quote_id?: string | null
          source?: string | null
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          checklist?: Json | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          job_id?: string | null
          notes?: string | null
          priority?: string | null
          quote_id?: string | null
          source?: string | null
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_with_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      checklist_instances: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          id: string
          items: Json
          job_id: string | null
          status: string
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          items?: Json
          job_id?: string | null
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          items?: Json
          job_id?: string | null
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_instances_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instances_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_with_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string
          department: string | null
          description: string | null
          id: string
          items: Json
          sop_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by: string
          department?: string | null
          description?: string | null
          id?: string
          items?: Json
          sop_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string
          department?: string | null
          description?: string | null
          id?: string
          items?: Json
          sop_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_messages: {
        Row: {
          body: string
          channel: string
          created_at: string
          customer_id: string | null
          direction: string
          external_id: string | null
          id: string
          job_id: string | null
          recipient: string | null
          sent_by: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          customer_id?: string | null
          direction?: string
          external_id?: string | null
          id?: string
          job_id?: string | null
          recipient?: string | null
          sent_by?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          customer_id?: string | null
          direction?: string
          external_id?: string | null
          id?: string
          job_id?: string | null
          recipient?: string | null
          sent_by?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_messages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_with_access"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company: string | null
          created_at: string
          email: string | null
          first_order_date: string | null
          id: string
          last_order_date: string | null
          name: string
          notes: string | null
          phone: string | null
          preferred_contact: string | null
          referral_source: string | null
          source: string | null
          state: string | null
          tags: string[] | null
          title: string | null
          total_orders: number | null
          total_revenue: number | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          first_order_date?: string | null
          id?: string
          last_order_date?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          preferred_contact?: string | null
          referral_source?: string | null
          source?: string | null
          state?: string | null
          tags?: string[] | null
          title?: string | null
          total_orders?: number | null
          total_revenue?: number | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          first_order_date?: string | null
          id?: string
          last_order_date?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          preferred_contact?: string | null
          referral_source?: string | null
          source?: string | null
          state?: string | null
          tags?: string[] | null
          title?: string | null
          total_orders?: number | null
          total_revenue?: number | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      dtf_recipes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_name: string | null
          fabric_type: string
          id: string
          job_id: string | null
          name: string
          notes: string | null
          peel_type: string | null
          press_pressure: string | null
          press_temp: number | null
          press_time: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          fabric_type: string
          id?: string
          job_id?: string | null
          name: string
          notes?: string | null
          peel_type?: string | null
          press_pressure?: string | null
          press_temp?: number | null
          press_time?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          fabric_type?: string
          id?: string
          job_id?: string | null
          name?: string
          notes?: string | null
          peel_type?: string | null
          press_pressure?: string | null
          press_temp?: number | null
          press_time?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dtf_recipes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dtf_recipes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_with_access"
            referencedColumns: ["id"]
          },
        ]
      }
      embroidery_recipes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_name: string | null
          design_file: string | null
          hoop_size: string | null
          id: string
          job_id: string | null
          name: string
          needle_setup: Json
          notes: string | null
          placement: string | null
          stitch_count: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          design_file?: string | null
          hoop_size?: string | null
          id?: string
          job_id?: string | null
          name: string
          needle_setup?: Json
          notes?: string | null
          placement?: string | null
          stitch_count?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          design_file?: string | null
          hoop_size?: string | null
          id?: string
          job_id?: string | null
          name?: string
          needle_setup?: Json
          notes?: string | null
          placement?: string | null
          stitch_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "embroidery_recipes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "embroidery_recipes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_with_access"
            referencedColumns: ["id"]
          },
        ]
      }
      garment_inventory: {
        Row: {
          bin: string | null
          brand: string | null
          color: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          location: string | null
          notes: string | null
          quantity: number
          size: string | null
          style_number: string
          unit_cost: number | null
          updated_at: string
        }
        Insert: {
          bin?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          quantity?: number
          size?: string | null
          style_number: string
          unit_cost?: number | null
          updated_at?: string
        }
        Update: {
          bin?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          quantity?: number
          size?: string | null
          style_number?: string
          unit_cost?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      job_garments: {
        Row: {
          color: string | null
          created_at: string
          decoration_cost: number | null
          decoration_type: string | null
          description: string | null
          id: string
          image_url: string | null
          item_number: string | null
          job_id: string
          markup_pct: number | null
          placement: string | null
          printavo_line_item_id: string | null
          quantity: number
          sizes: Json | null
          style: string | null
          total_cost: number | null
          unit_cost: number | null
          unit_sell_price: number | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          decoration_cost?: number | null
          decoration_type?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          item_number?: string | null
          job_id: string
          markup_pct?: number | null
          placement?: string | null
          printavo_line_item_id?: string | null
          quantity?: number
          sizes?: Json | null
          style?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          unit_sell_price?: number | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          decoration_cost?: number | null
          decoration_type?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          item_number?: string | null
          job_id?: string
          markup_pct?: number | null
          placement?: string | null
          printavo_line_item_id?: string | null
          quantity?: number
          sizes?: Json | null
          style?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          unit_sell_price?: number | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_garments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_garments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_with_access"
            referencedColumns: ["id"]
          },
        ]
      }
      job_line_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          job_id: string
          material_cost: number | null
          quantity: number
          sale_price: number | null
          service_type: Database["public"]["Enums"]["service_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          job_id: string
          material_cost?: number | null
          quantity?: number
          sale_price?: number | null
          service_type?: Database["public"]["Enums"]["service_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          job_id?: string
          material_cost?: number | null
          quantity?: number
          sale_price?: number | null
          service_type?: Database["public"]["Enums"]["service_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_line_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_line_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_with_access"
            referencedColumns: ["id"]
          },
        ]
      }
      job_mockups: {
        Row: {
          approved_at: string | null
          approved_by_customer: boolean | null
          canvas_state: Json | null
          created_at: string
          created_by: string | null
          customer_notes: string | null
          filename: string
          garment_id: string | null
          id: string
          is_approval_version: boolean
          job_id: string | null
          placement: string | null
          quote_id: string | null
          storage_path: string
          updated_at: string
          version_number: number
        }
        Insert: {
          approved_at?: string | null
          approved_by_customer?: boolean | null
          canvas_state?: Json | null
          created_at?: string
          created_by?: string | null
          customer_notes?: string | null
          filename: string
          garment_id?: string | null
          id?: string
          is_approval_version?: boolean
          job_id?: string | null
          placement?: string | null
          quote_id?: string | null
          storage_path: string
          updated_at?: string
          version_number?: number
        }
        Update: {
          approved_at?: string | null
          approved_by_customer?: boolean | null
          canvas_state?: Json | null
          created_at?: string
          created_by?: string | null
          customer_notes?: string | null
          filename?: string
          garment_id?: string | null
          id?: string
          is_approval_version?: boolean
          job_id?: string | null
          placement?: string | null
          quote_id?: string | null
          storage_path?: string
          updated_at?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_mockups_garment_id_fkey"
            columns: ["garment_id"]
            isOneToOne: false
            referencedRelation: "job_garments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_mockups_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_mockups_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_with_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_mockups_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      job_photos: {
        Row: {
          created_at: string
          description: string | null
          filename: string
          id: string
          job_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          filename: string
          id?: string
          job_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          filename?: string
          id?: string
          job_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_photos_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_with_access"
            referencedColumns: ["id"]
          },
        ]
      }
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
          {
            foreignKeyName: "job_stage_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_with_access"
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
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          description: string | null
          due_date: string | null
          external_id: string | null
          id: string
          invoice_number: string | null
          material_cost: number | null
          order_number: string | null
          paid_at: string | null
          printavo_status: string | null
          quantity: number
          sale_price: number | null
          service_type: Database["public"]["Enums"]["service_type"]
          source: string | null
          stage: Database["public"]["Enums"]["job_stage"]
          stage_updated_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          tax_collected: number | null
          time_tracked: number
          timer_started_at: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          invoice_number?: string | null
          material_cost?: number | null
          order_number?: string | null
          paid_at?: string | null
          printavo_status?: string | null
          quantity?: number
          sale_price?: number | null
          service_type?: Database["public"]["Enums"]["service_type"]
          source?: string | null
          stage?: Database["public"]["Enums"]["job_stage"]
          stage_updated_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tax_collected?: number | null
          time_tracked?: number
          timer_started_at?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          description?: string | null
          due_date?: string | null
          external_id?: string | null
          id?: string
          invoice_number?: string | null
          material_cost?: number | null
          order_number?: string | null
          paid_at?: string | null
          printavo_status?: string | null
          quantity?: number
          sale_price?: number | null
          service_type?: Database["public"]["Enums"]["service_type"]
          source?: string | null
          stage?: Database["public"]["Enums"]["job_stage"]
          stage_updated_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          tax_collected?: number | null
          time_tracked?: number
          timer_started_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      leather_recipes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_name: string | null
          id: string
          job_id: string | null
          laser_frequency: number | null
          laser_power: number | null
          laser_speed: number | null
          material_cost_per_piece: number | null
          material_type: string
          name: string
          notes: string | null
          passes: number | null
          patch_height: number | null
          patch_width: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          job_id?: string | null
          laser_frequency?: number | null
          laser_power?: number | null
          laser_speed?: number | null
          material_cost_per_piece?: number | null
          material_type: string
          name: string
          notes?: string | null
          passes?: number | null
          patch_height?: number | null
          patch_width?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          id?: string
          job_id?: string | null
          laser_frequency?: number | null
          laser_power?: number | null
          laser_speed?: number | null
          material_cost_per_piece?: number | null
          material_type?: string
          name?: string
          notes?: string | null
          passes?: number | null
          patch_height?: number | null
          patch_width?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leather_recipes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leather_recipes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_with_access"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          category: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          body: string
          category?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          category?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          created_at: string
          custom_label: string | null
          email_subject: string | null
          email_template: string | null
          id: string
          is_custom: boolean
          notify_customer: boolean
          sms_template: string | null
          stage: Database["public"]["Enums"]["job_stage"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_label?: string | null
          email_subject?: string | null
          email_template?: string | null
          id?: string
          is_custom?: boolean
          notify_customer?: boolean
          sms_template?: string | null
          stage: Database["public"]["Enums"]["job_stage"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_label?: string | null
          email_subject?: string | null
          email_template?: string | null
          id?: string
          is_custom?: boolean
          notify_customer?: boolean
          sms_template?: string | null
          stage?: Database["public"]["Enums"]["job_stage"]
          updated_at?: string
        }
        Relationships: []
      }
      overhead_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          monthly_cost: number
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          monthly_cost?: number
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          monthly_cost?: number
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pricing_matrices: {
        Row: {
          column_headers: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          rows: Json
          service_type: string
          updated_at: string
        }
        Insert: {
          column_headers?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          rows?: Json
          service_type: string
          updated_at?: string
        }
        Update: {
          column_headers?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          rows?: Json
          service_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_catalog: {
        Row: {
          brand: string | null
          case_price: number | null
          category: string | null
          color_group: string | null
          created_at: string
          description: string | null
          id: string
          map_price: number | null
          msrp: number | null
          piece_price: number | null
          price_code: string | null
          size_range: string | null
          style_number: string
          supplier: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          case_price?: number | null
          category?: string | null
          color_group?: string | null
          created_at?: string
          description?: string | null
          id?: string
          map_price?: number | null
          msrp?: number | null
          piece_price?: number | null
          price_code?: string | null
          size_range?: string | null
          style_number: string
          supplier?: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          case_price?: number | null
          category?: string | null
          color_group?: string | null
          created_at?: string
          description?: string | null
          id?: string
          map_price?: number | null
          msrp?: number | null
          piece_price?: number | null
          price_code?: string | null
          size_range?: string | null
          style_number?: string
          supplier?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          hourly_rate: number | null
          id: string
          is_salary: boolean
          monthly_salary: number | null
          updated_at: string
          user_id: string
          weekly_hours: number
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          is_salary?: boolean
          monthly_salary?: number | null
          updated_at?: string
          user_id: string
          weekly_hours?: number
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          hourly_rate?: number | null
          id?: string
          is_salary?: boolean
          monthly_salary?: number | null
          updated_at?: string
          user_id?: string
          weekly_hours?: number
        }
        Relationships: []
      }
      quote_imprints: {
        Row: {
          column_value: string | null
          created_at: string
          decoration_type: string
          description: string | null
          id: string
          matrix_id: string | null
          placement: string | null
          quote_id: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          column_value?: string | null
          created_at?: string
          decoration_type?: string
          description?: string | null
          id?: string
          matrix_id?: string | null
          placement?: string | null
          quote_id: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          column_value?: string | null
          created_at?: string
          decoration_type?: string
          description?: string | null
          id?: string
          matrix_id?: string | null
          placement?: string | null
          quote_id?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_imprints_matrix_id_fkey"
            columns: ["matrix_id"]
            isOneToOne: false
            referencedRelation: "pricing_matrices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_imprints_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_line_items: {
        Row: {
          color: string | null
          created_at: string
          decoration_cost: number | null
          decoration_params: Json | null
          description: string | null
          garment_cost: number | null
          garment_markup_pct: number | null
          id: string
          image_url: string | null
          imprint_id: string | null
          line_total: number | null
          notes: string | null
          placement: string | null
          quantity: number
          quote_id: string
          service_type: string
          size_costs: Json | null
          sizes: Json | null
          sort_order: number | null
          style_number: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          decoration_cost?: number | null
          decoration_params?: Json | null
          description?: string | null
          garment_cost?: number | null
          garment_markup_pct?: number | null
          id?: string
          image_url?: string | null
          imprint_id?: string | null
          line_total?: number | null
          notes?: string | null
          placement?: string | null
          quantity?: number
          quote_id: string
          service_type?: string
          size_costs?: Json | null
          sizes?: Json | null
          sort_order?: number | null
          style_number?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          decoration_cost?: number | null
          decoration_params?: Json | null
          description?: string | null
          garment_cost?: number | null
          garment_markup_pct?: number | null
          id?: string
          image_url?: string | null
          imprint_id?: string | null
          line_total?: number | null
          notes?: string | null
          placement?: string | null
          quantity?: number
          quote_id?: string
          service_type?: string
          size_costs?: Json | null
          sizes?: Json | null
          sort_order?: number | null
          style_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_line_items_imprint_id_fkey"
            columns: ["imprint_id"]
            isOneToOne: false
            referencedRelation: "quote_imprints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_line_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          apply_sales_tax: boolean
          approval_token: string | null
          approved_at: string | null
          city: string | null
          company: string | null
          converted_job_id: string | null
          created_at: string
          created_by: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          delivery_method: string | null
          expires_at: string | null
          follow_up_count: number
          follow_up_enabled: boolean
          follow_up_sent_at: string | null
          id: string
          is_nonprofit: boolean
          notes: string | null
          payment_terms: string | null
          po_number: string | null
          printavo_order_id: string | null
          printavo_visual_id: string | null
          quote_number: string | null
          quote_sent_at: string | null
          raw_email: string | null
          requested_date: string | null
          shipping_address: string | null
          state: string | null
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          tax_rate: number
          total_price: number | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          apply_sales_tax?: boolean
          approval_token?: string | null
          approved_at?: string | null
          city?: string | null
          company?: string | null
          converted_job_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          delivery_method?: string | null
          expires_at?: string | null
          follow_up_count?: number
          follow_up_enabled?: boolean
          follow_up_sent_at?: string | null
          id?: string
          is_nonprofit?: boolean
          notes?: string | null
          payment_terms?: string | null
          po_number?: string | null
          printavo_order_id?: string | null
          printavo_visual_id?: string | null
          quote_number?: string | null
          quote_sent_at?: string | null
          raw_email?: string | null
          requested_date?: string | null
          shipping_address?: string | null
          state?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tax_rate?: number
          total_price?: number | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          apply_sales_tax?: boolean
          approval_token?: string | null
          approved_at?: string | null
          city?: string | null
          company?: string | null
          converted_job_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          delivery_method?: string | null
          expires_at?: string | null
          follow_up_count?: number
          follow_up_enabled?: boolean
          follow_up_sent_at?: string | null
          id?: string
          is_nonprofit?: boolean
          notes?: string | null
          payment_terms?: string | null
          po_number?: string | null
          printavo_order_id?: string | null
          printavo_visual_id?: string | null
          quote_number?: string | null
          quote_sent_at?: string | null
          raw_email?: string | null
          requested_date?: string | null
          shipping_address?: string | null
          state?: string | null
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          tax_rate?: number
          total_price?: number | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_converted_job_id_fkey"
            columns: ["converted_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_converted_job_id_fkey"
            columns: ["converted_job_id"]
            isOneToOne: false
            referencedRelation: "jobs_with_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      screen_print_recipes: {
        Row: {
          created_at: string
          created_by: string | null
          cure_temp: number | null
          cure_time: number | null
          customer_name: string | null
          flash_temp: number | null
          flash_time: number | null
          id: string
          ink_colors: Json | null
          job_id: string | null
          name: string
          notes: string | null
          platen_setup: Json
          print_type: string
          quality_rating: number | null
          rotation_sequence: Json | null
          squeegee_settings: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          cure_temp?: number | null
          cure_time?: number | null
          customer_name?: string | null
          flash_temp?: number | null
          flash_time?: number | null
          id?: string
          ink_colors?: Json | null
          job_id?: string | null
          name: string
          notes?: string | null
          platen_setup?: Json
          print_type?: string
          quality_rating?: number | null
          rotation_sequence?: Json | null
          squeegee_settings?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cure_temp?: number | null
          cure_time?: number | null
          customer_name?: string | null
          flash_temp?: number | null
          flash_time?: number | null
          id?: string
          ink_colors?: Json | null
          job_id?: string | null
          name?: string
          notes?: string | null
          platen_setup?: Json
          print_type?: string
          quality_rating?: number | null
          rotation_sequence?: Json | null
          squeegee_settings?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_print_recipes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screen_print_recipes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_with_access"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_steps: {
        Row: {
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          sop_id: string
          sort_order: number
          tip: string | null
          title: string
          updated_at: string
          video_url: string | null
          warning: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          sop_id: string
          sort_order?: number
          tip?: string | null
          title: string
          updated_at?: string
          video_url?: string | null
          warning?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          sop_id?: string
          sort_order?: number
          tip?: string | null
          title?: string
          updated_at?: string
          video_url?: string | null
          warning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_steps_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      sops: {
        Row: {
          category: string
          cover_image_url: string | null
          created_at: string
          created_by: string
          department: string | null
          description: string | null
          id: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          department?: string | null
          description?: string | null
          id?: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          category?: string
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          department?: string | null
          description?: string | null
          id?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
          version?: number
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
          line_item_id: string | null
          notes: string | null
          started_at: string
          user_id: string | null
          worker_id: string | null
        }
        Insert: {
          created_at?: string
          duration?: number | null
          ended_at?: string | null
          id?: string
          job_id: string
          line_item_id?: string | null
          notes?: string | null
          started_at: string
          user_id?: string | null
          worker_id?: string | null
        }
        Update: {
          created_at?: string
          duration?: number | null
          ended_at?: string | null
          id?: string
          job_id?: string
          line_item_id?: string | null
          notes?: string | null
          started_at?: string
          user_id?: string | null
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs_with_access"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_line_item_id_fkey"
            columns: ["line_item_id"]
            isOneToOne: false
            referencedRelation: "job_line_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_worker_id_fkey"
            columns: ["worker_id"]
            isOneToOne: false
            referencedRelation: "workers"
            referencedColumns: ["id"]
          },
        ]
      }
      training_assignments: {
        Row: {
          assigned_by: string
          assigned_to: string
          completed_at: string | null
          completed_checklist_ids: string[] | null
          completed_sop_ids: string[] | null
          created_at: string
          id: string
          started_at: string | null
          status: string
          training_plan_id: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          completed_at?: string | null
          completed_checklist_ids?: string[] | null
          completed_sop_ids?: string[] | null
          created_at?: string
          id?: string
          started_at?: string | null
          status?: string
          training_plan_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          completed_at?: string | null
          completed_checklist_ids?: string[] | null
          completed_sop_ids?: string[] | null
          created_at?: string
          id?: string
          started_at?: string | null
          status?: string
          training_plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_assignments_training_plan_id_fkey"
            columns: ["training_plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plans: {
        Row: {
          checklist_template_ids: string[] | null
          created_at: string
          created_by: string
          department: string | null
          description: string | null
          id: string
          role: string | null
          sop_ids: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          checklist_template_ids?: string[] | null
          created_at?: string
          created_by: string
          department?: string | null
          description?: string | null
          id?: string
          role?: string | null
          sop_ids?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          checklist_template_ids?: string[] | null
          created_at?: string
          created_by?: string
          department?: string | null
          description?: string | null
          id?: string
          role?: string | null
          sop_ids?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      workers: {
        Row: {
          created_at: string
          hourly_rate: number | null
          id: string
          is_active: boolean
          is_salary: boolean
          monthly_salary: number | null
          name: string
          notes: string | null
          profile_id: string | null
          updated_at: string
          weekly_hours: number
        }
        Insert: {
          created_at?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          is_salary?: boolean
          monthly_salary?: number | null
          name: string
          notes?: string | null
          profile_id?: string | null
          updated_at?: string
          weekly_hours?: number
        }
        Update: {
          created_at?: string
          hourly_rate?: number | null
          id?: string
          is_active?: boolean
          is_salary?: boolean
          monthly_salary?: number | null
          name?: string
          notes?: string | null
          profile_id?: string | null
          updated_at?: string
          weekly_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "workers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "team_members_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      jobs_with_access: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          description: string | null
          external_id: string | null
          id: string | null
          invoice_number: string | null
          material_cost: number | null
          order_number: string | null
          quantity: number | null
          sale_price: number | null
          service_type: Database["public"]["Enums"]["service_type"] | null
          source: string | null
          stage: Database["public"]["Enums"]["job_stage"] | null
          stage_updated_at: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          time_tracked: number | null
          timer_started_at: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          external_id?: string | null
          id?: string | null
          invoice_number?: string | null
          material_cost?: never
          order_number?: string | null
          quantity?: number | null
          sale_price?: never
          service_type?: Database["public"]["Enums"]["service_type"] | null
          source?: string | null
          stage?: Database["public"]["Enums"]["job_stage"] | null
          stage_updated_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          time_tracked?: number | null
          timer_started_at?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          description?: string | null
          external_id?: string | null
          id?: string | null
          invoice_number?: string | null
          material_cost?: never
          order_number?: string | null
          quantity?: number | null
          sale_price?: never
          service_type?: Database["public"]["Enums"]["service_type"] | null
          source?: string | null
          stage?: Database["public"]["Enums"]["job_stage"] | null
          stage_updated_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          time_tracked?: number | null
          timer_started_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      team_members_public: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          hourly_rate: number | null
          id: string | null
          is_salary: boolean | null
          monthly_salary: number | null
          updated_at: string | null
          user_id: string | null
          weekly_hours: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          hourly_rate?: never
          id?: string | null
          is_salary?: never
          monthly_salary?: never
          updated_at?: string | null
          user_id?: string | null
          weekly_hours?: never
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          hourly_rate?: never
          id?: string | null
          is_salary?: never
          monthly_salary?: never
          updated_at?: string | null
          user_id?: string | null
          weekly_hours?: never
        }
        Relationships: []
      }
    }
    Functions: {
      add_business_days: {
        Args: { num_days: number; start_date: string }
        Returns: string
      }
      has_financial_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "team" | "manager"
      job_stage:
        | "received"
        | "art_approved"
        | "product_ordered"
        | "product_arrived"
        | "product_staged"
        | "in_production"
        | "production_complete"
        | "qc_complete"
        | "packaged"
        | "customer_notified"
        | "delivered"
        | "picked_up"
        | "shipped"
      job_status: "pending" | "in_progress" | "completed" | "on_hold"
      service_type:
        | "embroidery"
        | "screen_print"
        | "dtf"
        | "leather_patch"
        | "other"
        | "uv_patch"
        | "heat_press_patch"
        | "woven_patch"
        | "pvc_patch"
        | "mixed"
        | "laser_engraving"
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
      app_role: ["admin", "team", "manager"],
      job_stage: [
        "received",
        "art_approved",
        "product_ordered",
        "product_arrived",
        "product_staged",
        "in_production",
        "production_complete",
        "qc_complete",
        "packaged",
        "customer_notified",
        "delivered",
        "picked_up",
        "shipped",
      ],
      job_status: ["pending", "in_progress", "completed", "on_hold"],
      service_type: [
        "embroidery",
        "screen_print",
        "dtf",
        "leather_patch",
        "other",
        "uv_patch",
        "heat_press_patch",
        "woven_patch",
        "pvc_patch",
        "mixed",
        "laser_engraving",
      ],
    },
  },
} as const
