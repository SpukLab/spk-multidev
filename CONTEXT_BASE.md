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

- **Auth solo en acciones destructivas (revisado).** Se descartó el Basic
  Auth global delante de todo el hub (generaba fricción innecesaria en el
  uso diario de chat/Code Intake, que no son irreversibles). En su lugar,
  la contraseña (`HUB_ACCESS_PASSWORD`) se exige únicamente en las dos
  acciones de limpieza masiva (borrado de archivos y de repos completos,
  sección 15/16) — validada server-side en esas API routes puntuales. El
  resto del hub queda sin gate de login.
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
  base de datos en la nube. Se agrega también a la arquitectura ratificada:
  el hub deja de ser stateless y pasa a requerir una capa de datos
  persistente desde v1.
  **Backend elegido: Supabase (Postgres)** — el usuario ya tenía cuenta

**Limitación operativa descubierta en producción (no anticipada
originalmente):** el proyecto de Supabase (tier gratuito) **se pausa
automáticamente tras ~1 semana sin actividad**. Cuando esto pasa, cualquier
operación server-side contra Supabase (`/api/projects`, `/api/sessions`,
etc.) falla con `TypeError: fetch failed` — un error de red genérico que no
menciona "pausado" en ningún lado, así que no es obvio de diagnosticar sin
chequear el estado del proyecto directamente en Supabase (`status:
INACTIVE` en vez de `ACTIVE_HEALTHY`). Solución: `restore_project` (vía
dashboard de Supabase o el conector MCP) — reactiva en 1-3 minutos, sin
pérdida de datos (las tablas y su contenido persisten intactos durante la
pausa). Si el hub pasa mucho tiempo sin usarse, esto va a repetirse — no
hay forma de evitarlo sin pasar a un plan pago de Supabase.
  activa; encaja mejor que Vercel KV/Redis porque el esquema necesario
  (sesiones, historial de mensajes, cola de Code Intake) es relacional, no
  clave-valor efímero. Esquema inicial en `supabase/schema.sql`. Acceso
  server-side únicamente vía service role key (nunca expuesta al cliente).

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

**Función de limpieza masiva** — vive dentro del drawer de Configuración
(pestaña "Limpieza"), no como sección separada. Ambas acciones exigen la
contraseña de la app (`HUB_ACCESS_PASSWORD`), validada server-side — es la
única parte del hub que pide contraseña (sección 11 revisada). Dos niveles:

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

## 16. API keys por usuario y roles personalizables — RATIFICADA

**API keys por usuario:** para que el hub sea distribuible sin atar a otras
personas a las keys del dueño original del deploy, cada API route que llama
a un proveedor de IA acepta un `apiKey` opcional en el body. Prioridad:
key personal del usuario (cargada en su propio navegador vía localStorage,
nunca enviada a Supabase ni persistida en el servidor) > key compartida del
servidor (env var de Vercel). Si el usuario no carga ninguna, el hub sigue
funcionando con la key del dueño — mantiene el modo de uso personal actual
intacto mientras habilita distribución futura sin cambios de arquitectura.

**Roles personalizables:** los 3 roles fijos (Arquitecto/Auditor/
Implementador, sección 9) no se pueden editar, pero el usuario puede crear
los propios (nombre + system prompt) desde el panel de Configuración.
Guardados en localStorage — por ahora no sincronizan entre dispositivos
(a diferencia del historial de chat, que sí vive en Supabase); si en el
futuro se requiere que los roles también viajen entre iPad/PC, migrarían a
una tabla de Supabase análoga a `sessions`.

## 18. Ampliaciones de sesión (GitHub BYOK, pensamiento secuencial, árbol de archivos) — RATIFICADA

**GitHub token por usuario**: se extiende el patrón de API keys por usuario
(sección 16) a GitHub. Cada función de `lib/github/client.ts` acepta un
`token` opcional; todas las API routes de GitHub aceptan `githubToken` en
el body y lo priorizan sobre `GITHUB_TOKEN` del servidor. `/api/github/repos`
pasó de GET a POST para poder llevar el token en el body.

**Pensamiento secuencial (versión liviana)**: checkbox por panel que agrega
una instrucción de sistema pidiendo razonamiento explícito en pasos
numerados antes de la respuesta final. Es una versión "prompteada", no el
protocolo real de tool-calling iterativo del MCP server homónimo (que
requeriría soporte de function-calling y un loop agéntico en `/api/chat`,
inexistente hoy). Documentado como decisión consciente de alcance — si en
el futuro se necesita el protocolo completo, es una pieza de arquitectura
nueva, no una extensión menor.

**Árbol de archivos en limpieza masiva**: el listado plano de paths del
Nivel 1 (sección 15) se reemplaza por un árbol de carpetas colapsable
(`components/FileTree.tsx`), con selección a nivel de carpeta (selecciona/
deselecciona todos los archivos descendientes).

**Buscador de repos en la barra de proyecto**: botón "Buscar repos" que
lista los repos de la cuenta (reutiliza `listAccountRepos`) para completar
owner/repo con un tap en vez de tipearlo a mano.

**Auth revisada (correción de sesión anterior)**: la sección 11 quedó
desactualizada tras remover el Basic Auth global — ver nota ahí: la
contraseña ahora protege solo las acciones destructivas de limpieza.

## 20. Integración con OpenHands (Execution Adapter opcional, no el flujo principal) — REVISADA

Problema: tareas complejas de repositorio (delegadas a OpenHands) tardan
minutos — incompatible con el modelo de request/response síncrono y los
timeouts de las funciones de Vercel.

**Arquitectura real (confirmada tras probar contra una instancia real de
OpenHands self-hosteada — versión completa `docker.openhands.dev/openhands/openhands:1.8`,
no el componente "Agent Server" headless que se había asumido inicialmente):**

1. `POST /api/openhands/start` — crea un registro en `agent_jobs` (Supabase,
   status `queued`), llama a `POST {OPENHANDS_BASE_URL}/api/v1/app-conversations`
   (endpoint y schema confirmados vía el Swagger real de la instancia:
   `initial_message.content[]`, `selected_repository`, `selected_branch`,
   `git_provider`, `llm_model`), guarda el `conversation_id` devuelto, y
   **responde de inmediato** — nunca espera a que la tarea termine.
