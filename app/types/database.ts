export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.1'
  }
  public: {
    Tables: {
      appointment_series_requests: {
        Row: {
          appointment_ids: string[]
          clinic_id: string
          created_at: string
          id: string
          idempotency_key: string
        }
        Insert: {
          appointment_ids: string[]
          clinic_id: string
          created_at?: string
          id?: string
          idempotency_key: string
        }
        Update: {
          appointment_ids?: string[]
          clinic_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
        }
        Relationships: [
          {
            foreignKeyName: 'appointment_series_requests_clinic_id_fkey'
            columns: ['clinic_id']
            isOneToOne: false
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
        ]
      }
      appointments: {
        Row: {
          clinic_id: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          end_time: string
          id: string
          idempotency_key: string | null
          notes: string | null
          patient_id: string
          reopened_at: string | null
          reopened_by: string | null
          series_id: string | null
          series_index: number | null
          start_time: string
          status: Database['public']['Enums']['appointment_status']
          status_before_completion: Database['public']['Enums']['appointment_status'] | null
          therapist_id: string | null
          treatment_plan_id: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          end_time: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          patient_id: string
          reopened_at?: string | null
          reopened_by?: string | null
          series_id?: string | null
          series_index?: number | null
          start_time: string
          status?: Database['public']['Enums']['appointment_status']
          status_before_completion?: Database['public']['Enums']['appointment_status'] | null
          therapist_id?: string | null
          treatment_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          end_time?: string
          id?: string
          idempotency_key?: string | null
          notes?: string | null
          patient_id?: string
          reopened_at?: string | null
          reopened_by?: string | null
          series_id?: string | null
          series_index?: number | null
          start_time?: string
          status?: Database['public']['Enums']['appointment_status']
          status_before_completion?: Database['public']['Enums']['appointment_status'] | null
          therapist_id?: string | null
          treatment_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'appointments_clinic_id_fkey'
            columns: ['clinic_id']
            isOneToOne: false
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_patient_id_fkey'
            columns: ['patient_id']
            isOneToOne: false
            referencedRelation: 'patients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_therapist_id_fkey'
            columns: ['therapist_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_treatment_plan_id_fkey'
            columns: ['treatment_plan_id']
            isOneToOne: false
            referencedRelation: 'treatment_plans'
            referencedColumns: ['id']
          },
        ]
      }
      clinic_invites: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          clinic_id: string
          created_at: string
          email_normalized: string
          expires_at: string
          id: string
          invited_by_user_id: string
          revoked_at: string | null
          role: Database['public']['Enums']['user_role']
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          clinic_id: string
          created_at?: string
          email_normalized: string
          expires_at: string
          id?: string
          invited_by_user_id: string
          revoked_at?: string | null
          role?: Database['public']['Enums']['user_role']
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          clinic_id?: string
          created_at?: string
          email_normalized?: string
          expires_at?: string
          id?: string
          invited_by_user_id?: string
          revoked_at?: string | null
          role?: Database['public']['Enums']['user_role']
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'clinic_invites_accepted_by_user_id_fkey'
            columns: ['accepted_by_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'clinic_invites_clinic_id_fkey'
            columns: ['clinic_id']
            isOneToOne: false
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'clinic_invites_invited_by_user_id_fkey'
            columns: ['invited_by_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      clinic_memberships: {
        Row: {
          clinic_id: string
          created_at: string
          created_by_user_id: string | null
          ended_at: string | null
          id: string
          role: Database['public']['Enums']['user_role']
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          created_by_user_id?: string | null
          ended_at?: string | null
          id?: string
          role?: Database['public']['Enums']['user_role']
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          created_by_user_id?: string | null
          ended_at?: string | null
          id?: string
          role?: Database['public']['Enums']['user_role']
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'clinic_memberships_clinic_id_fkey'
            columns: ['clinic_id']
            isOneToOne: false
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'clinic_memberships_created_by_user_id_fkey'
            columns: ['created_by_user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'clinic_memberships_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          clinic_id: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
        }
        Insert: {
          amount: number
          category: string
          clinic_id: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
        }
        Update: {
          amount?: number
          category?: string
          clinic_id?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'expenses_clinic_id_fkey'
            columns: ['clinic_id']
            isOneToOne: false
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          clinic_id: string
          created_at: string
          due_date: string | null
          id: string
          idempotency_key: string | null
          invoice_number: string
          line_items: Json
          notes: string | null
          patient_id: string
          status: Database['public']['Enums']['invoice_status']
          subtotal: number
          tax: number
          total: number
          treatment_plan_id: string | null
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          clinic_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_number: string
          line_items?: Json
          notes?: string | null
          patient_id: string
          status?: Database['public']['Enums']['invoice_status']
          subtotal?: number
          tax?: number
          total?: number
          treatment_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          clinic_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_number?: string
          line_items?: Json
          notes?: string | null
          patient_id?: string
          status?: Database['public']['Enums']['invoice_status']
          subtotal?: number
          tax?: number
          total?: number
          treatment_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_clinic_id_fkey'
            columns: ['clinic_id']
            isOneToOne: false
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_patient_id_fkey'
            columns: ['patient_id']
            isOneToOne: false
            referencedRelation: 'patients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'invoices_treatment_plan_id_fkey'
            columns: ['treatment_plan_id']
            isOneToOne: false
            referencedRelation: 'treatment_plans'
            referencedColumns: ['id']
          },
        ]
      }
      owner_onboardings: {
        Row: {
          clinic_id: string
          created_at: string
          membership_id: string
          user_id: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          membership_id: string
          user_id: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          membership_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'owner_onboardings_clinic_id_fkey'
            columns: ['clinic_id']
            isOneToOne: true
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'owner_onboardings_membership_id_fkey'
            columns: ['membership_id']
            isOneToOne: true
            referencedRelation: 'clinic_memberships'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'owner_onboardings_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          clinic_id: string
          created_at: string
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          full_name: string
          gender: Database['public']['Enums']['gender'] | null
          id: string
          is_archived: boolean
          medical_history: Json
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          clinic_id: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name: string
          gender?: Database['public']['Enums']['gender'] | null
          id?: string
          is_archived?: boolean
          medical_history?: Json
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          clinic_id?: string
          created_at?: string
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          full_name?: string
          gender?: Database['public']['Enums']['gender'] | null
          id?: string
          is_archived?: boolean
          medical_history?: Json
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'patients_clinic_id_fkey'
            columns: ['clinic_id']
            isOneToOne: false
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          clinic_id: string
          created_at: string
          id: string
          idempotency_key: string | null
          invoice_id: string
          method: Database['public']['Enums']['payment_method']
          notes: string | null
          paid_at: string
          recorded_by: string | null
        }
        Insert: {
          amount: number
          clinic_id: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          invoice_id: string
          method?: Database['public']['Enums']['payment_method']
          notes?: string | null
          paid_at?: string
          recorded_by?: string | null
        }
        Update: {
          amount?: number
          clinic_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string | null
          invoice_id?: string
          method?: Database['public']['Enums']['payment_method']
          notes?: string | null
          paid_at?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'payments_clinic_id_fkey'
            columns: ['clinic_id']
            isOneToOne: false
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payments_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'payments_recorded_by_fkey'
            columns: ['recorded_by']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_membership_id: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_membership_id?: string | null
          email: string
          full_name: string
          id: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_membership_id?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_default_membership_same_user_fkey'
            columns: ['default_membership_id', 'id']
            isOneToOne: false
            referencedRelation: 'clinic_memberships'
            referencedColumns: ['id', 'user_id']
          },
        ]
      }
      treatment_plans: {
        Row: {
          clinic_id: string
          created_at: string
          diagnosis: string | null
          id: string
          name: string
          notes: string | null
          package_price: number | null
          patient_id: string
          price_per_session: number | null
          status: Database['public']['Enums']['treatment_status']
          therapist_id: string | null
          total_sessions: number | null
          treatment_type: string | null
          updated_at: string
        }
        Insert: {
          clinic_id: string
          created_at?: string
          diagnosis?: string | null
          id?: string
          name: string
          notes?: string | null
          package_price?: number | null
          patient_id: string
          price_per_session?: number | null
          status?: Database['public']['Enums']['treatment_status']
          therapist_id?: string | null
          total_sessions?: number | null
          treatment_type?: string | null
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          created_at?: string
          diagnosis?: string | null
          id?: string
          name?: string
          notes?: string | null
          package_price?: number | null
          patient_id?: string
          price_per_session?: number | null
          status?: Database['public']['Enums']['treatment_status']
          therapist_id?: string | null
          total_sessions?: number | null
          treatment_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'treatment_plans_clinic_id_fkey'
            columns: ['clinic_id']
            isOneToOne: false
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'treatment_plans_patient_id_fkey'
            columns: ['patient_id']
            isOneToOne: false
            referencedRelation: 'patients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'treatment_plans_therapist_id_fkey'
            columns: ['therapist_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      treatment_sessions: {
        Row: {
          appointment_id: string
          clinic_id: string
          complaints: string | null
          created_at: string
          exercises_prescribed: string | null
          finalized_at: string
          id: string
          next_session_plan: string | null
          note_text: string | null
          notes: string | null
          observations: string | null
          patient_id: string
          plan_id: string | null
          practitioner_id: string
          session_number: number
          session_order_time: string
          status: Database['public']['Enums']['session_status']
          treatment_given: string | null
          treatment_plan_id: string | null
          updated_at: string
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          appointment_id: string
          clinic_id: string
          complaints?: string | null
          created_at?: string
          exercises_prescribed?: string | null
          finalized_at?: string
          id?: string
          next_session_plan?: string | null
          note_text?: string | null
          notes?: string | null
          observations?: string | null
          patient_id: string
          plan_id?: string | null
          practitioner_id: string
          session_number: number
          session_order_time: string
          status?: Database['public']['Enums']['session_status']
          treatment_given?: string | null
          treatment_plan_id?: string | null
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          appointment_id?: string
          clinic_id?: string
          complaints?: string | null
          created_at?: string
          exercises_prescribed?: string | null
          finalized_at?: string
          id?: string
          next_session_plan?: string | null
          note_text?: string | null
          notes?: string | null
          observations?: string | null
          patient_id?: string
          plan_id?: string | null
          practitioner_id?: string
          session_number?: number
          session_order_time?: string
          status?: Database['public']['Enums']['session_status']
          treatment_given?: string | null
          treatment_plan_id?: string | null
          updated_at?: string
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'treatment_sessions_appointment_id_fkey'
            columns: ['appointment_id']
            isOneToOne: false
            referencedRelation: 'appointments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'treatment_sessions_clinic_id_fkey'
            columns: ['clinic_id']
            isOneToOne: false
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'treatment_sessions_patient_id_fkey'
            columns: ['patient_id']
            isOneToOne: false
            referencedRelation: 'patients'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'treatment_sessions_plan_id_fkey'
            columns: ['plan_id']
            isOneToOne: false
            referencedRelation: 'treatment_plans'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'treatment_sessions_practitioner_id_fkey'
            columns: ['practitioner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'treatment_sessions_treatment_plan_id_fkey'
            columns: ['treatment_plan_id']
            isOneToOne: false
            referencedRelation: 'treatment_plans'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: {
        Args: { p_full_name: string; p_invite_token: string }
        Returns: Json
      }
      complete_appointment_with_session_note: {
        Args: {
          p_appointment_id: string
          p_clinic_id: string
          p_session_note?: string
        }
        Returns: Json
      }
      complete_registration: {
        Args: { clinic_name: string; full_name: string }
        Returns: Json
      }
      create_appointment: {
        Args: {
          p_clinic_id: string
          p_end_time: string
          p_idempotency_key?: string
          p_notes?: string
          p_patient_id: string
          p_start_time: string
          p_therapist_id: string
          p_treatment_plan_id?: string
        }
        Returns: Json
      }
      create_appointment_series:
        | {
            Args: {
              p_clinic_id: string
              p_notes?: string
              p_occurrences?: Json
              p_patient_id: string
              p_therapist_id: string
              p_treatment_plan_id?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_clinic_id: string
              p_idempotency_key?: string
              p_notes?: string
              p_occurrences?: Json
              p_patient_id: string
              p_therapist_id: string
              p_treatment_plan_id?: string
            }
            Returns: Json
          }
      create_invoice: {
        Args: {
          p_clinic_id: string
          p_due_date?: string
          p_idempotency_key?: string
          p_line_items?: Json
          p_notes?: string
          p_patient_id: string
          p_treatment_plan_id?: string
        }
        Returns: Json
      }
      create_staff_invite: {
        Args: {
          p_email: string
          p_role: Database['public']['Enums']['user_role']
        }
        Returns: Json
      }
      create_treatment_linked_appointment: {
        Args: {
          p_clinic_id: string
          p_end_time: string
          p_idempotency_key?: string
          p_notes?: string
          p_start_time: string
          p_therapist_id: string
          p_treatment_plan_id: string
        }
        Returns: Json
      }
      deactivate_membership: {
        Args: { p_membership_id: string }
        Returns: Json
      }
      get_dashboard_overview: {
        Args: {
          p_clinic_id: string
          p_now?: string
          p_range_end?: string
          p_today_local?: string
          p_tz_offset_minutes?: number
        }
        Returns: Json
      }
      get_invite_preview: { Args: { p_invite_token: string }; Returns: Json }
      get_treatment_invoice_prefill: {
        Args: { p_clinic_id: string; p_treatment_plan_id: string }
        Returns: Json
      }
      get_treatment_linked_appointments_bulk: {
        Args: {
          p_clinic_id: string
          p_limit_per_plan?: number
          p_now?: string
          p_plan_ids: string[]
        }
        Returns: {
          appointment_id: string
          end_time: string
          plan_id: string
          start_time: string
          status: Database['public']['Enums']['appointment_status']
        }[]
      }
      get_treatment_plan_progress_bulk: {
        Args: { p_clinic_id: string; p_plan_ids?: string[] }
        Returns: {
          completed_sessions: number
          plan_id: string
        }[]
      }
      get_treatment_session_history_bulk: {
        Args: {
          p_clinic_id: string
          p_limit_per_plan?: number
          p_plan_ids: string[]
        }
        Returns: {
          appointment_id: string
          finalized_at: string
          note: string
          plan_id: string
          session_id: string
        }[]
      }
      get_user_clinic_id: { Args: never; Returns: string }
      is_admin_of_clinic: {
        Args: { target_clinic_id: string }
        Returns: boolean
      }
      is_clinic_admin: { Args: never; Returns: boolean }
      is_member_of_clinic: {
        Args: { target_clinic_id: string }
        Returns: boolean
      }
      mask_email: { Args: { input: string }; Returns: string }
      normalize_email: { Args: { input: string }; Returns: string }
      normalize_invoice_line_items: {
        Args: { p_line_items: Json }
        Returns: {
          sanitized_line_items: Json
          sanitized_subtotal: number
        }[]
      }
      record_invoice_payment: {
        Args: {
          p_amount: number
          p_clinic_id: string
          p_idempotency_key?: string
          p_invoice_id: string
          p_method: Database['public']['Enums']['payment_method']
          p_paid_at: string
          p_reference_note?: string
        }
        Returns: Json
      }
      reopen_completed_appointment: {
        Args: { p_appointment_id: string; p_clinic_id: string }
        Returns: Json
      }
      set_default_membership: {
        Args: { p_membership_id: string }
        Returns: Json
      }
    }
    Enums: {
      appointment_status: 'scheduled' | 'completed' | 'cancelled' | 'no_show' | 'checked_in'
      gender: 'male' | 'female' | 'other'
      invoice_status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled'
      payment_method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'
      session_status: 'draft' | 'final' | 'voided'
      treatment_status: 'active' | 'completed' | 'cancelled'
      user_role: 'admin' | 'staff'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: ['scheduled', 'completed', 'cancelled', 'no_show', 'checked_in'],
      gender: ['male', 'female', 'other'],
      invoice_status: ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled'],
      payment_method: ['cash', 'upi', 'card', 'bank_transfer', 'other'],
      session_status: ['draft', 'final', 'voided'],
      treatment_status: ['active', 'completed', 'cancelled'],
      user_role: ['admin', 'staff'],
    },
  },
} as const

// Pre-resolved row types to avoid "excessively deep" TS2589 errors
// when used inside Vue's Ref<> and computed(). These are equivalent
// to Tables<'tablename'> but bypass the conditional type depth.
export type PatientRow = Database['public']['Tables']['patients']['Row']
export type AppointmentRow = Database['public']['Tables']['appointments']['Row']
export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type TreatmentPlanRow = Database['public']['Tables']['treatment_plans']['Row']
export type InvoiceRow = Database['public']['Tables']['invoices']['Row']
export type PaymentRow = Database['public']['Tables']['payments']['Row']
export type ClinicRow = Database['public']['Tables']['clinics']['Row']
export type TreatmentSessionRow = Database['public']['Tables']['treatment_sessions']['Row']
