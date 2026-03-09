import tailwindcss from '@tailwindcss/vite'
import { config as loadDotenv } from 'dotenv'

loadDotenv()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_KEY. Rename legacy NUXT_PUBLIC_SUPABASE_URL and NUXT_PUBLIC_SUPABASE_ANON_KEY entries in your .env file.',
  )
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  app: {
    head: {
      titleTemplate: '%s — PhysioChart',
      link: [{ rel: 'icon', type: 'image/png', href: '/favicon.png' }],
      meta: [
        {
          name: 'description',
          content:
            'Practice management software for physiotherapy clinics — appointments, patients, billing, and treatments.',
        },
      ],
    },
  },

  modules: ['@pinia/nuxt', 'shadcn-nuxt', '@nuxt/eslint', '@nuxtjs/supabase'],

  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },

  css: ['~/assets/css/main.css'],

  vite: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plugins: [tailwindcss()] as any,
  },

  components: [{ path: '~/components', pathPrefix: false }],

  typescript: {
    strict: true,
  },

  supabase: {
    url: supabaseUrl,
    key: supabaseKey,
    redirect: true,
    useSsrCookies: true,
    types: '~~/app/types/database.ts',
    redirectOptions: {
      login: '/login',
      callback: '/confirm',
      exclude: ['/', '/register', '/invite/*'],
      saveRedirectToCookie: true,
    },
    cookieOptions: {
      maxAge: 60 * 60 * 8,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  },
})