2. **No hay webhook nativo confirmado**: se revisó el array `processors`
   del schema de arranque y solo expone tipos internos (Logging,
   SetTitle), sin un tipo de webhook genérico documentado. En vez de
   asumir uno, se optó por un **relay de polling** (`scripts/openhands-relay.js`),
   que corre en la misma PC que OpenHands (Node 18+, sin dependencias):
   cada ~4s pregunta a `/api/openhands/active-jobs` qué conversaciones
   están activas, pollea `GET /api/v1/conversation/{id}/events` y
   `GET /api/v1/app-conversations?ids=...` (estado) contra OpenHands local,
   y reenvía lo nuevo a `/api/openhands/webhook`.
3. `/api/openhands/webhook` — sin cambios de diseño: valida el secreto
   compartido, escribe en `agent_job_events`, actualiza `status` si
   corresponde. Rápido, nunca bloquea.
4. El browser sigue suscrito directo a Supabase Realtime — sin cambios acá,
   el relay es invisible para la UI.

**Mecanismo real de arranque (confirmado en vivo, dos pasos asíncronos):**
`POST /api/v1/app-conversations` **no devuelve la conversación lista** —
arranca un `AppConversationStartTask` (status `WORKING` →
`WAITING_FOR_SANDBOX` → ... → `READY`, o `ERROR`) y devuelve el `id` de
esa tarea, con `app_conversation_id: null` hasta que esté lista. Hay que
pollear `GET /api/v1/app-conversations/start-tasks?ids=<id>` hasta
`status: "READY"`, recién ahí aparece el `app_conversation_id` real. Esa
resolución la hace el relay local (no la función de Vercel, que debe
responder rápido) — guarda el resultado en Supabase vía
`POST /api/openhands/resolve` una vez resuelto. Columna nueva en
`agent_jobs`: `openhands_start_task_id` (el id de la tarea de arranque,
distinto de `openhands_conversation_id`, que queda null hasta la
resolución).

**LiteLLM + modelos NIM**: confirmado que LiteLLM exige un prefijo de
proveedor reconocido en el nombre del modelo. Un modelo NVIDIA NIM debe
cargarse como `openai/nvidia/<nombre-real>` (no `nvidia/<nombre-real>` a
secas) — sin el prefijo `openai/`, tira
`BadRequestError: LLM Provider NOT provided`.

