import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database'
import type {
  IAppointmentBlockingInterval,
  IAppointmentConflictMetadata,
  IAppointmentTreatmentPlanSummary,
  IAppointmentWithRelations,
  ICompleteAppointmentResult,
  ICreateTreatmentLinkedAppointmentInput,
  ICreateTreatmentLinkedAppointmentResult,
  IReopenAppointmentResult,
  ISeriesConflictMetadata,
} from '~/types/models/appointment.types'
import { AppointmentStatus } from '~/enums/appointment.enum'
import { AppointmentErrorCode } from '~/enums/appointment-error.enum'
import { AppointmentConflictError } from '~/lib/errors/appointment-conflict.error'
import {
  isCompleteAppointmentResult,
  isCreateTreatmentLinkedAppointmentResult,
  isReopenAppointmentResult,
} from '~/lib/guards/appointment.guards'

const BLOCKING_STATUSES = [AppointmentStatus.SCHEDULED, AppointmentStatus.CHECKED_IN]

export function appointmentService(supabase: SupabaseClient<Database>) {
  async function fetchTreatmentPlanProgressMap(
    clinicId: string,
    planIds: string[],
  ): Promise<Map<string, number>> {
    if (planIds.length === 0) return new Map<string, number>()

    const deduped = Array.from(new Set(planIds))
    const { data, error } = await supabase.rpc('get_treatment_plan_progress_bulk', {
      p_clinic_id: clinicId,
      p_plan_ids: deduped,
    })

    if (error) throw error

    const progressMap = new Map<string, number>()
    for (const row of data ?? []) {
      if (!row.plan_id) continue
      progressMap.set(row.plan_id, row.completed_sessions ?? 0)
    }

    return progressMap
  }

  function attachDerivedPlanProgress(
    appointments: IAppointmentWithRelations[],
    progressMap: Map<string, number>,
  ): IAppointmentWithRelations[] {
    return appointments.map((appointment) => {
      const rawPlan = appointment.treatment_plan as Partial<IAppointmentTreatmentPlanSummary> | null
      if (!rawPlan?.id) {
        return {
          ...appointment,
          treatment_plan: null,
        }
      }

      return {
        ...appointment,
        treatment_plan: {
          id: rawPlan.id,
          name: rawPlan.name ?? 'Untitled plan',
          status: rawPlan.status ?? 'active',
          diagnosis: rawPlan.diagnosis ?? null,
          treatment_type: rawPlan.treatment_type ?? null,
          total_sessions: rawPlan.total_sessions ?? null,
          derived_completed_sessions: progressMap.get(rawPlan.id) ?? 0,
        },
      }
    })
  }

  async function list(clinicId: string): Promise<IAppointmentWithRelations[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select(
        '*, patient:patients(*), therapist:profiles(*), treatment_plan:treatment_plans(id, name, status, diagnosis, treatment_type, total_sessions)',
      )
      .eq('clinic_id', clinicId)
      .order('start_time', { ascending: true })

    if (error) throw error

    const appointments = (data ?? []) as IAppointmentWithRelations[]
    const planIds = appointments
      .map((appointment) => appointment.treatment_plan?.id)
      .filter((id): id is string => Boolean(id))
    const progressMap = await fetchTreatmentPlanProgressMap(clinicId, planIds)

    return attachDerivedPlanProgress(appointments, progressMap)
  }

  async function getByPatientId(
    clinicId: string,
    patientId: string,
  ): Promise<IAppointmentWithRelations[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select(
        '*, patient:patients(*), therapist:profiles(*), treatment_plan:treatment_plans(id, name, status, diagnosis, treatment_type, total_sessions)',
      )
      .eq('clinic_id', clinicId)
      .eq('patient_id', patientId)
      .order('start_time', { ascending: false })

    if (error) throw error

    const appointments = (data ?? []) as IAppointmentWithRelations[]
    const planIds = appointments
      .map((appointment) => appointment.treatment_plan?.id)
      .filter((id): id is string => Boolean(id))
    const progressMap = await fetchTreatmentPlanProgressMap(clinicId, planIds)

    return attachDerivedPlanProgress(appointments, progressMap)
  }

  async function listForDate(
    clinicId: string,
    dateStr: string,
  ): Promise<IAppointmentWithRelations[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select(
        '*, patient:patients(*), therapist:profiles(*), treatment_plan:treatment_plans(id, name, status, diagnosis, treatment_type, total_sessions)',
      )
      .eq('clinic_id', clinicId)
      .gte('start_time', `${dateStr}T00:00:00`)
      .lt('start_time', `${dateStr}T24:00:00`)
      .order('start_time', { ascending: true })

    if (error) throw error

    const appointments = (data ?? []) as IAppointmentWithRelations[]
    const planIds = appointments
      .map((appointment) => appointment.treatment_plan?.id)
      .filter((id): id is string => Boolean(id))
    const progressMap = await fetchTreatmentPlanProgressMap(clinicId, planIds)

    return attachDerivedPlanProgress(appointments, progressMap)
  }

  interface ICreateSingleResult {
    appointmentId: string
    alreadyCreated: boolean
    message: string | null
  }

  async function createSingle(args: {
    clinicId: string
    patientId: string
    therapistId: string
    treatmentPlanId: string | null
    startTime: string
    endTime: string
    notes: string | null
    idempotencyKey: string
  }): Promise<ICreateSingleResult> {
    const { data, error } = await supabase.rpc('create_appointment', {
      p_clinic_id: args.clinicId,
      p_patient_id: args.patientId,
      p_therapist_id: args.therapistId,
      p_start_time: args.startTime,
      p_end_time: args.endTime,
      p_treatment_plan_id: args.treatmentPlanId ?? undefined,
      p_notes: args.notes ?? undefined,
      p_idempotency_key: args.idempotencyKey,
    })

    if (error) {
      if (error.code === AppointmentErrorCode.APPOINTMENT_CONFLICT_POSTGRES) {
        throw new AppointmentConflictError(
          'This doctor already has an appointment during this time.',
        )
      }
      throw error
    }

    const payload = data as ICreateSingleResult | null
    if (!payload || typeof payload.appointmentId !== 'string') {
      throw new Error('INVALID_CREATE_APPOINTMENT_RESPONSE')
    }

    return payload
  }

  async function createSeries(args: {
    clinicId: string
    patientId: string
    therapistId: string
    treatmentPlanId: string | null
    notes: string | null
    occurrences: Array<{ start_time: string; end_time: string; series_index: number }>
    idempotencyKey: string | null
  }): Promise<void> {
    const { data, error } = await supabase.rpc('create_appointment_series', {
      p_clinic_id: args.clinicId,
      p_patient_id: args.patientId,
      p_therapist_id: args.therapistId,
      p_treatment_plan_id: args.treatmentPlanId ?? undefined,
      p_notes: args.notes ?? undefined,
      p_occurrences: args.occurrences,
      p_idempotency_key: args.idempotencyKey ?? undefined,
    })

    if (error) {
      if (error.code === AppointmentErrorCode.APPOINTMENT_CONFLICT_POSTGRES) {
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

    if (payload.hasConflict && payload.code === AppointmentErrorCode.APPOINTMENT_DOCTOR_CONFLICT) {
      throw new AppointmentConflictError(
        "One or more sessions conflict with this doctor's schedule.",
        {
          conflicts: payload.conflicts ?? [],
        },
      )
    }
  }

  async function createTreatmentLinkedAppointment(
    payload: ICreateTreatmentLinkedAppointmentInput,
  ): Promise<ICreateTreatmentLinkedAppointmentResult> {
    const { data, error } = await supabase.rpc('create_treatment_linked_appointment', {
      p_clinic_id: payload.clinicId,
      p_treatment_plan_id: payload.treatmentPlanId,
      p_therapist_id: payload.therapistId,
      p_start_time: payload.startTime,
      p_end_time: payload.endTime,
      p_notes: payload.notes ?? undefined,
      p_idempotency_key: payload.idempotencyKey,
    })

    if (error) {
      if (error.code === AppointmentErrorCode.APPOINTMENT_CONFLICT_POSTGRES) {
        throw new AppointmentConflictError(
          'This doctor already has an appointment during this time.',
        )
      }
      throw error
    }

    if (!isCreateTreatmentLinkedAppointmentResult(data)) {
      throw new Error('INVALID_CREATE_TREATMENT_LINKED_APPOINTMENT_RESPONSE')
    }

    return data
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
    const dayEnd = `${dateStr}T24:00:00`
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

  async function findConflicts(
    clinicId: string,
    therapistId: string,
    startDate: string,
    endDate: string,
  ): Promise<IAppointmentBlockingInterval[]> {
    const rangeStart = `${startDate}T00:00:00`
    const rangeEnd = `${endDate}T24:00:00`
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

  async function completeWithSessionNote(
    clinicId: string,
    appointmentId: string,
    sessionNote?: string | null,
  ): Promise<ICompleteAppointmentResult> {
    const { data, error } = await supabase.rpc('complete_appointment_with_session_note', {
      p_clinic_id: clinicId,
      p_appointment_id: appointmentId,
      p_session_note: sessionNote ?? undefined,
    })

    if (error) throw error
    if (!isCompleteAppointmentResult(data)) {
      throw new Error('INVALID_COMPLETE_APPOINTMENT_RESPONSE')
    }
    return data
  }

  async function reopenCompletedAppointment(
    clinicId: string,
    appointmentId: string,
  ): Promise<IReopenAppointmentResult> {
    const { data, error } = await supabase.rpc('reopen_completed_appointment', {
      p_clinic_id: clinicId,
      p_appointment_id: appointmentId,
    })

    if (error) throw error
    if (!isReopenAppointmentResult(data)) {
      throw new Error('INVALID_REOPEN_APPOINTMENT_RESPONSE')
    }
    return data
  }

  return {
    list,
    getByPatientId,
    listForDate,
    createSingle,
    createSeries,
    createTreatmentLinkedAppointment,
    updateStatus,
    cancelSeries,
    listDoctorBlockedIntervals,
    findDoctorConflicts,
    findConflicts,
    completeWithSessionNote,
    reopenCompletedAppointment,
  }
}
