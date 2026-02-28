export interface IClinicCacheMeta {
  loadedAt: number | null
  isLoading: boolean
  error: string | null
}

export function createClinicCacheMeta(): IClinicCacheMeta {
  return {
    loadedAt: null,
    isLoading: false,
    error: null,
  }
}

export function isExpired(loadedAt: number | null, ttlMs: number): boolean {
  if (!loadedAt) return true
  return Date.now() - loadedAt > ttlMs
}
