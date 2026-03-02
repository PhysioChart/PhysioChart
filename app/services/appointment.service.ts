import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, InsertDto } from '~/types/database'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'
import { AppointmentStatus } from '~/enums/appointment.enum'

export interface IAppointmentBlockingInterval {
  id: string
  start_time: string
  end_time: string
}

export interface IAppointmentConflictMetadata {
  conflictingAppointmentId: string
  conflictingStartTime: string
  conflictingEndTime: string
}

export interface ISeriesConflictMetadata {
  occurrenceStartTime: string
  occurrenceEndTime: string
  conflictingAppointmentId?: string
  conflictingStartTime?: string
  conflictingEndTime?: string
}

export class AppointmentConflictError extends Error {
  readonly code = 'APPOINTMENT_DOCTOR_CONFLICT'
  readonly status = 409
  conflict?: IAppointmentConflictMetadata
  conflicts?: ISeriesConflictMetadata[]

  constructor(
    message: string,
    args?: { conflict?: IAppointmentConflictMetadata; conflicts?: ISeriesConflictMetadata[] },
  ) {
    super(message)
    this.name = 'AppointmentConflictError'
    this.conflict = args?.conflict
    this.conflicts = args?.conflicts
  }
}

const BLOCKING_STATUSES = [AppointmentStatus.SCHEDULED, AppointmentStatus.CHECKED_IN]

export function appointmentService(supabase: SupabaseClient<Database>) {
  async function list(clinicId: string): Promise<IAppointmentWithRelations[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select(
        '*, patient:patients(*), therapist:profiles(*), treatment_plan:treatment_plans(name, completed_sessions, total_sessions)',
      )
      .eq('clinic_id', clinicId)
      .order('start_time', { ascending: true })

    if (error) throw error
    return (data ?? []) as IAppointmentWithRelations[]
  }

  async function getByPatientId(
    clinicId: string,
    patientId: string,
  ): Promise<IAppointmentWithRelations[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select(
        '*, patient:patients(*), therapist:profiles(*), treatment_plan:treatment_plans(name, completed_sessions, total_sessions)',
      )
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      // TODO: Add .order('appointment_date', { ascending: false }) once appointments.appointment_date exists.
      .order('start_time', { ascending: false })

    if (error) throw error
    return (data ?? []) as IAppointmentWithRelations[]
  }

  async function listForDate(
    clinicId: string,
    dateStr: string,
  ): Promise<IAppointmentWithRelations[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select(
        '*, patient:patients(*), therapist:profiles(*), treatment_plan:treatment_plans(name, completed_sessions, total_sessions)',
      )
      .eq('clinic_id', clinicId)
      .gte('start_time', `${dateStr}T00:00:00`)
      .lt('start_time', `${dateStr}T23:59:59`)
      .order('start_time', { ascending: true })

    if (error) throw error
    return (data ?? []) as IAppointmentWithRelations[]
  }

  async function create(appointment: InsertDto<'appointments'>): Promise<void> {
    const { error } = await supabase.from('appointments').insert(appointment).select().single()

    if (error) {
      if (error.code === '23P01') {
        throw new AppointmentConflictError(
          'This doctor already has an appointment during this time.',
        )
      }
      throw error
    }
  }

  async function createSeries(args: {
    clinicId: string
    patientId: string
    therapistId: string
    treatmentPlanId: string | null
    notes: string | null
    occurrences: Array<{ start_time: string; end_time: string; series_index: number }>
  }): Promise<void> {
    const { data, error } = await supabase.rpc('create_appointment_series', {
      p_clinic_id: args.clinicId,
      p_patient_id: args.patientId,
      p_therapist_id: args.therapistId,
      p_treatment_plan_id: args.treatmentPlanId,
      p_notes: args.notes,
      p_occurrences: args.occurrences,
    })

    if (error) {
      if (error.code === '23P01') {
        throw new AppointmentConflictError(
          'This doctor already has an appointment during this time.',
        )
      }
      throw error
    }

    const payload = (data ?? {}) as {
      hasConflict?: boolean
      code?: string
      conflicts?: ISeriesConflictMetadata[]
    }

    if (payload.hasConflict && payload.code === 'APPOINTMENT_DOCTOR_CONFLICT') {
      throw new AppointmentConflictError(
        "One or more sessions conflict with this doctor's schedule.",
        {
          conflicts: payload.conflicts ?? [],
        },
      )
    }
  }

  async function updateStatus(
    clinicId: string,
    id: string,
    status: AppointmentStatus,
  ): Promise<void> {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('clinic_id', clinicId)
      .eq('id', id)

    if (error) throw error
  }

  async function cancelSeries(clinicId: string, seriesId: string): Promise<void> {
    const { error } = await supabase
      .from('appointments')
      .update({ status: AppointmentStatus.CANCELLED })
      .eq('clinic_id', clinicId)
      .eq('series_id', seriesId)
      .eq('status', AppointmentStatus.SCHEDULED)

    if (error) throw error
  }

  async function listDoctorBlockedIntervals(
    clinicId: string,
    therapistId: string,
    dateStr: string,
  ): Promise<IAppointmentBlockingInterval[]> {
    const dayStart = `${dateStr}T00:00:00`
    const dayEnd = `${dateStr}T23:59:59`
    const { data, error } = await supabase
      .from('appointments')
      .select('id, start_time, end_time')
      .eq('clinic_id', clinicId)
      .eq('therapist_id', therapistId)
      .in('status', BLOCKING_STATUSES)
      .lt('start_time', dayEnd)
      .gt('end_time', dayStart)
      .order('start_time', { ascending: true })

    if (error) throw error
    return (data ?? []) as IAppointmentBlockingInterval[]
  }

  async function findDoctorConflicts(
    clinicId: string,
    therapistId: string,
    startTimeIso: string,
    endTimeIso: string,
    excludeAppointmentId?: string,
  ): Promise<IAppointmentConflictMetadata | null> {
    let query = supabase
      .from('appointments')
      .select('id, start_time, end_time')
      .eq('clinic_id', clinicId)
      .eq('therapist_id', therapistId)
      .in('status', BLOCKING_STATUSES)
      .lt('start_time', endTimeIso)
      .gt('end_time', startTimeIso)
      .order('start_time', { ascending: true })
      .limit(1)

    if (excludeAppointmentId) {
      query = query.neq('id', excludeAppointmentId)
    }

    const { data, error } = await query

    if (error) throw error
    const first = data?.[0]
    if (!first) return null

    return {
      conflictingAppointmentId: first.id,
      conflictingStartTime: first.start_time,
      conflictingEndTime: first.end_time,
    }
  }

  /** Check for scheduling conflicts in a date range for a therapist */
  async function findConflicts(
    clinicId: string,
    therapistId: string,
    startDate: string,
    endDate: string,
  ): Promise<IAppointmentBlockingInterval[]> {
    const rangeStart = `${startDate}T00:00:00`
    const rangeEnd = `${endDate}T23:59:59`
    const { data, error } = await supabase
      .from('appointments')
      .select('id, start_time, end_time')
      .eq('clinic_id', clinicId)
      .eq('therapist_id', therapistId)
      .in('status', BLOCKING_STATUSES)
      .lt('start_time', rangeEnd)
      .gt('end_time', rangeStart)
      .order('start_time', { ascending: true })

    if (error) throw error
    return (data ?? []) as IAppointmentBlockingInterval[]
  }

  return {
    list,
    getByPatientId,
    listForDate,
    create,
    createSeries,
    updateStatus,
    cancelSeries,
    listDoctorBlockedIntervals,
    findDoctorConflicts,
    findConflicts,
  }
}
