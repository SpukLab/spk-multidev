# DEV HUB — CONTEXT_BASE.md
## (Freeze Dev — arquitectura ratificada antes de escribir código)

Proyecto de Denis Hergenreder (SpukLab) para reemplazar big-AGI: un hub personal
de desarrollo con acceso multi-AI, sandbox de testeo rápido y push directo a
GitHub, optimizado para iterar desde iPad/iPhone y pasar a PC (Cursor) cuando
se necesite profundidad.

---

## 1. Objetivo

- Chat multi-modelo (NVIDIA NIM + otros proveedores) sin exponer API keys al cliente.
- Sandbox de testeo rápido, con foco en comportamiento REAL de Safari iOS
  (no emulado — esto es no negociable dado el trabajo con Web Audio API).
- Push a GitHub desde la propia app, sin depender de terminal.
- Deploy automático en Vercel con Preview Deployments por cada push/PR.
- Todo usable desde navegador (iPad/iPhone), sin instalar nada.

## 2. Decisión de arquitectura (ratificada)

Se descarta el enfoque de infraestructura pesada (Docker, GPU local, WSL2,
monitoreo tipo empresa) propuesto por una IA externa (Nano Omni 3) por no
ajustarse al contexto real: un solo dev, modelos consumidos vía API (no
self-hosted), iteración desde dispositivos móviles.

**Stack elegido:**
- **Next.js** (App Router) desplegado en **Vercel**.
- **API Routes / Vercel Functions** como proxy hacia cada proveedor de IA —
  las keys viven solo en variables de entorno de Vercel, nunca en el cliente.
- **Sin Docker, sin GPU propia.** Todos los modelos son llamadas HTTP a APIs
  externas (NVIDIA NIM y otros compatibles con formato OpenAI/Anthropic).
- **Octokit** (API REST de GitHub) para leer/escribir/commitear archivos y
  hacer push directo desde la UI.
- **Vercel Preview Deployments** como sandbox: cada push genera una URL real,
  testeable en Safari de iPad — reemplaza la necesidad de un sandbox en
  memoria (WebContainers) que no podría validar comportamiento real de audio.
- PWA / responsive mobile-first para que la UI se sienta nativa en iPad.

## 3. Capa de adaptadores (multi-AI)

Interfaz común para todos los proveedores, para que agregar un modelo nuevo
sea escribir un adapter, no tocar la UI:

```
sendMessage(provider, model, messages) → respuesta normalizada
streamResponse(provider, model, messages) → stream normalizado
```

Adapters previstos: NVIDIA NIM, Anthropic, OpenAI-compatible (Groq, etc.),
ampliable a futuro sin romper el resto.

## 4. Estructura de repo (propuesta inicial, simple — sin monorepo forzado)

```
devhub/
├─ app/                    # Next.js App Router
│   ├─ api/
│   │   ├─ chat/           # proxy a modelos (adapters)
│   │   └─ github/         # push/commit vía Octokit
│   └─ (ui)/               # chat, selector de modelo, panel de repo
├─ lib/
│   └─ adapters/           # un archivo por proveedor
├─ .env.local              # keys (NVIDIA, Anthropic, etc. — nunca en cliente)
└─ README.md
```

## 5. Flujo de trabajo iPad → PC

1. Iterar/prototipar desde iPad en la propia app (o en Cursor vía navegador
   si hace falta más adelante).
2. Push directo desde la UI (Octokit) o commit normal desde PC.
3. Cada push dispara Preview Deployment en Vercel.
4. Testeo real en Safari iPad sobre esa preview URL.
5. Si algo requiere profundidad (debugging pesado, refactor grande) → PC con
   Cursor, siguiendo el mismo repo.

## 6. Fuera de alcance (por ahora)

- Hosting propio de modelos / GPU local.
- Monitoreo tipo Grafana/Sentry — innecesario a esta escala.
- WebContainers u otro sandbox en memoria — no reemplaza testeo en Safari real.

## 7. Convención de output de código ("Code Intake") — RATIFICADA

Problema que resuelve: el cuello de botella real no es solo "dónde va cada
archivo" — es que el uso predominante actual (apps HTML/JSON single-file para
iPad, por restricciones de Safari) necesita cambios quirúrgicos dentro de un
archivo enorme, mientras que proyectos futuros más complejos (sin las
restricciones del ecosistema Apple, corriendo en PC) van a necesitar árboles
multi-carpeta reales. La convención cubre ambos casos.

**Spec de bloques:**
```
FILE: <path relativo desde raíz del repo>
ACTION: write | delete | rename | patch   (default: write)
FROM: <path viejo>                         (solo si ACTION: rename)
FIND:
<bloque exacto a reemplazar>               (solo si ACTION: patch)
REPLACE:
<bloque nuevo>                             (solo si ACTION: patch)
---
<contenido completo>                        (solo si ACTION: write o rename)
```

