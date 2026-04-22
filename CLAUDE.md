# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project Overview

**Grupo Foro Inmobiliario** is a professional networking platform for licensed real estate brokers (*corredores inmobiliarios*) in Rosario, Argentina. It handles member authentication with COCIR registry validation, a property match-making engine (MIR), economic indicators, community groups, CRM, and push notifications.

Stack: **Next.js 16 + React 19 + TypeScript + Supabase + Tailwind CSS 4 + Resend + Web Push + Anthropic SDK**. Deployed on Vercel.

## Commands

```bash
npm run dev      # Start local dev server (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint check (flat config, eslint.config.mjs)
```

There is no test suite configured in this project.

## Architecture

### Routing

The app uses Next.js App Router with two top-level route groups:

- **Public routes** – landing page (`/`), `/login`, `/registro`, `/recuperar-contrasena`, `/nueva-contrasena`, `/eventos`, `/suscripcion`, `/web/[slug]`
- **`app/(private)/`** – all authenticated routes share `app/(private)/layout.tsx`, which performs a Supabase session check and renders the fixed sidebar navigation. No `middleware.ts` exists; auth is enforced client-side inside this layout.

### Authentication & Authorization

1. Registration (`/registro`) validates the broker's *matrícula* against the `cocir_padron` table before creating a Supabase auth account.
2. New accounts start with `estado = 'pendiente'` in the `perfiles` table and must be approved by an admin via `/admin`.
3. `tipo` field on `perfiles` controls role: `admin`, `corredor`, `colaborador`. Admin-only sections in the sidebar are gated on this field.

### Data Layer

All DB access goes through the Supabase JS client. Key tables:

| Table | Purpose |
|---|---|
| `perfiles` | User profiles (nombre, apellido, matricula, tipo, estado, foto_url) |
| `cocir_padron` | Official COCIR broker registry for validation |
| `mir_busquedas` | Property search requests (MIR engine) |
| `mir_ofrecidos` | Property offerings (MIR engine) |
| `mir_matches` | Matches produced by the MIR engine |
| `push_subscriptions` | Web Push subscription records |
| `indicadores` | Cached economic index values |

There is no ORM — queries are written with the Supabase JS query builder directly.

### External API Integrations

The dashboard (`app/(private)/dashboard/`) fetches live data from several Argentine economic APIs on every mount (no server-side caching beyond a 6-hour ISR revalidation for `/api/indicadores`):

- **OpenWeatherMap** – weather widget (city stored in `localStorage` key `gfi_ciudad_clima`)
- **DolarAPI** – USD blue exchange rate
- **ArgentinaDatos** – ICL and IPC indices
- **BCRA API** – official Argentine economic indices

### Push Notifications

Web Push is handled by `web-push` on the server and `public/sw.js` (service worker) on the client. Subscription records are stored in `push_subscriptions` with fields `perfil_id`, `endpoint`, `p256dh`, `auth`, `eventos`.

### Cron Jobs

Two Vercel cron jobs are defined in `vercel-cron.json`:
- `/api/cron/recordatorio-vencimiento` – runs on days 28–31 of each month at noon (subscription expiry reminders via Resend)
- `/api/cron/bloqueo-dia4` – runs daily at 10:00 (auto-blocks overdue accounts)

### Styling

- Tailwind CSS 4 is configured via the `@tailwindcss/postcss` PostCSS plugin.
- The landing page (`app/page.tsx`) uses heavy inline styles; private app pages use Tailwind utility classes.
- Global base styles are in `app/globals.css`.

### State Management

No external state library. All state is local React (`useState`/`useEffect`). Supabase client is used directly for queries. `localStorage` is used only for the weather city preference.

## Key Conventions

- **`"use client"`** is required on any component that uses browser APIs, hooks, or event handlers. Most full pages are client components.
- **Path alias**: `@/` maps to the project root. Use it for all internal imports.
- **Package manager**: `npm` (do not use yarn/pnpm/bun).
- **Language**: The UI, variable names, route segments, and comments are in Spanish. Keep new code consistent with this.
- **No middleware**: Do not add a `middleware.ts` for auth — the pattern here is client-side checks inside `app/(private)/layout.tsx`.

## Environment Variables

No `.env` file is committed. Required variables (set in Vercel or a local `.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY       # server-only (API routes, crons)
RESEND_API_KEY
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY               # server-only
NEXT_PUBLIC_OPENWEATHER_KEY
```
