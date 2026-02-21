# MedPractice

B2B SaaS for healthcare clinic management — appointments, patient records, billing, staff management, reports, and notifications.

## Tech Stack

- **Framework**: Nuxt 4.3 / Vue 3.5 / TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn-vue (zinc theme, new-york style)
- **Backend**: Supabase (hosted) via `@supabase/supabase-js` client SDK
- **Icons**: lucide-vue-next
- **UI Primitives**: Reka UI (underlying shadcn-vue headless components)

## Project Structure

```
MedPractice/
├── app/                        # Nuxt app directory
│   ├── assets/css/main.css     # Tailwind + shadcn CSS variables
│   ├── components/ui/          # shadcn-vue components (added via CLI)
│   ├── composables/            # Vue composables (useSupabase, etc.)
│   ├── lib/utils.ts            # cn() utility for class merging
│   ├── pages/                  # File-based routing
│   ├── plugins/                # Nuxt plugins (supabase.client.ts)
│   └── types/                  # TypeScript types (database.ts)
├── server/api/                 # Nuxt server API routes (Nitro)
├── components.json             # shadcn-vue config
├── nuxt.config.ts              # Nuxt configuration
└── .env.example                # Required environment variables
```

## Commands

- `npm run dev` — start dev server (localhost:3000)
- `npm run build` — production build
- `npm run preview` — preview production build
- `npx nuxi typecheck` — run TypeScript type checking
- `npx shadcn-vue@latest add <component>` — add a shadcn component

## Conventions

- **Components**: PascalCase, placed in `app/components/`
- **shadcn components**: added via CLI to `app/components/ui/`, not manually created
- **Pages**: kebab-case files in `app/pages/`, Nuxt auto-generates routes
- **Composables**: `use` prefix, in `app/composables/`
- **Server routes**: in `server/api/`, auto-registered by Nitro
- **Types**: Supabase DB types in `app/types/database.ts` (generated, not hand-written)

## Supabase

- Client-only SDK (`@supabase/supabase-js`), no Supabase CLI
- Plugin at `app/plugins/supabase.client.ts` initializes the client
- Use `useSupabase()` composable in components to access the typed client
- Environment variables: `NUXT_PUBLIC_SUPABASE_URL` and `NUXT_PUBLIC_SUPABASE_ANON_KEY`
- DB types placeholder at `app/types/database.ts` — regenerate when schema changes

## Node.js

- Requires Node.js >= 22 (see `.nvmrc`)
- Use `nvm use` to switch to the correct version
