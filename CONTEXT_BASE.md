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

## 23. Pendiente de definir en próxima sesión

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
