/**
 * Demo Seed Script
 *
 * Creates a realistic demo clinic with patients, treatments, appointments,
 * invoices, and payments for demo storytelling.
 *
 * Prerequisites:
 *   - SUPABASE_URL and SUPABASE_SECRET_KEY env vars set
 *   - OR pass them as arguments: npx tsx scripts/seed-demo.ts <url> <secret_key>
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts
 *
 * Demo login:
 *   email: demo@medpractice.in
 *   password: demo1234
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  process.argv[2] || process.env.SUPABASE_URL || process.env.NUXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY =
  process.argv[3] || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Usage: npx tsx scripts/seed-demo.ts <supabase_url> <secret_key>')
  console.error('  Or set SUPABASE_URL and SUPABASE_SECRET_KEY env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Fixed UUIDs for deterministic seeding ────────────────────────────
const CLINIC_ID = 'a0000000-0000-4000-8000-000000000001'
const ADMIN_USER_ID = 'b0000000-0000-4000-8000-000000000001'
const STAFF_USER_ID = 'b0000000-0000-4000-8000-000000000002'

const PATIENT_IDS = {
  ananya: 'c0000000-0000-4000-8000-000000000001',
  vikram: 'c0000000-0000-4000-8000-000000000002',
  meera: 'c0000000-0000-4000-8000-000000000003',
  rajesh: 'c0000000-0000-4000-8000-000000000004',
  sanya: 'c0000000-0000-4000-8000-000000000005',
} as const

const PLAN_IDS = {
  ananyaKnee: 'd0000000-0000-4000-8000-000000000001',
  vikramBack: 'd0000000-0000-4000-8000-000000000002',
  meeraShoulder: 'd0000000-0000-4000-8000-000000000003',
  sanyaPostSurgery: 'd0000000-0000-4000-8000-000000000004',
} as const

// ── Helpers ──────────────────────────────────────────────────────────
function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

function daysAgo(days: number): Date {
  return daysFromNow(-days)
}

function toISO(date: Date, hour: number, minute = 0): string {
  const d = new Date(date)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function toNoonISO(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toISOString()
}

let appointmentCounter = 0
function nextAppointmentId(): string {
  appointmentCounter++
  const hex = appointmentCounter.toString(16).padStart(12, '0')
  return `e0000000-0000-4000-8000-${hex}`
}

let sessionCounter = 0
function nextSessionId(): string {
  sessionCounter++
  const hex = sessionCounter.toString(16).padStart(12, '0')
  return `f0000000-0000-4000-8000-${hex}`
}

let invoiceCounter = 0
function nextInvoiceId(): string {
  invoiceCounter++
  const hex = invoiceCounter.toString(16).padStart(12, '0')
  return `f1000000-0000-4000-8000-${hex}`
}

let paymentCounter = 0
function nextPaymentId(): string {
  paymentCounter++
  const hex = paymentCounter.toString(16).padStart(12, '0')
  return `f2000000-0000-4000-8000-${hex}`
}

// ── Cleanup existing demo data ──────────────────────────────────────
async function cleanup() {
  console.log('Cleaning up existing demo data...')

  // Delete in FK order
  await supabase.from('payments').delete().eq('clinic_id', CLINIC_ID)
  await supabase.from('invoices').delete().eq('clinic_id', CLINIC_ID)
  await supabase.from('treatment_sessions').delete().eq('clinic_id', CLINIC_ID)
  await supabase.from('appointments').delete().eq('clinic_id', CLINIC_ID)
  await supabase.from('treatment_plans').delete().eq('clinic_id', CLINIC_ID)
  await supabase.from('expenses').delete().eq('clinic_id', CLINIC_ID)
  await supabase.from('patients').delete().eq('clinic_id', CLINIC_ID)
  await supabase.from('clinic_invites').delete().eq('clinic_id', CLINIC_ID)
  await supabase.from('owner_onboardings').delete().eq('clinic_id', CLINIC_ID)
  await supabase.from('clinic_memberships').delete().eq('clinic_id', CLINIC_ID)
  await supabase.from('profiles').delete().in('id', [ADMIN_USER_ID, STAFF_USER_ID])

  // Delete auth users (may not exist on first run)
  await supabase.auth.admin.deleteUser(ADMIN_USER_ID).catch(() => {})
  await supabase.auth.admin.deleteUser(STAFF_USER_ID).catch(() => {})

  await supabase.from('clinics').delete().eq('id', CLINIC_ID)

  console.log('Cleanup complete.')
}

// ── Seed clinic + users ──────────────────────────────────────────────
async function seedClinicAndUsers() {
  console.log('Creating clinic and users...')

  const { error: clinicErr } = await supabase.from('clinics').insert({
    id: CLINIC_ID,
    name: 'Sunrise Physiotherapy',
    address: '42 MG Road, Koramangala, Bangalore 560034',
    phone: '+91 80 4567 8901',
    email: 'info@sunrisephysio.in',
  })
  if (clinicErr) throw new Error(`Clinic insert failed: ${clinicErr.message}`)

  // Create admin auth user
  const { error: adminAuthErr } = await supabase.auth.admin.createUser({
    user_metadata: { full_name: 'Priya Sharma' },
    email: 'demo@medpractice.in',
    password: 'demo1234',
    email_confirm: true,
    id: ADMIN_USER_ID,
  })
  if (adminAuthErr) throw new Error(`Admin auth failed: ${adminAuthErr.message}`)

  // Create staff auth user
  const { error: staffAuthErr } = await supabase.auth.admin.createUser({
    user_metadata: { full_name: 'Rahul Mehta' },
    email: 'rahul@sunrisephysio.in',
    password: 'demo1234',
    email_confirm: true,
    id: STAFF_USER_ID,
  })
  if (staffAuthErr) throw new Error(`Staff auth failed: ${staffAuthErr.message}`)

  const { error: profileErr } = await supabase.from('profiles').upsert([
    {
      id: ADMIN_USER_ID,
      full_name: 'Priya Sharma',
      email: 'demo@medpractice.in',
      is_active: true,
    },
    {
      id: STAFF_USER_ID,
      full_name: 'Rahul Mehta',
      email: 'rahul@sunrisephysio.in',
      is_active: true,
    },
  ])

  if (profileErr) throw new Error(`Profile seed failed: ${profileErr.message}`)

  const { data: seededMemberships, error: membershipErr } = await supabase
    .from('clinic_memberships')
    .upsert([
      {
        clinic_id: CLINIC_ID,
        user_id: ADMIN_USER_ID,
        role: 'admin',
      },
      {
        clinic_id: CLINIC_ID,
        user_id: STAFF_USER_ID,
        role: 'staff',
      },
    ])
    .select('id, user_id, role')

  if (membershipErr || !seededMemberships) {
    throw new Error(`Membership seed failed: ${membershipErr?.message ?? 'unknown error'}`)
  }

  const adminMembershipId = seededMemberships.find(
    (membership) => membership.user_id === ADMIN_USER_ID,
  )?.id
  if (!adminMembershipId) {
    throw new Error('Admin membership was not created')
  }

  await supabase
    .from('profiles')
    .update({ default_membership_id: adminMembershipId })
    .eq('id', ADMIN_USER_ID)

  const staffMembershipId = seededMemberships.find(
    (membership) => membership.user_id === STAFF_USER_ID,
  )?.id
  if (!staffMembershipId) {
    throw new Error('Staff membership was not created')
  }

  await supabase
    .from('profiles')
    .update({ default_membership_id: staffMembershipId })
    .eq('id', STAFF_USER_ID)

  await supabase.from('owner_onboardings').upsert({
    user_id: ADMIN_USER_ID,
    clinic_id: CLINIC_ID,
    membership_id: adminMembershipId,
  })

  console.log(`  Clinic: Sunrise Physiotherapy`)
  console.log(`  Admin: Priya Sharma (demo@medpractice.in / demo1234)`)
  console.log(`  Staff: Rahul Mehta (rahul@sunrisephysio.in / demo1234)`)
}

// ── Seed patients ────────────────────────────────────────────────────
async function seedPatients() {
  console.log('Creating patients...')

  const patients = [
    {
      id: PATIENT_IDS.ananya,
      clinic_id: CLINIC_ID,
      full_name: 'Ananya Reddy',
      phone: '+91 98765 43210',
      email: 'ananya.reddy@gmail.com',
      date_of_birth: '1992-06-15',
      gender: 'female' as const,
      address: '15 Indiranagar, Bangalore',
      medical_history: {
        conditions: ['ACL tear (right knee, 2025)'],
        medications: ['Ibuprofen 400mg PRN'],
        allergies: [],
        surgeries: ['ACL reconstruction - Dec 2025'],
      },
    },
    {
      id: PATIENT_IDS.vikram,
      clinic_id: CLINIC_ID,
      full_name: 'Vikram Patel',
      phone: '+91 98765 43211',
      email: 'vikram.p@gmail.com',
      date_of_birth: '1985-03-22',
      gender: 'male' as const,
      address: '78 JP Nagar, Bangalore',
      medical_history: {
        conditions: ['Chronic lower back pain'],
        medications: [],
        allergies: ['Aspirin'],
        surgeries: [],
      },
    },
    {
      id: PATIENT_IDS.meera,
      clinic_id: CLINIC_ID,
      full_name: 'Meera Joshi',
      phone: '+91 98765 43212',
      email: 'meera.joshi@yahoo.com',
      date_of_birth: '1998-11-08',
      gender: 'female' as const,
      address: '23 HSR Layout, Bangalore',
      medical_history: {
        conditions: ['Frozen shoulder (left)'],
        medications: [],
        allergies: [],
        surgeries: [],
      },
    },
    {
      id: PATIENT_IDS.rajesh,
      clinic_id: CLINIC_ID,
      full_name: 'Rajesh Kumar',
      phone: '+91 98765 43213',
      date_of_birth: '1978-01-30',
      gender: 'male' as const,
      address: '56 Whitefield, Bangalore',
      notes: 'New patient, initial assessment pending',
      medical_history: {
        conditions: ['Cervical spondylosis'],
        medications: ['Diclofenac gel'],
        allergies: [],
        surgeries: [],
      },
    },
    {
      id: PATIENT_IDS.sanya,
      clinic_id: CLINIC_ID,
      full_name: 'Sanya Gupta',
      phone: '+91 98765 43214',
      email: 'sanya.g@gmail.com',
      date_of_birth: '2001-09-03',
      gender: 'female' as const,
      address: '9 Jayanagar, Bangalore',
      medical_history: {
        conditions: ['Post knee replacement rehab'],
        medications: ['Paracetamol 650mg'],
        allergies: [],
        surgeries: ['Total knee replacement (right) - Feb 2026'],
      },
    },
  ]

  const { error } = await supabase.from('patients').insert(patients)
  if (error) throw new Error(`Patients insert failed: ${error.message}`)

  console.log(`  Created ${patients.length} patients`)
}

// ── Seed treatment plans ─────────────────────────────────────────────
async function seedTreatmentPlans() {
  console.log('Creating treatment plans...')

  const plans = [
    {
      id: PLAN_IDS.ananyaKnee,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_IDS.ananya,
      therapist_id: ADMIN_USER_ID,
      name: 'ACL Rehab - Right Knee',
      diagnosis: 'Post ACL reconstruction rehabilitation',
      treatment_type: 'Orthopaedic Rehab',
      total_sessions: 8,
      // completed_sessions is derived from treatment_sessions, not a column
      // completed_sessions: 4,
      price_per_session: 1200,
      package_price: 8000,
      status: 'active' as const,
      notes: 'Phase 2: Strengthening. Good progress on ROM.',
    },
    {
      id: PLAN_IDS.vikramBack,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_IDS.vikram,
      therapist_id: STAFF_USER_ID,
      name: 'Lower Back Pain Management',
      diagnosis: 'Chronic lumbar disc degeneration',
      treatment_type: 'Pain Management',
      total_sessions: 6,
      // completed_sessions is derived from treatment_sessions, not a column
      // completed_sessions: 6,
      price_per_session: 1000,
      package_price: 5000,
      status: 'completed' as const,
      notes: 'Completed full course. Patient reports 80% improvement.',
    },
    {
      id: PLAN_IDS.meeraShoulder,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_IDS.meera,
      therapist_id: ADMIN_USER_ID,
      name: 'Frozen Shoulder Recovery',
      diagnosis: 'Adhesive capsulitis - left shoulder',
      treatment_type: 'Orthopaedic Rehab',
      total_sessions: 6,
      // completed_sessions is derived from treatment_sessions, not a column
      // completed_sessions: 2,
      price_per_session: 1200,
      status: 'active' as const,
      notes: 'ROM improving. Pendulum + wall slide exercises prescribed.',
    },
    {
      id: PLAN_IDS.sanyaPostSurgery,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_IDS.sanya,
      therapist_id: STAFF_USER_ID,
      name: 'Post TKR Rehabilitation',
      diagnosis: 'Post total knee replacement - right',
      treatment_type: 'Post-Surgical Rehab',
      total_sessions: 10,
      // completed_sessions is derived from treatment_sessions, not a column
      // completed_sessions: 1,
      price_per_session: 1500,
      package_price: 12000,
      status: 'active' as const,
      notes: 'Phase 1: Early mobilization. Weight-bearing as tolerated.',
    },
  ]

  const { error } = await supabase.from('treatment_plans').insert(plans)
  if (error) throw new Error(`Treatment plans insert failed: ${error.message}`)

  console.log(`  Created ${plans.length} treatment plans`)
}

// ── Seed appointments ────────────────────────────────────────────────
async function seedAppointments() {
  console.log('Creating appointments...')

  const appointments: Record<string, unknown>[] = []
  const sessions: Record<string, unknown>[] = []

  // ── Ananya: 4 completed + 2 upcoming ──
  const ananyaNotes = [
    'ROM exercises, quad sets, patellar mobilization',
    'Progressed to mini squats, hamstring curls',
    'Started closed-chain exercises, balance board',
    'Single-leg balance, step-ups, resistance band work',
  ]
  for (let i = 0; i < 4; i++) {
    const apptId = nextAppointmentId()
    const date = daysAgo(28 - i * 7)
    appointments.push({
      id: apptId,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_IDS.ananya,
      therapist_id: ADMIN_USER_ID,
      treatment_plan_id: PLAN_IDS.ananyaKnee,
      start_time: toISO(date, 10, 0),
      end_time: toISO(date, 10, 45),
      status: 'completed',
      notes: `Session ${i + 1}`,
      completed_at: toISO(date, 10, 45),
      completed_by: ADMIN_USER_ID,
      status_before_completion: 'scheduled',
    })
    sessions.push({
      id: nextSessionId(),
      clinic_id: CLINIC_ID,
      plan_id: PLAN_IDS.ananyaKnee,
      treatment_plan_id: PLAN_IDS.ananyaKnee,
      appointment_id: apptId,
      patient_id: PATIENT_IDS.ananya,
      practitioner_id: ADMIN_USER_ID,
      session_number: i + 1,
      note_text: ananyaNotes[i],
      status: 'final',
      finalized_at: toISO(date, 10, 45),
      session_order_time: toISO(date, 10, 45),
    })
  }
  // Upcoming
  for (let i = 0; i < 2; i++) {
    appointments.push({
      id: nextAppointmentId(),
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_IDS.ananya,
      therapist_id: ADMIN_USER_ID,
      treatment_plan_id: PLAN_IDS.ananyaKnee,
      start_time: toISO(daysFromNow(3 + i * 7), 10, 0),
      end_time: toISO(daysFromNow(3 + i * 7), 10, 45),
      status: 'scheduled',
    })
  }

  // ── Vikram: 6 completed ──
  const vikramNotes = [
    'Initial assessment. McKenzie protocol started.',
    'Extension exercises, core activation drills',
    'Progressed core stability. Pain reduced 40%.',
    'Added dynamic stabilization, Swiss ball work',
    'Functional exercises, lifting mechanics education',
    'Final session. Discharge with home program.',
  ]
  for (let i = 0; i < 6; i++) {
    const apptId = nextAppointmentId()
    const date = daysAgo(42 - i * 7)
    appointments.push({
      id: apptId,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_IDS.vikram,
      therapist_id: STAFF_USER_ID,
      treatment_plan_id: PLAN_IDS.vikramBack,
      start_time: toISO(date, 14, 0),
      end_time: toISO(date, 14, 45),
      status: 'completed',
      notes: `Session ${i + 1}`,
      completed_at: toISO(date, 14, 45),
      completed_by: STAFF_USER_ID,
      status_before_completion: 'scheduled',
    })
    sessions.push({
      id: nextSessionId(),
      clinic_id: CLINIC_ID,
      plan_id: PLAN_IDS.vikramBack,
      treatment_plan_id: PLAN_IDS.vikramBack,
      appointment_id: apptId,
      patient_id: PATIENT_IDS.vikram,
      practitioner_id: STAFF_USER_ID,
      session_number: i + 1,
      note_text: vikramNotes[i],
      status: 'final',
      finalized_at: toISO(date, 14, 45),
      session_order_time: toISO(date, 14, 45),
    })
  }

  // ── Meera: 2 completed + 1 today + 1 upcoming ──
  const meeraNotes = [
    'Pendulum exercises, passive ROM, ice therapy',
    'Wall slides, assisted flexion. ROM improved 20°.',
  ]
  for (let i = 0; i < 2; i++) {
    const apptId = nextAppointmentId()
    const date = daysAgo(14 - i * 7)
    appointments.push({
      id: apptId,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_IDS.meera,
      therapist_id: ADMIN_USER_ID,
      treatment_plan_id: PLAN_IDS.meeraShoulder,
      start_time: toISO(date, 11, 0),
      end_time: toISO(date, 11, 45),
      status: 'completed',
      notes: `Session ${i + 1}`,
      completed_at: toISO(date, 11, 45),
      completed_by: ADMIN_USER_ID,
      status_before_completion: 'scheduled',
    })
    sessions.push({
      id: nextSessionId(),
      clinic_id: CLINIC_ID,
      plan_id: PLAN_IDS.meeraShoulder,
      treatment_plan_id: PLAN_IDS.meeraShoulder,
      appointment_id: apptId,
      patient_id: PATIENT_IDS.meera,
      practitioner_id: ADMIN_USER_ID,
      session_number: i + 1,
      note_text: meeraNotes[i],
      status: 'final',
      finalized_at: toISO(date, 11, 45),
      session_order_time: toISO(date, 11, 45),
    })
  }
  // Today's appointment (great for demo)
  appointments.push({
    id: nextAppointmentId(),
    clinic_id: CLINIC_ID,
    patient_id: PATIENT_IDS.meera,
    therapist_id: ADMIN_USER_ID,
    treatment_plan_id: PLAN_IDS.meeraShoulder,
    start_time: toISO(new Date(), 15, 0),
    end_time: toISO(new Date(), 15, 45),
    status: 'scheduled',
    notes: 'Session 3 - progress reassessment',
  })
  // Future
  appointments.push({
    id: nextAppointmentId(),
    clinic_id: CLINIC_ID,
    patient_id: PATIENT_IDS.meera,
    therapist_id: ADMIN_USER_ID,
    treatment_plan_id: PLAN_IDS.meeraShoulder,
    start_time: toISO(daysFromNow(7), 11, 0),
    end_time: toISO(daysFromNow(7), 11, 45),
    status: 'scheduled',
  })

  // ── Sanya: 1 completed + 1 today + 2 upcoming ──
  {
    const apptId = nextAppointmentId()
    const date = daysAgo(5)
    appointments.push({
      id: apptId,
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_IDS.sanya,
      therapist_id: STAFF_USER_ID,
      treatment_plan_id: PLAN_IDS.sanyaPostSurgery,
      start_time: toISO(date, 9, 0),
      end_time: toISO(date, 10, 0),
      status: 'completed',
      notes: 'Session 1',
      completed_at: toISO(date, 10, 0),
      completed_by: STAFF_USER_ID,
      status_before_completion: 'scheduled',
    })
    sessions.push({
      id: nextSessionId(),
      clinic_id: CLINIC_ID,
      plan_id: PLAN_IDS.sanyaPostSurgery,
      treatment_plan_id: PLAN_IDS.sanyaPostSurgery,
      appointment_id: apptId,
      patient_id: PATIENT_IDS.sanya,
      practitioner_id: STAFF_USER_ID,
      session_number: 1,
      note_text: 'Gentle ROM exercises. Quad sets. Ice post-session. Tolerated well.',
      status: 'final',
      finalized_at: toISO(date, 10, 0),
      session_order_time: toISO(date, 10, 0),
    })
  }
  // Today
  appointments.push({
    id: nextAppointmentId(),
    clinic_id: CLINIC_ID,
    patient_id: PATIENT_IDS.sanya,
    therapist_id: STAFF_USER_ID,
    treatment_plan_id: PLAN_IDS.sanyaPostSurgery,
    start_time: toISO(new Date(), 16, 30),
    end_time: toISO(new Date(), 17, 30),
    status: 'scheduled',
    notes: 'Session 2',
  })
  // Upcoming
  for (let i = 0; i < 2; i++) {
    appointments.push({
      id: nextAppointmentId(),
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_IDS.sanya,
      therapist_id: STAFF_USER_ID,
      treatment_plan_id: PLAN_IDS.sanyaPostSurgery,
      start_time: toISO(daysFromNow(5 + i * 5), 9, 0),
      end_time: toISO(daysFromNow(5 + i * 5), 10, 0),
      status: 'scheduled',
    })
  }

  // ── Rajesh: 1 upcoming consultation (no treatment plan yet) ──
  appointments.push({
    id: nextAppointmentId(),
    clinic_id: CLINIC_ID,
    patient_id: PATIENT_IDS.rajesh,
    therapist_id: ADMIN_USER_ID,
    start_time: toISO(daysFromNow(1), 12, 0),
    end_time: toISO(daysFromNow(1), 12, 30),
    status: 'scheduled',
    notes: 'Initial assessment - cervical spondylosis',
  })

  const { error: apptErr } = await supabase.from('appointments').insert(appointments)
  if (apptErr) throw new Error(`Appointments insert failed: ${apptErr.message}`)

  const { error: sessErr } = await supabase.from('treatment_sessions').insert(sessions)
  if (sessErr) throw new Error(`Sessions insert failed: ${sessErr.message}`)

  const todayCount = appointments.filter(
    (a) =>
      a.status === 'scheduled' &&
      new Date(a.start_time as string).toDateString() === new Date().toDateString(),
  ).length

  console.log(`  Created ${appointments.length} appointments (${todayCount} today)`)
  console.log(`  Created ${sessions.length} session notes`)
}

// ── Seed invoices + payments ─────────────────────────────────────────
async function seedInvoicesAndPayments() {
  console.log('Creating invoices and payments...')

  const today = toDateStr(new Date())

  const invoices = [
    // Vikram: fully paid invoice
    {
      id: nextInvoiceId(),
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_IDS.vikram,
      treatment_plan_id: PLAN_IDS.vikramBack,
      invoice_number: 'INV-20260220-001',
      line_items: [
        {
          description: 'Lower Back Pain Management (Package)',
          quantity: 1,
          unit_price: 5000,
          total: 5000,
        },
      ],
      subtotal: 5000,
      tax: 0,
      total: 5000,
      amount_paid: 5000,
      status: 'paid' as const,
      due_date: toDateStr(daysAgo(14)),
      notes: 'Full package payment received',
    },
    // Ananya: partially paid invoice
    {
      id: nextInvoiceId(),
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_IDS.ananya,
      treatment_plan_id: PLAN_IDS.ananyaKnee,
      invoice_number: `INV-${today.replace(/-/g, '')}-002`,
      line_items: [
        {
          description: 'ACL Rehab - Right Knee (Package)',
          quantity: 1,
          unit_price: 8000,
          total: 8000,
        },
      ],
      subtotal: 8000,
      tax: 0,
      total: 8000,
      amount_paid: 4000,
      status: 'partially_paid' as const,
      due_date: toDateStr(daysFromNow(14)),
      notes: 'Balance due after session 8',
    },
    // Meera: unpaid/sent invoice
    {
      id: nextInvoiceId(),
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_IDS.meera,
      treatment_plan_id: PLAN_IDS.meeraShoulder,
      invoice_number: `INV-${today.replace(/-/g, '')}-003`,
      line_items: [
        {
          description: 'Frozen Shoulder Recovery (Session)',
          quantity: 2,
          unit_price: 1200,
          total: 2400,
        },
      ],
      subtotal: 2400,
      tax: 0,
      total: 2400,
      amount_paid: 0,
      status: 'sent' as const,
      due_date: toDateStr(daysFromNow(7)),
    },
    // Sanya: draft invoice
    {
      id: nextInvoiceId(),
      clinic_id: CLINIC_ID,
      patient_id: PATIENT_IDS.sanya,
      treatment_plan_id: PLAN_IDS.sanyaPostSurgery,
      invoice_number: `INV-${today.replace(/-/g, '')}-004`,
      line_items: [
        {
          description: 'Post TKR Rehabilitation (Package)',
          quantity: 1,
          unit_price: 12000,
          total: 12000,
        },
      ],
      subtotal: 12000,
      tax: 0,
      total: 12000,
      amount_paid: 0,
      status: 'draft' as const,
      due_date: toDateStr(daysFromNow(30)),
    },
  ]

  const { error: invErr } = await supabase.from('invoices').insert(invoices)
  if (invErr) throw new Error(`Invoices insert failed: ${invErr.message}`)

  // Payments for Vikram (fully paid) and Ananya (partial)
  const payments = [
    {
      id: nextPaymentId(),
      clinic_id: CLINIC_ID,
      invoice_id: invoices[0].id,
      amount: 5000,
      method: 'upi' as const,
      notes: 'Google Pay',
      paid_at: toNoonISO(toDateStr(daysAgo(14))),
      recorded_by: ADMIN_USER_ID,
    },
    {
      id: nextPaymentId(),
      clinic_id: CLINIC_ID,
      invoice_id: invoices[1].id,
      amount: 4000,
      method: 'cash' as const,
      notes: 'Advance payment',
      paid_at: toNoonISO(toDateStr(daysAgo(7))),
      recorded_by: ADMIN_USER_ID,
    },
  ]

  const { error: payErr } = await supabase.from('payments').insert(payments)
  if (payErr) throw new Error(`Payments insert failed: ${payErr.message}`)

  console.log(`  Created ${invoices.length} invoices`)
  console.log(`  Created ${payments.length} payments`)
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('\n=== MedPractice Demo Seed ===\n')

  try {
    await cleanup()
    await seedClinicAndUsers()
    await seedPatients()
    await seedTreatmentPlans()
    await seedAppointments()
    await seedInvoicesAndPayments()

    console.log('\n=== Seed complete! ===')
    console.log('\nDemo login:')
    console.log('  Email:    demo@medpractice.in')
    console.log('  Password: demo1234')
    console.log('')
  } catch (err) {
    console.error('\nSeed failed:', err)
    process.exit(1)
  }
}

main()
