# MedPractice

Clinic management SaaS — appointments, patient records, billing, staff, and analytics.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Nuxt 4](https://nuxt.com) / [Vue 3](https://vuejs.org) |
| Language | TypeScript (strict) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| UI Components | [shadcn-vue](https://www.shadcn-vue.com) |
| Backend | [Supabase](https://supabase.com) |
| Icons | [Lucide](https://lucide.dev) |

## Prerequisites

- Node.js >= 22 ([install via nvm](https://github.com/nvm-sh/nvm))
- A [Supabase](https://supabase.com) project (free tier works)

## Quick Start

```bash
# Switch to correct Node version
nvm use

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase project URL and anon key

# Start development server
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run generate` | Generate static site |
| `npx nuxi typecheck` | Run TypeScript checks |

## Adding UI Components

This project uses [shadcn-vue](https://www.shadcn-vue.com) — components are copied into `app/components/ui/` and fully customizable.

```bash
# Add a component
npx shadcn-vue@latest add button

# Add multiple components
npx shadcn-vue@latest add card table dialog
```

Browse available components at [shadcn-vue.com/docs/components](https://www.shadcn-vue.com/docs/components).