**Exposición pública sin costo (actualizado — ya no Cloudflare Tunnel)**: se
probó primero con Cloudflare Tunnel (quick tunnel), pero se **abandonó** por
inestabilidad real en uso (desconexiones tipo "control stream encountered a
failure") y porque genera una URL nueva en cada reinicio. Se migró a
**ngrok**, usando su "dev domain" gratuito y fijo — la URL no cambia entre
reinicios, lo que elimina la necesidad de re-pegar `OPENHANDS_BASE_URL` en
Vercel cada vez. Sigue corriendo en la PC del usuario (Windows + Docker
Desktop) — la dependencia de la notebook personal (y de que no entre en
suspensión) sigue siendo una limitación operativa real y sin resolver.

**Tablas** (`supabase/schema_agent_jobs.sql`): sin cambios — `agent_jobs` y
`agent_job_events`, RLS lectura pública / escritura server-side, agregadas
a `supabase_realtime`.

## 22. Ejecución multi-agente sin PC: Code Intake como ruta default, OpenHands como Execution Adapter opcional — RATIFICADA

**Contexto de esta decisión:** tras auditar el proyecto completo (ver
`SPK_MultiDev_Auditoria_Arquitectonica.md`), se identificó una ambigüedad
nunca resuelta: el objetivo original nunca declaró explícitamente cuál de
las dos rutas para producir cambios de código — Code Intake (vía cualquier
modelo de chat) u OpenHands (agente autónomo con sandbox real) — es la
**ruta principal**. En la práctica, la integración de OpenHands terminó
absorbiendo la atención de varias sesiones de debugging, dando la impresión
de ser el camino "serio", cuando en realidad **Code Intake ya cubre el caso
de uso central del hub** (desarrollar sin depender de una PC) sin ninguna de
las fragilidades operativas de OpenHands.

**Se ratifica formalmente:**

- **Code Intake es la ruta default.** Cualquier modelo conectado al hub
  (Claude, NVIDIA NIM, ChatGPT) ya recibe la instrucción de convención
  `FILE:`/`ACTION:` en su system prompt (sección 7), sin importar el
  proveedor — esto ya estaba construido, solo nunca se había declarado como
  la vía principal. No requiere PC, no requiere Docker, no requiere ningún
  proceso corriendo fuera de Vercel/Supabase/el navegador.
- **OpenHands pasa a ser un "Execution Adapter" opcional** — se usa
  específicamente cuando la tarea necesita *ejecutar* algo de verdad
  (correr tests, instalar dependencias, exploración autónoma multi-archivo
  con terminal real), no cuando alcanza con que un modelo *escriba* el
  cambio y el hub lo commitee. Sigue totalmente disponible y funcional
  (sección 20), pero deja de ser la única vía práctica para delegar código.
- **Cambios de esta ratificación (Sprint "Multi-Agent Execution MVP"):**
  1. Panel B arranca con el rol `Implementador` por default (antes: `Ninguno`
     en ambos paneles) — baja la fricción de armar manualmente un panel
     listo para generar código.
  2. Aviso (no bloqueante) de tamaño de contexto antes de enviar un mensaje,
     con umbral más conservador para NIM que para Anthropic/OpenAI — pieza
     que ya estaba speceada en la sección 11 original y nunca se había
     implementado; ahora previene truncamientos silenciosos al usar un
     segundo modelo de código además de Claude.
  3. El botón "Abrir en Code Intake" se resalta visualmente cuando el
     mensaje ya contiene bloques `FILE:` aplicables, sin importar qué
     proveedor lo generó — mejora de descubribilidad, no funcionalidad
     nueva (el parser ya sabía detectar esto).
  4. Esta misma sección de documentación, ratificando el cambio de
     jerarquía entre las dos rutas.
- **Nada de esto tocó el código de OpenHands, el relay, ni el esquema de
  `agent_jobs`/`agent_job_events`** — sigue intacto y disponible tal cual
  quedó documentado en la sección 20.

**Actualización posterior — corte de flujo resuelto (ver
`Auditoria_Flujo_Contexto_Modelo_CodeIntake.md`):** se detectó que ningún
modelo (NIM, Claude, OpenAI) recibía el árbol real de archivos del repo —
solo el texto de `CONTEXT_BASE.md`/README, obligando al modelo a "adivinar"
paths al generar `ACTION: write`. La función que sí lista archivos reales
(`listRepoTree`, ya existente) estaba conectada únicamente a Limpieza
Masiva. Se resolvió **reutilizando esa misma función, sin escribir código
nuevo**: `handleLoadProject` ahora también llama a `/api/github/tree` y
adjunta la lista de paths reales al contexto que se manda a cualquier
modelo. Además, `ACTION: write` en `resolveInstructions` ahora rechaza (con
aviso, no en silencio) crear un archivo nuevo si detecta que ya existe un
archivo con el mismo nombre en otra ruta del árbol real — mismo criterio ya
usado para `ACTION: patch` cuando `FIND` no matchea.

**Actualización posterior — de descriptivo a normativo (ver auditoría LLM-
perspective de assembly de prompt):** se detectó que aunque el árbol de
archivos llegaba al modelo, lo hacía como dato descriptivo diluido en la
prosa de `contextText`, sin ninguna instrucción que le dijera al modelo que
debía tratarlo como autoritativo — explicando por qué un modelo podía
igual responder "necesito el árbol del repositorio" pese a tenerlo en el
prompt. Se resolvió **sin tocar arquitectura ni transporte**, solo el
armado del prompt: el listado ya no se concatena en `contextText` (armado
en `handleLoadProject`), sino que se construye como bloque normativo
separado dentro de `sendMessage`, justo antes de `CODE_INTAKE_INSTRUCTION`
(la instrucción que efectivamente consume paths `FILE:`), con reglas
explícitas: es autoritativo, todo path debe pertenecer al índice salvo
creación deliberada de archivo nuevo, nunca inventar rutas, no volver a
pedir el árbol, y decir explícitamente si no hay archivo adecuado para la
tarea.

**Verificación en vivo confirmada:** se interceptó el `systemContent` real
inmediatamente antes del `fetch` a `/api/chat` (mostrado en pantalla, no en
consola, por limitación de iOS Safari standalone sin devtools) contra un
proyecto real (`Spk_Alchemy`, 34 paths). El bloque
`=== ÍNDICE DE ARCHIVOS DEL REPOSITORIO (AUTORITATIVO) ===` llegó completo,
con las 5 reglas intactas y en la posición correcta (después del contexto
del proyecto, antes de `CODE_INTAKE_INSTRUCTION`). La intercepción de debug
ya se removió del código tras confirmar esto.

## 24. Event Canon — vocabulario de eventos del Hub, base para persistencia por eventos — RATIFICADA

**Contexto de esta decisión:** al diseñar la evolución del hub hacia un "sistema operativo de conocimiento" (Task → Knowledge Layer → Context Builder → Loop iterativo), surgió una pregunta previa más fundamental: ¿el estado del hub debería ser mutable (tablas actualizadas con `UPDATE`) o derivarse de un log de eventos append-only? Se analizó explícitamente (documento `Analisis_Task_Como_Event_Stream.md`) si el modelo de `Task` puede representarse como una proyección sobre un stream de eventos en vez de estado mutable directo — la respuesta fue sí, con el patrón híbrido estándar: el log de eventos es la única fuente de verdad, las tablas de estado (como `tasks`) son proyecciones derivadas y reconstruibles, nunca la verdad en sí.

**Por qué esto no es una moda importada:** el propio proyecto ya había inventado este patrón, en miniatura, para OpenHands — el relay poll-ea `agent_job_events` y deriva si un job está `completed`. Formalizar esto para el resto del hub es generalizar algo que ya existía, no copiar una tendencia externa.

**Se ratifica el orden de implementación** (distinto al que se había planteado originalmente, que empezaba por `Task`):

```
Sprint 0 → Event Canon (CERRADO — este documento)
Sprint 1 → Event Log (tabla append-only, sin inteligencia, solo registrar)
Sprint 2 → Task (como proyección derivada de eventos, nunca como tabla mutable de origen)
Sprint 3 → Knowledge Layer (extrae de Tasks y eventos)
Sprint 4 → Context Builder (empieza a decidir qué mandar al modelo)
Sprint 5 → Loop (automatizar partes del flujo, con los límites de la sección 8
           del documento de diseño de Knowledge Hub siempre vigentes)
```

**Motivo del reordenamiento:** si `Task` se construye primero como tabla mutable y después se decide migrar a proyección de eventos, esa migración requiere reconstruir retroactivamente un pasado que nunca se registró como eventos — no se puede. Si el Event Log va primero, `Task` nace ya siendo una proyección, sin nada que migrar nunca.

**El canon completo (32 eventos en 7 categorías: Conversation, Task, Knowledge,
Development, Context, AI, Execution), las 5 reglas del canon, y el envelope
común de campos (`eventId`, `timestamp`, `projectId`, `entityId`, `eventType`,
`actor`, `source`, `version`, `payload`) quedan documentados en
`Sprint0_Event_Canon.md`** — no se duplica acá para no tener dos fuentes de
verdad del mismo contrato. Puntos destacados de ese documento:

- **Regla 5 (nueva):** no se definen eventos para capacidades que todavía no
  existen — un evento entra al canon solo cuando ya hay (o está por haber)
  un emisor real. Por esto se descartaron explícitamente `ResponseChunkReceived`
  y `ResponseCancelled` (no hay streaming ni cancelación real hoy).
- **Gaps reales encontrados al auditar el canon contra el código actual:**
  faltaban `RepoDeleted` (borrar un repo no genera commit — sin este evento
  la acción más irreversible del hub quedaría invisible), `PatchRejected`
  (ya existe el rechazo real en `resolve.ts`, tanto por `FIND` que no
  matchea como por el endurecimiento de `ACTION: write`), `FilesDeleted`,
  y `KnowledgeSuperseded`.
- **Categoría `Execution` agregada** para representar OpenHands a nivel Hub
  (`ExecutionRequested`/`Completed`/`Failed`) — los eventos internos finos
  de OpenHands siguen viviendo en `agent_job_events`, no bubblean al canon
  general salvo que algún consumidor futuro demuestre necesitarlo.
- **Campo `source` transversal a todo evento** — de qué sistema es
  causalmente responsable cada hecho (`user`/`Claude`/`NIM`/`GPT`/
  `OpenHands`/`GitHub`/`System`). Sin este campo, preguntas de atribución
  futura ("¿cuántos commits vinieron de NIM?") serían irreconstruibles.
- **`TaskAbandoned`, no `TaskRejected`** — distinción conceptual: una tarea
  puede dejar de tener sentido (cambió la arquitectura, se descubrió algo
  mejor) sin que eso implique que alguien la evaluó y la rechazó.

**Sprint 1 (Event Log) queda autorizado a empezar.** Sigue sin tocarse
ninguna pieza ya construida — Code Intake, Supabase, OpenHands, GitHub —
todo esto se construye encima, no en reemplazo.

## 25. Sprint 1 — Event Log implementado — RATIFICADA

Implementa exclusivamente la capa de persistencia y registro del canon
ratificado en la sección 24. Sin Task, sin Knowledge Layer, sin Context
Builder, sin automatización — solo `events` como tabla append-only y su
emisión instrumentada. Ningún comportamiento existente cambió.

**Infraestructura nueva (mínima, a propósito):**
- Tabla `events` en Supabase — envelope completo (`event_id`, `timestamp`,
  `project_id`, `entity_id`, `event_type`, `actor`, `source`, `version`,
  `payload`), RLS de lectura pública, sin política de escritura client-side
  (solo vía `service_role`, igual que el resto del hub).
- `lib/events/emit.ts` — único punto de escritura. `emitEvent()` nunca tira
  excepción: si el insert falla, se loguea y se sigue. Ninguna acción real
  del hub puede romperse porque falló registrar el evento que la describe.
- `POST /api/events/emit` — única ruta nueva de API, exclusiva para los 3
  eventos que no tienen ningún otro punto de contacto con el servidor
  (`ContextBuilt`, `ContextRejected`, `ModelSelected` — pasan enteramente
  client-side). Todo el resto del canon se instrumentó colgado de rutas que
  ya existían — cero rutas nuevas más allá de esta.

**24 de los 32 eventos del canon quedaron instrumentados** (quedan afuera,
a propósito, los 8 sin emisor real hoy: `MessageDraftSaved` y los 4 de
`Task` + 4 de `Knowledge`, que todavía no existen como subsistemas — regla
5 del canon).

| Evento | Emisor (archivo) | Payload | Punto de persistencia | Comportamiento ante falla |
|---|---|---|---|---|
| `ConversationCreated` | `POST /api/sessions` | — | Tras `createSession` | Si falla el insert del evento, la sesión igual se crea y se devuelve normal — se loguea, no interrumpe |
| `ConversationArchived` | `DELETE /api/sessions/[id]` | — | Tras `deleteSession` | Idem — el borrado ya ocurrió, el evento es solo registro |
| `MessageSent` | `POST /api/chat` | `provider`, `model` | Al validar la request, antes de llamar al adapter | Si falla, el chat sigue funcionando normal — el evento nunca bloquea la respuesta |
| `ResponseStarted` | `POST /api/chat` | `provider`, `model` | Justo antes de `adapter.sendMessage` | Idem |
| `ResponseCompleted` | `POST /api/chat` | `provider`, `model` | Tras respuesta exitosa del adapter | Idem |
| `ResponseFailed` | `POST /api/chat` | `provider`, `model`, `error` | En el catch general de la ruta | Idem — el error real ya se le devuelve al usuario sin importar esto |
| `ProviderUnavailable` | `POST /api/chat` | `provider`, `model`, `error` | Cuando el reintento de 503 también falla | Idem |
| `PatchGenerated` | `POST /api/chat` | `provider`, `model` | Si la respuesta matchea `/^FILE:\s*.+$/m` (mismo regex que el badge visual de `Panel.tsx`) | Idem |
| `ContextLoaded` | `POST /api/github/context` | `source` (CONTEXT_BASE.md/README), `length` | Tras traer el contenido real con éxito | Si falla el evento, el contexto igual se devuelve al cliente |
| `ContextBuilt` | client-side, `sendMessage` en `app/page.tsx` → `/api/events/emit` | `provider`, `totalChars`, `hasFileIndex`, `hasProjectContext` | Justo después de armar `systemContent` | Fire-and-forget — un `.catch()` silencioso, nunca bloquea el envío del mensaje |
| `ContextRejected` | client-side, `sendMessage` → `/api/events/emit` | `provider`, `totalChars`, `threshold` | Cuando el usuario cancela el `window.confirm` de tamaño de contexto | Idem |
| `ModelSelected` | client-side, los 4 `onChange` de proveedor/modelo → `/api/events/emit` | `field` (`provider`/`model`), `from`, `to` | En el momento del cambio, antes de actualizar el estado del panel | Idem |
| `PatchValidated` | `POST /api/codeintake/resolve` | `path`, `action` | Por cada instrucción resuelta sin `error` | Si falla el evento, `resolved` igual se devuelve completo al cliente |
| `PatchRejected` | `POST /api/codeintake/resolve` | `path`, `action`, `reason` | Por cada instrucción con `error` (FIND sin match, o colisión de `ACTION: write`) | Idem |
| `PatchApplied` | `POST /api/github/commit` | `owner`, `repo`, `filesCount` | Tras `commitFiles` exitoso | Si falla el evento, el commit ya se hizo — no hay forma de "deshacerlo" por esto, y no debería |
| `CommitCreated` | `POST /api/github/commit` y `bulk-delete-files` | `owner`, `repo`, `message`/`filesDeleted` | Idem | Idem |
| `PushSucceeded` | `POST /api/github/commit` y `bulk-delete-files` | `owner`, `repo` | Idem | Idem |
| `PushFailed` | `POST /api/github/commit` y `bulk-delete-files` | `error` | En el catch de cada ruta | Se emite después de que el error real ya se le devuelve al usuario |
| `FilesDeleted` | `POST /api/github/bulk-delete-files` | `owner`, `repo`, `paths` | Tras `commitFiles` exitoso | Igual que `PatchApplied` — la acción real ya ocurrió |
| `RepoDeleted` | `POST /api/github/delete-repos` | `owner`, `repo` | Por cada repo efectivamente borrado en el loop | El repo ya está borrado — el evento es registro puro, irreversible como la acción misma |
| `ExecutionRequested` | `POST /api/openhands/start` | `owner`, `repo`, `branch`, `startTaskId` | Tras resolver el `startTaskId` de OpenHands | Si falla, el job igual quedó creado y disparado |
| `ExecutionCompleted` | `POST /api/openhands/webhook` | `conversationId` | Cuando `execution_status: finished` | El estado del job ya se actualizó antes — el evento es adicional |
| `ExecutionFailed` | `POST /api/openhands/webhook` y `POST /api/openhands/resolve` | `conversationId`/`reason`, `stage` | Cuando el status es error/stuck, o cuando el `start_task` nunca llega a `READY` | Idem |

**Actor y source, en la práctica:** `actor` es `"user"` en casi todo (el
hub es mono-usuario, todo lo dispara una acción directa) salvo
`ExecutionCompleted`/`ExecutionFailed`, que llevan `actor: "system"` porque
los detecta el relay en background, no un tap directo. `source` mapea
proveedor→nombre del canon (`nvidia`→`NIM`, `anthropic`→`Claude`,
`openai`→`GPT`) vía `providerToSource()` en `lib/events/emit.ts`, y usa
`"GitHub"`/`"OpenHands"`/`"System"`/`"user"` según corresponda.

**Limitación conocida, documentada a propósito (no un bug):**
`CodeIntakeDrawer` todavía no manda `projectId` a `/api/codeintake/resolve`
ni a `/api/github/commit` — los eventos de esas rutas quedan con
`project_id: null` por ahora. Como el campo es opcional en el envelope, no
rompe nada; conectar el prop completo hubiera sido más refactor del
estrictamente necesario para este sprint. Queda para cuando se construya
Task (Sprint 2), que sí va a necesitar esa asociación de verdad.

**Bug real encontrado y corregido sobre la marcha:** `handleLoadProject`
estaba a punto de mandarle a `/api/github/context` el `projectId` viejo del
estado de React (todavía no actualizado en ese punto del closure) en vez
del recién creado por `/api/projects` — se ató a una variable local
(`loadedProjectId`) antes de que se manifestara como problema real.

**Build validado** (`npx next build`, compiló limpio, `/api/events/emit`
listada correctamente entre las rutas). Sprint 2 (Task, como proyección
derivada de este log — nunca como tabla mutable de origen) queda
autorizado a empezar.

## 26. Sprint 1 — Integrity Gate: clasificación Canonical/Observational y reglas de durabilidad — RATIFICADA

Antes de autorizar Sprint 2, se auditó el Sprint 1 contra el invariante
central del Event Log: *una operación que cambia estado no puede tener
éxito de forma invisible sin su evento canónico correspondiente*. La
implementación original de `emitEvent()` era best-effort puro (loguea y
sigue) — válido para telemetría observacional, no necesariamente para
transiciones de estado canónicas.

**Clasificación final de los 24 eventos instrumentados:**

**CANONICAL** (7) — `RepoDeleted`, `FilesDeleted`, `PatchApplied`,
`CommitCreated`, `PushSucceeded`, `ExecutionRequested`,
`ExecutionCompleted`. Representan transiciones de estado reales. Dentro de
este grupo, **solo `RepoDeleted` es Tier A** (después de borrarlo, GitHub
no retiene absolutamente nada — es el único lugar del sistema entero donde
ese hecho podría quedar registrado). Los otros 6 son Tier B: el hecho
subyacente sigue siendo recuperable desde GitHub o `agent_jobs` aunque el
Event Log lo pierda — perderlos rompe la promesa de reconstrucción unificada,
pero no borra el hecho del universo.

**OBSERVATIONAL** (17) — el resto. Incluye, con justificación explícita:
todos los eventos de falla (`PushFailed`, `ExecutionFailed`,
`ResponseFailed`, `ProviderUnavailable` — el invariante habla de éxitos
invisibles; una falla nunca es invisible, el usuario ya la vio en pantalla);
`ConversationCreated`/`ConversationDeleted` (la tabla `sessions` ya es un
registro durable independiente); `MessageSent`/`ResponseCompleted`
(redundantes con la tabla `messages`, que ya persiste el contenido real);
`ContextLoaded`/`ContextBuilt`/`ContextRejected`/`ModelSelected`
(descriptivos, sin cambio de estado real); `PatchGenerated`/`Validated`/
`Rejected` (todos pre-commit — si se pierden, no hay ningún cambio real que
quedó sin rastro).

**Corrección mínima aplicada** (sin colas, sin workers, sin bus de eventos,
sin transacciones distribuidas — ninguna de esas cuatro cosas hacía falta):

1. `emitEvent()` ahora reintenta hasta 3 veces (backoff 300ms/900ms) antes
   de darse por vencido, y devuelve `boolean` (antes `void`) — beneficia a
   los 24 eventos por igual, sin costo para el camino feliz.
2. **Solo `RepoDeleted`** usa ese valor de retorno: si sigue sin persistir
   tras los reintentos, la API lo devuelve como `eventLogged: false` y
   `CleanupPanel` lo muestra como advertencia visible (`⚠️ Se borraron
   pero NO se pudo registrar...`). Ningún otro evento recibe este
   tratamiento — se le dio garantía reforzada solo al único que
   genuinamente la necesita, tal como se pidió explícitamente.
3. **`ConversationArchived` renombrado a `ConversationDeleted`**: el código
   hace un `DELETE` físico, no un archivado recuperable — llamarlo
   "Archived" era una interpretación (viola la regla 1 del canon: los
   eventos son hechos, no opiniones), no un hallazgo cosmético.
4. **Hueco de `projectId` cerrado**: `CleanupPanel` no mandaba `projectId`
   en ningún fetch (`bulk-delete-files`, `delete-repos`); tampoco lo
   aceptaba `bulk-delete-files/route.ts`. `CodeIntakeDrawer` ya lo tenía
   bien cableado de punta a punta (verificado, no hizo falta tocarlo).
   `entity_id` en `null` para eventos donde Task/Knowledge todavía no
   existen se mantiene tal cual — inventar semántica de entidad ahora
   sería exactamente lo que la regla 5 del canon prohíbe.

**Riesgo real, no hipotético:** el escenario de falla auditado (operación
exitosa, falla el insert del evento) ya ocurrió de hecho en esta sesión —
Supabase se pausó dos veces por inactividad (sección 11). La corrección de
reintento cubre los baches transitorios de red; no cubre una pausa completa
de varios minutos, y eso es una limitación conocida y aceptada, no un
descuido — construir algo que sí la cubriera exigiría exactamente la
infraestructura (colas, reintentos diferidos) que este sprint tenía
prohibido agregar.

**Build validado** tras los 8 archivos tocados (`lib/events/emit.ts`,
`app/api/github/delete-repos/route.ts`, `app/api/github/bulk-delete-files/route.ts`,
`app/api/sessions/[id]/route.ts`, `components/CleanupPanel.tsx`,
`components/SettingsDrawer.tsx`, más verificación de `CodeIntakeDrawer.tsx`
y `app/api/openhands/start/route.ts`, que ya estaban correctos). **Sprint 1
queda cerrado de verdad.** Sprint 2 (Task, como proyección derivada de este
log) queda autorizado a empezar.

## 27. Event Authority Model — refinamiento de terminología (Tier A / Tier B / Observational) — RATIFICADA

**Esto no reclasifica nada de la sección 26 — refina cómo se nombra la
mitad "Canonical" de esa clasificación, porque agruparla como un bloque
uniforme escondía una diferencia real: no todos los eventos canónicos
necesitan el mismo nivel de garantía.** Se preserva la sección 26 tal cual
quedó escrita — esto es una aclaración nueva, no una reescritura.

**Por qué hacía falta esta aclaración:** la sección 26 decía, implícitamente,
que el Event Log aspira a ser "la fuente de verdad" sin matizar que, para
casi todos los eventos canónicos, la fuente de verdad *primaria* en
realidad sigue siendo un sistema externo (GitHub, `agent_jobs`) — el Event
Log es quien unifica esa historia en un solo lugar consultable, no quien
la origina. Solo `RepoDeleted` no tiene ningún sistema externo de respaldo.
Dejar esto ambiguo hubiera sido un problema real al llegar a Sprint 2: Task
necesita saber, de antemano, cuáles de sus eventos futuros exigen garantía
fuerte (porque no van a tener ningún otro respaldo) y cuáles no.

### Invariante actualizado

**Se reemplaza** la formulación anterior ("el Event Log es la única fuente
de verdad para toda operación") **por esta, más precisa:**

> El Event Log es la fuente canónica del estado interno del Hub y de la
> línea de tiempo operacional unificada. Para efectos secundarios externos
> (GitHub, OpenHands, cualquier sistema de ejecución persistente), el Event
> Log preserva trazabilidad por sobre esas autoridades externas — no las
> reemplaza como fuente primaria. El estado interno que depende
> exclusivamente del Event Log (sin ningún respaldo externo) exige garantías
> de durabilidad más fuertes que los eventos externamente reconstruibles.

### Los tres tiers

**Tier A — Canonical interno/irrecuperable.** Representa estado que no se
puede reconstruir desde ningún otro sistema autoritativo. Si la persistencia
falla, el sistema nunca puede fingir en silencio que la historia canónica
está completa — exige la garantía reforzada (reintento + aviso visible si
falla igual).

**Tier B — Canonical externamente recuperable.** Pertenece a la línea de
tiempo unificada del Hub y normalmente debería persistirse, pero si el
Event Log lo pierde, el hecho subyacente sigue existiendo en un sistema
externo autoritativo (GitHub, `agent_jobs`) y podría reconciliarse después.
Canónico para la trazabilidad del Hub — el Event Log no es la fuente física
única del hecho externo en sí.

**Observational.** Telemetría, procedencia, historial de UX o diagnóstico.
Su pérdida no invalida el estado reconstruido.

### Tabla final — los 24 eventos instrumentados en Sprint 1

| Evento | Tier | Autoridad primaria | ¿Recuperable externamente? | Comportamiento actual ante falla | ¿Aceptable en Sprint 1? |
|---|---|---|---|---|---|
| `RepoDeleted` | **A** | — (ninguno) | No | Reintenta 3 veces; si falla igual, avisa visible al usuario | Sí — ya implementado |
| `CommitCreated` | B | GitHub | Sí | Reintenta 3 veces; best-effort si falla igual | Sí |
| `PushSucceeded` | B | GitHub | Sí | Idem | Sí |
| `PatchApplied` | B | GitHub | Sí | Idem | Sí |
| `FilesDeleted` | B | GitHub | Sí | Idem | Sí |
| `ExecutionRequested` | B | `agent_jobs` / OpenHands | Sí | Idem | Sí |
| `ExecutionCompleted` | B | `agent_jobs` / OpenHands | Sí | Idem | Sí |
| `ConversationCreated` | Observational | `sessions` (Supabase) | Sí | Best-effort | Sí |
| `ConversationDeleted` | Observational | `sessions` (Supabase) | Sí | Best-effort | Sí |
| `MessageSent` | Observational | `messages` (Supabase) | Sí | Best-effort | Sí |
| `ResponseStarted` | Observational | — (sin equivalente, bajo valor) | No aplica | Best-effort | Sí |
| `ResponseCompleted` | Observational | `messages` (Supabase) | Sí | Best-effort | Sí |
| `ResponseFailed` | Observational | Ya visible al usuario en pantalla | No aplica | Best-effort | Sí |
| `ProviderUnavailable` | Observational | Ya visible al usuario en pantalla | No aplica | Best-effort | Sí |
| `PatchGenerated` | Observational | Pre-commit, sin estado real todavía | No aplica | Best-effort | Sí |
| `PatchValidated` | Observational | Pre-commit, sin estado real todavía | No aplica | Best-effort | Sí |
| `PatchRejected` | Observational | Pre-commit, sin estado real todavía | No aplica | Best-effort | Sí |
| `PushFailed` | Observational | Ya visible al usuario en pantalla | No aplica | Best-effort | Sí |
| `ExecutionFailed` | Observational | Ya visible al usuario en pantalla / `agent_jobs.status` | Sí | Best-effort | Sí |
| `ContextLoaded` | Observational | Sin cambio de estado persistente | No aplica | Best-effort | Sí |
| `ContextBuilt` | Observational | Sin cambio de estado persistente | No aplica | Best-effort | Sí |
| `ContextRejected` | Observational | Sin cambio de estado persistente | No aplica | Best-effort | Sí |
| `ModelSelected` | Observational | Preferencia de UI | No aplica | Best-effort | Sí |

**Ningún cambio de clasificación real** respecto a la sección 26 — es la
misma división Canonical/Observational, con la mitad "Canonical" partida en
dos tiers explícitos en vez de tratada como bloque uniforme. Ningún código
cambió con esta sección.

### Consecuencia explícita para Sprint 2 (contrato, no implementación)

**Task se va a representar como una proyección sobre el Event Log** (sección
24). Por lo tanto, **los eventos del ciclo de vida de Task van a ser Tier A,
canónicos internos, por definición** — no tienen ningún sistema externo de
respaldo, porque Task no existe en ningún otro lado más que en la
reconstrucción a partir de sus propios eventos. Esto incluye, como mínimo:
`TaskCreated`, `TaskUpdated` (si el canon lo conserva tal como está
diseñado), `TaskCompleted`, `TaskAbandoned`.

**Una transición de Task nunca puede ser best-effort.** Si alguno de estos
eventos no se persiste de forma durable, la transición de Task correspondiente
**no debe considerarse confirmada** — el patrón de "reintentar + avisar
visible si falla igual" que hoy tiene `RepoDeleted` en exclusiva va a
tener que aplicarse a toda la familia de eventos de Task cuando se
implemente. **Esto no se implementa ahora** — queda establecido como el
contrato que Sprint 2 tiene que respetar desde el diseño, no como algo a
resolver después de escribir el código.

### Validación

1. `RepoDeleted` sigue protegido exactamente igual que en la sección 26 — sin cambios de código.
2. Los 6 eventos Tier B pueden reconciliarse desde GitHub/`agent_jobs` si hiciera falta — ninguno requiere el reintento reforzado.
3. Los eventos Observational siguen siendo legítimamente best-effort.
4. Los futuros eventos de Task **no** van a poder ser best-effort — contrato establecido para Sprint 2.
5. **Sprint 1 no requiere ningún cambio de implementación adicional** después de esta aclaración — es puramente documentación.

## 28. Sprint 2 — Task como proyección: implementado y validado E2E contra producción — RATIFICADA

**Task se implementó exactamente como lo exigía el contrato de la sección
27: una proyección derivada de eventos Tier A, nunca la fuente de verdad.**
Tabla `tasks` nueva (proyección), `lib/db/tasks.ts` (única capa que la
toca), tres rutas API (`/api/tasks`, `/api/tasks/[id]`,
`/api/tasks/[id]/rebuild`), y `TasksDrawer.tsx` (mismo patrón que
`ChatsDrawer`, sin rediseñar la interfaz).

**Garantía Tier A real, no solo declarada:** en `createTask` y
`transitionTask`, el evento (`TaskCreated`/`TaskUpdated`/`TaskCompleted`/
`TaskAbandoned`) se persiste primero — si `emitEvent()` devuelve `false`
tras sus 3 reintentos (Sprint 1), la función lanza `TaskTransitionError`
**antes** de tocar la tabla `tasks`. A diferencia de `RepoDeleted` (que
avisa pero no puede deshacer un efecto externo ya ocurrido), acá no hay
ningún efecto externo irreversible — así que la transición se rechaza
entera, con error real devuelto al cliente (409), nunca un éxito
silencioso.

**Validación E2E ejecutada contra producción real** (no simulada — con el
propio usuario operando la UI desde iPhone, y verificación directa contra
Supabase después de cada paso):

1. Crear Task → confirmado en base real.
2. Recargar/consultar → persistencia confirmada.
3. Transicionar a `in_progress` → confirmado.
4. Recargar → estado proyectado correcto.
5. Completar → confirmado, estado final `completed`.
6. Historial de eventos inspeccionado en la propia UI (captura real) →
   `TaskCreated` → `TaskUpdated` → `TaskCompleted`, orden correcto,
   timestamps reales.
7-8. Reconstrucción de proyección: como el sandbox de desarrollo no tiene
   salida de red hacia `vercel.app` (limitación real del entorno, no del
   hub), se replicó la misma lógica del reductor de `rebuildTaskProjection`
   directo en SQL contra los eventos reales — **encontró un hallazgo real
   de la primera pasada**: `tasks.created_at`/`updated_at` se calculaban
   con un `now()` separado del timestamp real del evento, con desajustes
   de 20-90ms. Corregido (`lib/events/emit.ts` acepta un `timestamp`
   explícito opcional; `createTask`/`transitionTask` calculan un único
   `now` y lo comparten entre el evento y la proyección). Re-validado con
   una segunda Task real tras el fix: coincidencia **exacta**, confirmada
   dos veces contra la base.
9. Falla de persistencia del evento: no se simuló en producción (hubiera
   requerido romper Supabase real, riesgo innecesario) — se probó en su
   lugar con un insert SQL real que viola la restricción NOT NULL de
   `events`, confirmando que Postgres rechaza el insert sin dejar ningún
   rastro parcial (0 filas huérfanas verificado), más inspección directa
   del código que confirma que el `if (!logged) throw` ocurre siempre
   antes de cualquier `.update()`/`.insert()` sobre `tasks`.
10. UI mobile validada en vivo, en iPhone real (captura de pantalla): abrir
    drawer, crear, abrir, cambiar estado, ver historial — los 5 pasos
    funcionaron sin fricción.

**Limitación de entorno encontrada y documentada:** el sandbox de
desarrollo de Claude no puede alcanzar `vercel.app` (lista blanca de red
restringida a dominios de dev-tooling). La validación real de la API en
producción se hizo en conjunto con el usuario operando la UI real, más
verificación directa contra Supabase — un método más riguroso que un curl
aislado, porque valida API y UX mobile al mismo tiempo con datos reales.

**Sprint 2 queda CERRADO**, con un fix real encontrado y corregido durante
la propia validación (no un defecto que haya quedado pendiente). **Sprint 3
(Knowledge Layer) no arranca todavía.**

## 29. Sprint 3 — Knowledge Layer MVP: CERRADO, validado en producción — RATIFICADA

**Sprint 3 queda formalmente cerrado.** Conocimiento del proyecto ahora
sobrevive a conversaciones, dispositivos y cambios de modelo — captura
explícita, humano-controlada, sin extracción automática.

**Qué se implementó:**
- Tabla `knowledge_items` como proyección Tier A (mismo patrón que Task,
  sección 28) — nunca la fuente de verdad, siempre derivada de
  `KnowledgeCaptured`/`KnowledgePromoted`/`KnowledgeRejected`.
- 11 tipos ratificados del canon (Observation, Insight, Decision,
  Hypothesis, Experiment, Pattern, ADRCandidate, RejectedIdea,
  OpenQuestion, ImplementationNote, TemporaryNote).
- Estados `captured → promoted | rejected` únicamente — **`Archived` NO se
  implementó**, porque no está ratificado en el Event Canon (sección 24) y
  este sprint tuvo instrucción explícita de no inventar eventos en silencio.
- Captura manual (`KnowledgeDrawer`, con selector opcional de Task) y
  captura desde una respuesta de IA (botón inline en `Panel.tsx`, sin
  cadena de modales).
- `lib/db/knowledge.ts`: único punto de escritura, mismo patrón que
  `tasks.ts` — validar → evento Tier A → recién ahí proyección.

**Qué se validó manualmente en producción** (evidencia real, no simulada):
creación manual; persistencia tras reload completo; vínculo a una Task
existente; captura desde una respuesta de IA con `source_message_id`
poblado con el id real de Supabase (confirmado con logs instrumentados en
pantalla + verificación directa en la base, dos veces — con y sin sesión
activa); `session_id` y `project_id` correctamente enlazados; promoción
(`captured → promoted`); rechazo (`captured → rejected`); filtros por
tipo/estado; UI mobile usable en iPhone real; los tres eventos
(`KnowledgeCaptured`/`Promoted`/`Rejected`) confirmados en el Event Log.

**Dos defectos reales encontrados y corregidos durante la propia
validación** (no quedaron pendientes):

1. **Carrera de tiempos en la captura desde respuesta de IA**: el botón
   "Capturar como Knowledge" podía habilitarse antes de que `persistMessage()`
   terminara, permitiendo capturar sin `source_message_id` real. Corregido
   distinguiendo `dbId === undefined` ("todavía esperando") de `dbId === null`
   ("ya resuelto, sin id real disponible") — el botón solo se deshabilita
   en el primer caso. Encontrado un segundo camino al mismo síntoma
   (mensajes de respuesta con error nunca llamaban a `persistMessage()`,
   dejando `dbId` en `undefined` para siempre) — corregido asentando
   `dbId: null` en el momento de creación de esos mensajes.
2. **Vinculación cruzada de proyecto en Task**: `captureKnowledge()` no
   validaba que el `taskId` recibido perteneciera al mismo `projectId` —
   un caso hoy inalcanzable desde la UI real (el selector de Task ya
   filtra por proyecto), pero la API en sí no lo impedía, lo que podía
   generar procedencia engañosa. Corregido con una validación explícita
   antes de emitir el evento Tier A.

**Garantía Tier A para Knowledge:** igual que Task — `KnowledgeCaptured`,
`KnowledgePromoted` y `KnowledgeRejected` no tienen ningún sistema externo
de respaldo (a diferencia de GitHub/`agent_jobs` para Development/Execution).
En `captureKnowledge`/`transitionKnowledge`, si `emitEvent()` devuelve
`false` tras sus 3 reintentos, la función lanza antes de tocar
`knowledge_items` — ninguna transición de Knowledge puede quedar como
"mejor esfuerzo".

**Garantías de procedencia:** toda entrada de Knowledge retiene `project_id`
(obligatorio), y opcionalmente `task_id`, `session_id`, `source_message_id`
y `source_event_id` — ninguno de estos cuatro es obligatorio, permitiendo
conocimiento creado a mano sin ningún origen de IA.

**Limitaciones conocidas, aceptadas para este sprint:**
- `GET`/`PATCH /api/knowledge/[id]` no filtran por proyecto — consistente
  con el modelo de seguridad ya existente en todo el hub (sin auth por
  usuario), no es una regresión de Sprint 3.
- Sin extracción automática de conocimiento desde cada mensaje — captura
  siempre explícita, humano-iniciada.
- `KnowledgeSuperseded` (ya ratificado en el canon) no se usa todavía —
  no hace falta hasta que exista una noción de "reemplazar" una entrada
  vieja por una nueva, fuera de alcance de este sprint.

**Sin infraestructura nueva**: cero embeddings, cero vector DB, cero
Graph-RAG — búsqueda por `.eq()` simple de Postgres, igual que Task.
**La promoción de conocimiento sigue siendo 100% humano-controlada** —
el modelo nunca decide por sí solo que algo es verdad canónica; capturar,
promover y rechazar son siempre acciones explícitas del usuario.

## 30. Pendiente de definir en próxima sesión

- PWA instalable (ícono + splash en iPad/iPhone, hoy es solo una pestaña de Safari).
- Editor de código embebido dentro del Code Intake (hoy el "sandbox" es
  Preview Deployment de Vercel + diff review, sin editor inline — decisión
  original de la sección 2, revisar si sigue siendo suficiente con más uso).
- Selector de proyecto/repo con historial de "recientes" (hoy hay que tipear
  o usar "Buscar repos" cada vez, sin recordar el último usado).
- Notificación/feedback visual cuando termina un Preview Deployment de Vercel
  disparado por un commit del hub (hoy hay que ir a chequear a mano).
- Roles personalizados sincronizados vía Supabase en vez de solo localStorage
  (para que viajen entre iPad y PC, igual que el historial de chat).
