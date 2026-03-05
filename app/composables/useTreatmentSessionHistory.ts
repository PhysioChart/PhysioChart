import { reactive, shallowRef } from 'vue'
import { treatmentService } from '~/services/treatment.service'
import type { ITreatmentSessionHistoryItem } from '~/types/models/treatment.types'

export function useTreatmentSessionHistory() {
  const supabase = useSupabase()

  const historyByPlan = reactive<Record<string, ITreatmentSessionHistoryItem[]>>({})
  const loadingByPlan = reactive<Record<string, boolean>>({})
  const errorByPlan = reactive<Record<string, string | null>>({})
  const inflight = shallowRef<Map<string, Promise<void>>>(new Map())

  async function loadHistory(
    clinicId: string,
    planIds: string[],
    limit = 5,
    force = false,
  ): Promise<void> {
    const targets = planIds.filter((id) => force || historyByPlan[id] === undefined)
    const tasks: Promise<void>[] = []

    for (const id of targets) {
      if (inflight.value.has(id)) {
        tasks.push(inflight.value.get(id)!)
        continue
      }

      const promise = (async () => {
        loadingByPlan[id] = true
        errorByPlan[id] = null
        try {
          const map = await treatmentService(supabase).fetchSessionHistory(clinicId, [id], limit)
          historyByPlan[id] = map.get(id) ?? []
        } catch (err: unknown) {
          errorByPlan[id] = err instanceof Error ? err.message : 'Failed to load history'
          historyByPlan[id] = []
        } finally {
          loadingByPlan[id] = false
          inflight.value.delete(id)
        }
      })()

      inflight.value.set(id, promise)
      tasks.push(promise)
    }

    await Promise.all(tasks)
  }

  function invalidate(
    planId?: string,
    options?: { refetch?: boolean; clinicId?: string; limit?: number },
  ): void {
    if (planId) {
      historyByPlan[planId] = undefined as unknown as ITreatmentSessionHistoryItem[]
      loadingByPlan[planId] = false
      errorByPlan[planId] = null
      inflight.value.delete(planId)

      if (options?.refetch && options.clinicId) {
        void loadHistory(options.clinicId, [planId], options.limit ?? 5, true)
      }
      return
    }

    for (const key of Object.keys(historyByPlan)) {
      historyByPlan[key] = undefined as unknown as ITreatmentSessionHistoryItem[]
    }
    for (const key of Object.keys(loadingByPlan)) {
      loadingByPlan[key] = false
    }
    for (const key of Object.keys(errorByPlan)) {
      errorByPlan[key] = null
    }
    inflight.value = new Map()
  }

  return { historyByPlan, loadingByPlan, errorByPlan, loadHistory, invalidate }
}
