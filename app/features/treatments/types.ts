export interface ITreatmentPlanDraft {
  patient_id: string
  therapist_id: string
  name: string
  diagnosis: string
  treatment_type: string
  total_sessions: number
  pricing_mode: 'per_session' | 'package'
  price_per_session: number
  package_price: number
  notes: string
}

export function createDefaultTreatmentPlanDraft(): ITreatmentPlanDraft {
  return {
    patient_id: '',
    therapist_id: '',
    name: '',
    diagnosis: '',
    treatment_type: '',
    total_sessions: 10,
    pricing_mode: 'per_session',
    price_per_session: 0,
    package_price: 0,
    notes: '',
  }
}