- **write**: crea o sobrescribe el archivo completo. Uso típico: proyectos
  nuevos, archivos chicos, o cuando no aplica patch.
- **delete**: borra el archivo.
- **rename**: se resuelve como delete del path viejo + write del nuevo en el
  mismo commit (sin caso especial en la Git Data API).
- **patch**: reemplaza un bloque exacto (`FIND`) por uno nuevo (`REPLACE`)
  dentro de un archivo existente. Pensado para el caso de uso más frecuente
  hoy: archivos HTML monolíticos grandes donde pedir el archivo entero de
  nuevo desperdicia tokens y arriesga regresiones silenciosas en partes no
  tocadas (precedente: bug de decode de SBO, escondido en código que se creía
  intacto). Si `FIND` no matchea exactamente contra el contenido real del
  archivo en el repo, el hub debe **rechazar el patch y avisar** — nunca
  aplicarlo a ciegas.
- Bloques de texto sin `FILE:` al inicio se ignoran (son explicaciones del
  modelo, no código a aplicar).
- Path safety: rechazar cualquier path con `../` o que intente escapar de la
  raíz del repo; pedir confirmación extra para carpetas sensibles (ej.
  `.github/workflows`).

**Flujo obligatorio antes de cualquier commit (no opcional):**
1. Fetch del contenido REAL actual de cada archivo afectado desde GitHub
   (nunca confiar en lo que la IA "cree" que hay en el repo — riesgo real en
   sesiones largas donde el contexto rota).
2. Mostrar diff visual contra ese contenido real (no solo un árbol de
   archivos nuevos).
3. Confirmación del usuario.
4. Commit atómico vía Git Data API (blobs → tree → commit → update ref) con
   todos los archivos de la respuesta en un solo commit.
5. Push dispara Preview Deployment de Vercel automáticamente.

**Instrucción de sistema fija para cualquier IA conectada al hub:** el hub le
inyecta esta convención en el system prompt de cada proveedor, para que el
formato de salida sea consistente sin importar qué modelo responda.

## 9. Dual-panel loop + Roles — RATIFICADA

Principio transversal: por sobre cualquier feature nueva, prioridad a que el
hub funcione sin sorpresas y minimice desentendidos — especialmente en la
búsqueda de bugs, que es un uso frecuente y crítico.

**Dual-panel (Opción A — manual con template, no pipeline automático):**
- Split view con dos paneles, cada uno con selector de proveedor/modelo
  independiente.
- Botón "Enviar respuesta →" en cada mensaje: pasa el output de un panel como
  input del otro con un click (en vez de copy/paste real).
- Campo de **template editable, vacío por default** — permite envolver el
  mensaje pasado (ej. "Revisá este código y decime si tiene bugs: [mensaje]")
  solo cuando aporta valor, sin ser un paso obligatorio.
- Se descarta pipeline 100% automático (IA-1 ↔ IA-2 sin supervisión) por
  ahora: más riesgo de desvío sin que el usuario lo note y consumo de
  requests sin control. El mecanismo manual construido ya deja la base lista
  para automatizar a futuro si se decide explícitamente.
- Cada mensaje pasado entre paneles lleva etiqueta de origen visible
  (ej. `← Auditor (Claude)`) para que nunca se pierda de vista quién generó
  qué dentro del loop.

**Roles:**
- Un rol = preset de system prompt aplicado a un panel. No es un modelo
  nuevo ni una feature de código compleja — es configuración editable en
  texto plano, guardable y reutilizable.
- Roles base sugeridos: `Arquitecto` (estructura y decisiones de diseño),
  `Auditor` (busca bugs, no genera código nuevo salvo pedido explícito),
  `Implementador` (ejecuta cambios puntuales, preferentemente vía
  `ACTION: patch`).
- Selector de modelo y selector de rol son independientes — permite, por
  ejemplo, el mismo modelo actuando como Arquitecto en un panel y como
  Auditor en el otro.
- El rol `Auditor` tiene instrucción fija de citar el bloque o línea exacta
  del problema (no descripciones vagas), para que el hallazgo se traduzca
  directo en un `ACTION: patch` con `FIND` preciso — cierra el loop
  auditoría → fix sin retipear código.

## 11. Confiabilidad y uso real — decisiones anticipadas (RATIFICADAS)

Principio: anticipar fricciones reales de uso diario antes de construir, para
evitar retomes evitables.

- **Auth delante del hub.** La app queda en una URL pública de Vercel; sin
  protección, cualquiera que la encuentre podría pegarle a las API routes y
  quemar las keys (NVIDIA, etc.). Se agrega autenticación simple
  (password/token propio) delante de toda la app — no opcional.
- **Selector de proyecto/repo.** El hub no asume un solo repo. Desde el
  arranque hay un selector que apunta a cualquiera de los repos existentes
  (SBO, Sound Forge, SPK_FieldsSet, ChronoMed, AgroTrack, etc.) o a uno nuevo.
