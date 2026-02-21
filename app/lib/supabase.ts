import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database'

let client: SupabaseClient<Database> | null = null

export function useSupabase(): SupabaseClient<Database> {
  if (!client) {
    const config = useRuntimeConfig()
    client = createClient<Database>(
      config.public.supabaseUrl,
      config.public.supabaseAnonKey,
    )
  }
  return client
}
