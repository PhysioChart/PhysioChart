import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database'

export interface DashboardCounts {
  totalPatients: number
  activeTreatments: number
  upcomingAppointments7d: number
  todayAppointments: number
  pendingInvoices: number
  overdueInvoices: number
  outstandingAmount: number
}

export interface UpcomingAppointmentSummary {
  id: string
  startTime: string
  endTime: string
  status: Database['public']['Enums']['appointment_status']
  patientId: string
  patientName: string | null
  therapistName: string | null
}

export interface DashboardActivityItem {
  id: string
  kind: 'appointment' | 'invoice'
  occurredAt: string
  status: string
  patientId: string | null
  patientName: string | null
  therapistName: string | null
  invoiceNumber: string | null
  total: number | null
  amountPaid: number | null
  outstanding: number | null
  startTime: string | null
}

export interface DashboardOverview {
  counts: DashboardCounts
  upcomingAppointments: UpcomingAppointmentSummary[]
  recentActivity: DashboardActivityItem[]
}

function coerceMoney(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number((Math.round(value * 100) / 100).toFixed(2))
  }
  if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) {
    const num = parseFloat(value)
    return Number((Math.round(num * 100) / 100).toFixed(2))
  }
  throw new Error('DASHBOARD_BAD_NUMBER')
}

function isDashboardOverview(payload: unknown): payload is DashboardOverview {
  if (!payload || typeof payload !== 'object') return false
  const value = payload as {
    counts?: Record<string, unknown>
    upcomingAppointments?: unknown
    recentActivity?: unknown
  }
  const counts = value.counts as Record<string, unknown> | undefined
  const hasCounts = typeof counts?.upcomingAppointments7d === 'number'
  return Boolean(
    hasCounts && Array.isArray(value.upcomingAppointments) && Array.isArray(value.recentActivity),
  )
}

export function dashboardService(supabase: SupabaseClient<Database>) {
  async function getOverview(params: {
    clinicId: string
    nowIso: string
    rangeEndIso: string
    todayLocal: string
    tzOffsetMinutes: number
  }): Promise<DashboardOverview> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc('get_dashboard_overview', {
      p_clinic_id: params.clinicId,
      p_now: params.nowIso,
      p_range_end: params.rangeEndIso,
      p_today_local: params.todayLocal,
      p_tz_offset_minutes: params.tzOffsetMinutes,
    })

    if (error) {
      if (error.message === 'CLINIC_SCOPE_MISMATCH') throw new Error('DASHBOARD_FORBIDDEN')
      if (error.message === 'INVALID_RANGE') throw new Error('DASHBOARD_INVALID_RANGE')
      if (error.message === 'INVALID_CLINIC_ID') throw new Error('DASHBOARD_INVALID_CLINIC')
      throw new Error(error.message || 'DASHBOARD_LOAD_FAILED')
    }

    if (!isDashboardOverview(data)) throw new Error('DASHBOARD_LOAD_FAILED')

    data.counts.outstandingAmount = coerceMoney(data.counts.outstandingAmount)
    data.recentActivity = (data.recentActivity ?? []).map((item) => ({
      ...item,
      total: item.total === null ? null : coerceMoney(item.total),
      amountPaid: item.amountPaid === null ? null : coerceMoney(item.amountPaid),
      outstanding: item.outstanding === null ? null : coerceMoney(item.outstanding),
    }))

    return data
  }

  return { getOverview }
}
