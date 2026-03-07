// Supabase database types for MedPractice
// Regenerate with: npx supabase gen types typescript --project-id <id> > app/types/database.ts

export type Database = {
  public: {
    Tables: {
      clinics: {
        Row: {
          id: string
          name: string
          address: string | null
          phone: string | null
          email: string | null
          logo_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          email: string
          phone: string | null
          is_active: boolean
          default_membership_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          email: string
          phone?: string | null
          is_active?: boolean
          default_membership_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string
          email?: string
          phone?: string | null
          is_active?: boolean
          default_membership_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_default_membership_same_user_fkey'
            columns: ['default_membership_id']
            isOneToOne: false
            referencedRelation: 'clinic_memberships'
            referencedColumns: ['id']
          },
        ]
      }
      clinic_memberships: {
        Row: {
          id: string
          clinic_id: string
          user_id: string
          role: 'admin' | 'staff'
          created_by_user_id: string | null
          created_at: string
          ended_at: string | null
        }
        Insert: {
          id?: string
          clinic_id: string
          user_id: string
          role?: 'admin' | 'staff'
          created_by_user_id?: string | null
          created_at?: string
          ended_at?: string | null
        }
        Update: {
          clinic_id?: string
          user_id?: string
          role?: 'admin' | 'staff'
          created_by_user_id?: string | null
          created_at?: string
          ended_at?: string | null
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
      clinic_invites: {
        Row: {
          id: string
          clinic_id: string
          email_normalized: string
          role: 'admin' | 'staff'
          token_hash: string
          expires_at: string
          accepted_at: string | null
          revoked_at: string | null
          invited_by_user_id: string
          accepted_by_user_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          email_normalized: string
          role?: 'admin' | 'staff'
          token_hash: string
          expires_at: string
          accepted_at?: string | null
          revoked_at?: string | null
          invited_by_user_id: string
          accepted_by_user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          clinic_id?: string
          email_normalized?: string
          role?: 'admin' | 'staff'
          token_hash?: string
          expires_at?: string
          accepted_at?: string | null
          revoked_at?: string | null
          invited_by_user_id?: string
          accepted_by_user_id?: string | null
          created_at?: string
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
      owner_onboardings: {
        Row: {
          user_id: string
          clinic_id: string
          membership_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          clinic_id: string
          membership_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          clinic_id?: string
          membership_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'owner_onboardings_clinic_id_fkey'
            columns: ['clinic_id']
            isOneToOne: false
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'owner_onboardings_membership_id_fkey'
            columns: ['membership_id']
            isOneToOne: false
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
          id: string
          clinic_id: string
          full_name: string
          phone: string
          email: string | null
          date_of_birth: string | null
          gender: 'male' | 'female' | 'other' | null
          address: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          medical_history: Record<string, unknown>
          notes: string | null
          is_archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          full_name: string
          phone: string
          email?: string | null
          date_of_birth?: string | null
          gender?: 'male' | 'female' | 'other' | null
          address?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          medical_history?: Record<string, unknown>
          notes?: string | null
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          full_name?: string
          phone?: string
          email?: string | null
          date_of_birth?: string | null
          gender?: 'male' | 'female' | 'other' | null
          address?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          medical_history?: Record<string, unknown>
          notes?: string | null
          is_archived?: boolean
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
      treatment_plans: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          therapist_id: string | null
          name: string
          diagnosis: string | null
          treatment_type: string | null
          total_sessions: number | null
          price_per_session: number | null
          package_price: number | null
          status: 'active' | 'completed' | 'cancelled'
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          therapist_id?: string | null
          name: string
          diagnosis?: string | null
          treatment_type?: string | null
          total_sessions?: number | null
          price_per_session?: number | null
          package_price?: number | null
          status?: 'active' | 'completed' | 'cancelled'
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          patient_id?: string
          therapist_id?: string | null
          name?: string
          diagnosis?: string | null
          treatment_type?: string | null
          total_sessions?: number | null
          price_per_session?: number | null
          package_price?: number | null
          status?: 'active' | 'completed' | 'cancelled'
          notes?: string | null
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
      appointments: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          therapist_id: string | null
          treatment_plan_id: string | null
          start_time: string
          end_time: string
          status: 'scheduled' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'
          notes: string | null
          status_before_completion:
            | 'scheduled'
            | 'checked_in'
            | 'completed'
            | 'cancelled'
            | 'no_show'
            | null
          completed_at: string | null
          completed_by: string | null
          reopened_at: string | null
          reopened_by: string | null
          series_id: string | null
          series_index: number | null
          idempotency_key: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          therapist_id?: string | null
          treatment_plan_id?: string | null
          start_time: string
          end_time: string
          status?: 'scheduled' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'
          notes?: string | null
          status_before_completion?:
            | 'scheduled'
            | 'checked_in'
            | 'completed'
            | 'cancelled'
            | 'no_show'
            | null
          completed_at?: string | null
          completed_by?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          series_id?: string | null
          series_index?: number | null
          idempotency_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          patient_id?: string
          therapist_id?: string | null
          treatment_plan_id?: string | null
          start_time?: string
          end_time?: string
          status?: 'scheduled' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'
          notes?: string | null
          status_before_completion?:
            | 'scheduled'
            | 'checked_in'
            | 'completed'
            | 'cancelled'
            | 'no_show'
            | null
          completed_at?: string | null
          completed_by?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          series_id?: string | null
          series_index?: number | null
          idempotency_key?: string | null
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
      treatment_sessions: {
        Row: {
          id: string
          clinic_id: string
          treatment_plan_id: string | null
          appointment_id: string | null
          session_number: number
          complaints: string | null
          observations: string | null
          treatment_given: string | null
          exercises_prescribed: string | null
          next_session_plan: string | null
          notes: string | null
          patient_id: string
          practitioner_id: string
          plan_id: string | null
          note_text: string | null
          status: 'draft' | 'final' | 'voided'
          finalized_at: string
          voided_at: string | null
          voided_by: string | null
          session_order_time: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          treatment_plan_id?: string | null
          appointment_id?: string | null
          session_number: number
          complaints?: string | null
          observations?: string | null
          treatment_given?: string | null
          exercises_prescribed?: string | null
          next_session_plan?: string | null
          notes?: string | null
          patient_id: string
          practitioner_id: string
          plan_id?: string | null
          note_text?: string | null
          status?: 'draft' | 'final' | 'voided'
          finalized_at?: string
          voided_at?: string | null
          voided_by?: string | null
          session_order_time: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          treatment_plan_id?: string | null
          appointment_id?: string | null
          session_number?: number
          complaints?: string | null
          observations?: string | null
          treatment_given?: string | null
          exercises_prescribed?: string | null
          next_session_plan?: string | null
          notes?: string | null
          patient_id?: string
          practitioner_id?: string
          plan_id?: string | null
          note_text?: string | null
          status?: 'draft' | 'final' | 'voided'
          finalized_at?: string
          voided_at?: string | null
          voided_by?: string | null
          session_order_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'treatment_sessions_clinic_id_fkey'
            columns: ['clinic_id']
            isOneToOne: false
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'treatment_sessions_treatment_plan_id_fkey'
            columns: ['treatment_plan_id']
            isOneToOne: false
            referencedRelation: 'treatment_plans'
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
            foreignKeyName: 'treatment_sessions_appointment_id_fkey'
            columns: ['appointment_id']
            isOneToOne: false
            referencedRelation: 'appointments'
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
            foreignKeyName: 'treatment_sessions_practitioner_id_fkey'
            columns: ['practitioner_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      invoices: {
        Row: {
          id: string
          clinic_id: string
          patient_id: string
          treatment_plan_id: string | null
          invoice_number: string
          line_items: Record<string, unknown>[]
          subtotal: number
          tax: number
          total: number
          amount_paid: number
          status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled'
          due_date: string | null
          notes: string | null
          idempotency_key: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          patient_id: string
          treatment_plan_id?: string | null
          invoice_number: string
          line_items?: Record<string, unknown>[]
          subtotal?: number
          tax?: number
          total?: number
          amount_paid?: number
          status?: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled'
          due_date?: string | null
          notes?: string | null
          idempotency_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          patient_id?: string
          treatment_plan_id?: string | null
          invoice_number?: string
          line_items?: Record<string, unknown>[]
          subtotal?: number
          tax?: number
          total?: number
          amount_paid?: number
          status?: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled'
          due_date?: string | null
          notes?: string | null
          idempotency_key?: string | null
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
      payments: {
        Row: {
          id: string
          clinic_id: string
          invoice_id: string
          amount: number
          method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'
          notes: string | null
          paid_at: string
          created_at: string
          recorded_by: string | null
          idempotency_key: string | null
        }
        Insert: {
          id?: string
          clinic_id: string
          invoice_id: string
          amount: number
          method?: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'
          notes?: string | null
          paid_at?: string
          created_at?: string
          recorded_by?: string | null
          idempotency_key?: string | null
        }
        Update: {
          invoice_id?: string
          amount?: number
          method?: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'
          notes?: string | null
          paid_at?: string
          recorded_by?: string | null
          idempotency_key?: string | null
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
      expenses: {
        Row: {
          id: string
          clinic_id: string
          category: string
          description: string | null
          amount: number
          expense_date: string
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          category: string
          description?: string | null
          amount: number
          expense_date?: string
          created_at?: string
        }
        Update: {
          category?: string
          description?: string | null
          amount?: number
          expense_date?: string
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
    }
    Views: Record<string, never>
    Functions: {
      get_user_clinic_id: {
        Args: Record<string, never>
        Returns: string | null
      }
      is_clinic_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
      is_member_of_clinic: {
        Args: {
          target_clinic_id: string
        }
        Returns: boolean
      }
      is_admin_of_clinic: {
        Args: {
          target_clinic_id: string
        }
        Returns: boolean
      }
      complete_registration: {
        Args: {
          clinic_name: string
          full_name: string
        }
        Returns: Record<string, unknown>
      }
      create_staff_invite: {
        Args: {
          p_email: string
          p_role: 'admin' | 'staff'
        }
        Returns: Record<string, unknown>
      }
      get_invite_preview: {
        Args: {
          p_invite_token: string
        }
        Returns: Record<string, unknown>
      }
      accept_invite: {
        Args: {
          p_invite_token: string
          p_full_name: string
        }
        Returns: Record<string, unknown>
      }
      set_default_membership: {
        Args: {
          p_membership_id: string
        }
        Returns: Record<string, unknown>
      }
      deactivate_membership: {
        Args: {
          p_membership_id: string
        }
        Returns: Record<string, unknown>
      }
      create_appointment_series: {
        Args: {
          p_clinic_id: string
          p_patient_id: string
          p_therapist_id: string
          p_treatment_plan_id?: string | null
          p_notes?: string | null
          p_occurrences?: Record<string, unknown>[]
        }
        Returns: Record<string, unknown>
      }
      create_treatment_linked_appointment: {
        Args: {
          p_clinic_id: string
          p_treatment_plan_id: string
          p_therapist_id: string
          p_start_time: string
          p_end_time: string
          p_notes?: string | null
          p_idempotency_key?: string | null
        }
        Returns: Record<string, unknown>
      }
      create_invoice: {
        Args: {
          p_clinic_id: string
          p_patient_id: string
          p_treatment_plan_id?: string | null
          p_line_items: Record<string, unknown>[]
          p_due_date?: string | null
          p_notes?: string | null
          p_idempotency_key?: string | null
        }
        Returns: Record<string, unknown>
      }
      complete_appointment_with_session_note: {
        Args: {
          p_clinic_id: string
          p_appointment_id: string
          p_session_note?: string | null
        }
        Returns: Record<string, unknown>
      }
      reopen_completed_appointment: {
        Args: {
          p_clinic_id: string
          p_appointment_id: string
        }
        Returns: Record<string, unknown>
      }
      get_treatment_plan_progress_bulk: {
        Args: {
          p_clinic_id: string
          p_plan_ids?: string[] | null
        }
        Returns: {
          plan_id: string
          completed_sessions: number
        }[]
      }
      get_treatment_session_history_bulk: {
        Args: {
          p_clinic_id: string
          p_plan_ids: string[]
          p_limit_per_plan?: number
        }
        Returns: {
          plan_id: string
          session_id: string
          appointment_id: string | null
          finalized_at: string
          note: string | null
        }[]
      }
      get_treatment_linked_appointments_bulk: {
        Args: {
          p_clinic_id: string
          p_plan_ids: string[]
          p_now?: string
          p_limit_per_plan?: number
        }
        Returns: {
          plan_id: string
          appointment_id: string
          start_time: string
          end_time: string
          status: 'scheduled' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'
        }[]
      }
      record_invoice_payment: {
        Args: {
          p_clinic_id: string
          p_invoice_id: string
          p_amount: number
          p_method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'
          p_paid_at: string
          p_reference_note?: string | null
          p_idempotency_key?: string | null
        }
        Returns: Record<string, unknown>
      }
    }
    Enums: {
      user_role: 'admin' | 'staff'
      gender: 'male' | 'female' | 'other'
      treatment_status: 'active' | 'completed' | 'cancelled'
      session_status: 'draft' | 'final' | 'voided'
      appointment_status: 'scheduled' | 'checked_in' | 'completed' | 'cancelled' | 'no_show'
      invoice_status: 'draft' | 'sent' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled'
      payment_method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other'
    }
  }
}

// Convenience type aliases
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type InsertDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type UpdateDto<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

// Custom JSON types
export interface MedicalHistory {
  past_surgeries?: string[]
  current_medications?: string[]
  allergies?: string[]
  conditions?: string[]
  notes?: string
}

export interface InvoiceLineItem {
  description: string
  quantity: number
  unit_price: number
  total: number
}
