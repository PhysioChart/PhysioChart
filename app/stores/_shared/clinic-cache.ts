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
