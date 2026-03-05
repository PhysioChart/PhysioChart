import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, InsertDto } from '~/types/database'
import type {
  IAppointmentTreatmentPlanSummary,
  IAppointmentWithRelations,
} from '~/types/models/appointment.types'
import { AppointmentStatus } from '~/enums/appointment.enum'
import { AppointmentErrorCode } from '~/enums/appointment-error.enum'

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

export interface ITreatmentPlanProgressSummary {
  completed: number
  total: number | null
  extended: boolean
  suggested_completed: boolean
}

export interface ICompleteAppointmentResult {
  appointmentCompleted: boolean
  sessionCreated: boolean
  sessionId: string | null
  planProgress: ITreatmentPlanProgressSummary | null
  message?: string | null
  planStatus?: string | null
  planCompleted?: boolean | null
}

export interface IReopenAppointmentResult {
  reopened: boolean
  sessionVoided: boolean
  message?: string | null
  planStatus?: string | null
  planCompleted?: boolean | null
}

export interface ICreateTreatmentLinkedAppointmentInput {
  clinicId: string
  treatmentPlanId: string
  therapistId: string
  startTime: string
  endTime: string
  notes?: string | null
  idempotencyKey: string
}

export interface ICreateTreatmentLinkedAppointmentResult {
  appointmentId: string
  alreadyCreated: boolean
  message: string | null
  appointment: {
    id: string
    patientId: string
    therapistId: string | null
    treatmentPlanId: string | null
    startTime: string
    endTime: string
    status: string
    notes: string | null
  }
  treatmentSummary: {
    id: string
    patientId: string
    name: string
    status: string
    totalSessions: number | null
  }
}

export class AppointmentConflictError extends Error {
  readonly code = AppointmentErrorCode.APPOINTMENT_DOCTOR_CONFLICT
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

function isTreatmentPlanProgressSummary(value: unknown): value is ITreatmentPlanProgressSummary {
  if (!value || typeof value !== 'object') return false
  const progress = value as Record<string, unknown>
  return (
    typeof progress.completed === 'number' &&
    (typeof progress.total === 'number' || progress.total === null) &&
    typeof progress.extended === 'boolean' &&
    typeof progress.suggested_completed === 'boolean'
  )
}

function isCompleteAppointmentResult(value: unknown): value is ICompleteAppointmentResult {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  const hasValidProgress =
    payload.planProgress === null || isTreatmentPlanProgressSummary(payload.planProgress)

  const planStatusOk =
    payload.planStatus === undefined ||
    payload.planStatus === null ||
    typeof payload.planStatus === 'string'

  const planCompletedOk =
    payload.planCompleted === undefined ||
    payload.planCompleted === null ||
    typeof payload.planCompleted === 'boolean'

  return (
    typeof payload.appointmentCompleted === 'boolean' &&
    typeof payload.sessionCreated === 'boolean' &&
    (typeof payload.sessionId === 'string' || payload.sessionId === null) &&
    hasValidProgress &&
    planStatusOk &&
    planCompletedOk
  )
}

function isReopenAppointmentResult(value: unknown): value is IReopenAppointmentResult {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  return (
    typeof payload.reopened === 'boolean' &&
    typeof payload.sessionVoided === 'boolean' &&
    (typeof payload.message === 'string' ||
      payload.message === null ||
      payload.message === undefined) &&
    (payload.planStatus === undefined ||
      payload.planStatus === null ||
      typeof payload.planStatus === 'string') &&
    (payload.planCompleted === undefined ||
      payload.planCompleted === null ||
      typeof payload.planCompleted === 'boolean')
  )
}

function isCreateTreatmentLinkedAppointmentResult(
  value: unknown,
): value is ICreateTreatmentLinkedAppointmentResult {
  if (!value || typeof value !== 'object') return false
  const payload = value as Record<string, unknown>
  if (
    typeof payload.appointmentId !== 'string' ||
    typeof payload.alreadyCreated !== 'boolean' ||
    (typeof payload.message !== 'string' && payload.message !== null)
  ) {
    return false
  }

  const appointment = payload.appointment
  const treatmentSummary = payload.treatmentSummary
  if (!appointment || typeof appointment !== 'object') return false
  if (!treatmentSummary || typeof treatmentSummary !== 'object') return false

  const appointmentObj = appointment as Record<string, unknown>
  const treatmentSummaryObj = treatmentSummary as Record<string, unknown>

  return (
    typeof appointmentObj.id === 'string' &&
    typeof appointmentObj.patientId === 'string' &&
    (typeof appointmentObj.therapistId === 'string' || appointmentObj.therapistId === null) &&
    (typeof appointmentObj.treatmentPlanId === 'string' ||
      appointmentObj.treatmentPlanId === null) &&
    typeof appointmentObj.startTime === 'string' &&
    typeof appointmentObj.endTime === 'string' &&
    typeof appointmentObj.status === 'string' &&
    (typeof appointmentObj.notes === 'string' || appointmentObj.notes === null) &&
    typeof treatmentSummaryObj.id === 'string' &&
    typeof treatmentSummaryObj.patientId === 'string' &&
    typeof treatmentSummaryObj.name === 'string' &&
    typeof treatmentSummaryObj.status === 'string' &&
    (typeof treatmentSummaryObj.totalSessions === 'number' ||
      treatmentSummaryObj.totalSessions === null)
  )
}

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
      .lt('start_time', `${dateStr}T23:59:59`)
      .order('start_time', { ascending: true })

    if (error) throw error

    const appointments = (data ?? []) as IAppointmentWithRelations[]
    const planIds = appointments
      .map((appointment) => appointment.treatment_plan?.id)
      .filter((id): id is string => Boolean(id))
    const progressMap = await fetchTreatmentPlanProgressMap(clinicId, planIds)

    return attachDerivedPlanProgress(appointments, progressMap)
  }

  async function create(appointment: InsertDto<'appointments'>): Promise<void> {
    const { error } = await supabase.from('appointments').insert(appointment).select().single()

    if (error) {
      if (error.code === AppointmentErrorCode.APPOINTMENT_CONFLICT_POSTGRES) {
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
      p_notes: payload.notes ?? null,
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

  async function completeWithSessionNote(
    clinicId: string,
    appointmentId: string,
    sessionNote?: string | null,
  ): Promise<ICompleteAppointmentResult> {
    const { data, error } = await supabase.rpc('complete_appointment_with_session_note', {
      p_clinic_id: clinicId,
      p_appointment_id: appointmentId,
      p_session_note: sessionNote ?? null,
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
    create,
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
