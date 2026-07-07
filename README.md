# SPK_MultiDev

Hub personal de desarrollo multi-AI de SpukLab. Reemplaza big-AGI con:
chat multi-proveedor (NVIDIA NIM, Claude, ChatGPT), dual-panel con roles,
Code Intake (parser de convención FILE/ACTION/PATCH) y push directo a
GitHub con Preview Deployments en Vercel.

Ver `CONTEXT_BASE.md` para la spec completa de arquitectura y decisiones
ratificadas — es la fuente de verdad de este proyecto.

## Estado

Implementado: dual-panel con pestañas (mobile-friendly), catálogo dinámico
de modelos, Code Intake (parser + diff real + commit), contexto de proyecto
automático, drawer de chats, drawer de Configuración (API keys por usuario
incluyendo GitHub, roles personalizables, limpieza masiva con árbol de
archivos), pensamiento secuencial (versión prompteada), buscador de repos,
y persistencia en Supabase. Auth solo en acciones destructivas de limpieza.

Pendiente: selector de proyecto/repo con UI más rica (hoy son inputs de
texto planos).

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
