# SPK_MultiDev

Hub personal de desarrollo multi-AI de SpukLab. Reemplaza big-AGI con:
chat multi-proveedor (NVIDIA NIM, Claude, ChatGPT), dual-panel con roles,
Code Intake (parser de convención FILE/ACTION/PATCH) y push directo a
GitHub con Preview Deployments en Vercel.

Ver `CONTEXT_BASE.md` para la spec completa de arquitectura y decisiones
ratificadas — es la fuente de verdad de este proyecto.

## Estado

Scaffold inicial. Pendiente: implementación de UI (dual-panel, roles,
árbol de Code Intake, diff viewer), persistencia de sesión (Vercel KV),
auth propia, y las funciones de limpieza masiva (sección 15).

## Stack

- Next.js (App Router) + Vercel
- Adapters propios por proveedor de IA (`lib/adapters/`)
- Octokit para operaciones de GitHub (`lib/github/`)
- Parser de Code Intake (`lib/codeIntake/`)

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar las keys
npm run dev
```

## Base de datos

Persistencia vía Supabase (Postgres). Correr `supabase/schema.sql` en el
SQL editor del proyecto de Supabase antes del primer uso. Variables
necesarias: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