- **Manejo de patch fallido con contexto, no solo error seco.** Si `FIND` no
  matchea contra el archivo real (típicamente porque cambió desde la última
  vez que la IA lo vio), el hub muestra el contenido actual vs. lo esperado
  para decidir manualmente, en vez de solo bloquear con un mensaje de error.
- **"Deshacer último push."** Botón para revertir el último commit hecho
  desde el hub sin salir a GitHub manualmente — dado el ritmo de iteración
  esperado, algún error de commit va a pasar.
- **Aviso de límite de contexto por modelo antes de enviar.** Si el modelo
  elegido (especialmente vía NIM, con contextos potencialmente más chicos)
  no puede recibir el archivo completo para un patch, el hub avisa ANTES de
  enviar — no deja descubrir un truncamiento después de la respuesta.
- **Persistencia de sesión entre dispositivos (decisión confirmada por el
  usuario: SÍ, necesaria).** El historial de chat, el estado de los paneles
  (modelo/rol activo) y la cola pendiente de Code Intake se guardan en una
  base de datos en la nube (ej. Vercel Postgres o KV), no solo en memoria del
  navegador. Esto permite arrancar una sesión en iPad y continuarla
  exactamente donde quedó desde la PC. Cambia la arquitectura: el hub deja
  de ser stateless y pasa a requerir una capa de datos persistente desde v1.

## 13. Contexto de proyecto adjunto automático — RATIFICADA

Cada proyecto/repo (seleccionado según sección 11) tiene asociado su propio
`CONTEXT_BASE.md` o README. El hub lo adjunta automáticamente como contexto
a cualquier IA consultada desde los paneles, sin necesidad de pegarlo a mano
cada vez que se cambia de proveedor/modelo — resuelve el problema real que
un Graph-RAG completo intentaría resolver (mantener el hilo del proyecto al
cambiar de IA), sin la complejidad de embeddings/vector DB/indexado, que es
desproporcionada para uso personal.

**Features evaluadas y descartadas (para no reabrir sin causa nueva):**
- *Smart Routing automático* (elegir IA según complejidad/costo): contradice
  el modo de trabajo elegido (revisión manual paso a paso, sección 9).
- *Sandbox Self-Healing* (autocorrección autónoma antes de mostrar el
  resultado): contradice el freeze de desarrollo autónomo ya vigente en SBO
  y el principio de nunca ocultar cambios no solicitados (sección 7/9).
- *Interfaz Canvas / nodos*: reconstrucción de UI completa sin resolver
  ningún cuello de botella identificado; posible v2, no v1.
- *Arquitectura híbrida local+nube*: asume hardware dedicado a inferencia
  local, ya descartado en la decisión de arquitectura (sección 2).

## 15. Nombre, proveedores v1 y limpieza masiva — RATIFICADA

**Nombre del proyecto:** `SPK_MultiDev` (coherente con nomenclatura `SPK_`
del resto del catálogo).

**Proveedores v1** (vía capa de adapters ya definida, sección 3):
- NVIDIA NIM (catálogo: Nemotron, DeepSeek, y demás modelos disponibles con
  la key existente).
- Anthropic (Claude).
- OpenAI (ChatGPT).
- Adapters adicionales se suman después sin tocar el resto del hub.

**Función de limpieza masiva** — dos niveles, con seguridad reforzada dado
que la eliminación de repos en GitHub es irreversible (no existe papelera):

**Nivel 1 — Borrado masivo de archivos dentro de un repo:**
- Vista de árbol del repo activo con selección múltiple (checkboxes).
- Preview de qué queda en el árbol tras la eliminación, antes de confirmar.
- Ejecutado como un solo commit atómico vía Git Data API (construir el nuevo
  tree excluyendo los archivos marcados), igual que el flujo de Code Intake
  — no una llamada de delete por archivo (evita rate limits y deja un solo
  punto de rollback vía "deshacer último push", sección 11).

**Nivel 2 — Borrado de repos completos:**
- Listado de todos los repos de la cuenta (vía GitHub API) con selección
  múltiple.
- Antes de habilitar el botón de confirmar, mostrar para cada repo
  seleccionado: fecha del último commit y si tiene Vercel deployment activo
  vinculado (para evitar borrar algo con producción viva sin darte cuenta).
- Confirmación reforzada: requiere tipear el nombre exacto del repo (o la
  lista de repos) antes de ejecutar — no alcanza con un solo click, dado que
  no hay forma de deshacer esto después.
- Requiere que el token de GitHub tenga scope `delete_repo` habilitado
  explícitamente (no viene por default con los scopes normales de push).

## 16. Pendiente de definir en próxima sesión

- Nombre del proyecto.
- Lista definitiva de proveedores/modelos a integrar en v1.
- Alcance de la función de "sandbox" dentro de la UI: ¿solo trigger de preview,
  o también editor de código embebido?
- Autenticación (¿uso personal único, o multi-usuario a futuro?).
