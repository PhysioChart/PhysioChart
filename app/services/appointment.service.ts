import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, InsertDto } from '~/types/database'
import type { IAppointmentWithRelations } from '~/types/models/appointment.types'
import { AppointmentStatus } from '~/enums/appointment.enum'

export function appointmentService(supabase: SupabaseClient<Database>) {
  async function list(clinicId: string): Promise<IAppointmentWithRelations[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:patients(*), therapist:profiles(*)')
      .eq('clinic_id', clinicId)
      .order('start_time', { ascending: true })

    if (error) throw error
    return (data ?? []) as IAppointmentWithRelations[]
  }

  async function listForDate(
    clinicId: string,
    dateStr: string,
  ): Promise<IAppointmentWithRelations[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, patient:patients(*), therapist:profiles(*)')
      .eq('clinic_id', clinicId)
      .gte('start_time', `${dateStr}T00:00:00`)
      .lt('start_time', `${dateStr}T23:59:59`)
      .order('start_time', { ascending: true })

    if (error) throw error
    return (data ?? []) as IAppointmentWithRelations[]
  }

  async function create(appointment: InsertDto<'appointments'>): Promise<void> {
    const { error } = await supabase.from('appointments').insert(appointment)

    if (error) throw error
  }

  async function createSeries(appointments: InsertDto<'appointments'>[]): Promise<void> {
    const { error } = await supabase.from('appointments').insert(appointments)

    if (error) throw error
  }

  async function updateStatus(id: string, status: AppointmentStatus): Promise<void> {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id)

    if (error) throw error
  }

  async function cancelSeries(seriesId: string): Promise<void> {
    const { error } = await supabase
      .from('appointments')
      .update({ status: AppointmentStatus.CANCELLED })
      .eq('series_id', seriesId)
      .eq('status', AppointmentStatus.SCHEDULED)

    if (error) throw error
  }

  /** Check for scheduling conflicts in a date range for a therapist */
  async function findConflicts(
    clinicId: string,
    therapistId: string,
    startDate: string,
    endDate: string,
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from('appointments')
      .select('start_time')
      .eq('clinic_id', clinicId)
      .eq('therapist_id', therapistId)
      .eq('status', AppointmentStatus.SCHEDULED)
      .gte('start_time', `${startDate}T00:00:00`)
      .lte('start_time', `${endDate}T23:59:59`)

    if (error) throw error
    return (data ?? []).map((a) => a.start_time)
  }

  return { list, listForDate, create, createSeries, updateStatus, cancelSeries, findConflicts }
}
