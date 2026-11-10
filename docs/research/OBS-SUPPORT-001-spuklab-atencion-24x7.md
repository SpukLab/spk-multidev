# OBS-SUPPORT-001 — Atención y continuidad 24/7 de SpukLab

- **Fecha:** 2026-11-09
- **Estado:** investigación propuesta / decisiones de producto aprobadas en conversación; arquitectura y proveedores pendientes de validación.
- **Titular del servicio:** SpukLab (no el negocio cliente).
- **Prioridad:** P0, requisito previo a escalar comercialmente CITHELA.
- **Alcance inicial:** soporte a clientes de CITHELA, DAHZEA y futuros productos SpukLab.
- **No incluye:** automatizar la relación entre profesionales de CITHELA y sus pacientes, ni entre comercios DAHZEA y compradores de Mercado Libre; esos intercambios pertenecen a cada producto.

## 1. Decisiones preservadas

1. **Recepción de soporte 24/7:** el cliente puede comunicar una incidencia a cualquier hora y obtener constancia trazable **si la solicitud quedó guardada**. No se promete atención humana instantánea 24/7; los horarios de revisión y los compromisos de respuesta deberán publicarse de forma explícita y realista.
2. **El ticket es la fuente de verdad**, no el mensaje de Instagram, WhatsApp, correo ni la respuesta del bot. Un fallo del canal o de la IA no debe borrar un caso admitido.
3. **Automatización graduada:** respuestas deterministas y base de conocimiento aprobada primero; IA limitada y auditable para casos complejos, siempre con posibilidad de derivación. IA no autoriza cambios de permisos, cobros, cuentas ni datos de clientes.
4. **Cierre responsable:** “bot respondió” no equivale a “caso resuelto”. Se exige una condición verificable de solución (confirmación del usuario o procedimiento de validación definido) y registro de la evidencia.
5. **Separación de dominios y permisos:** soporte SpukLab solo dispone de datos estrictamente necesarios; accesos a cada producto por autorización y mínima exposición. Nunca mezclar datos de profesionales/pacientes, compradores/operadores u organizaciones diferentes. Nunca usar el contexto operativo del piloto DAHZEA como conocimiento de soporte público.
6. **Canales alternativos:** la web propia constituye un canal principal de recepción; correo y, tras verificarse políticas/permisos, WhatsApp e Instagram son entradas adicionales. Cada mensaje recibido se vincula a un ticket sin duplicarlo.
7. **Resiliencia:** persistir antes de confirmar, idempotencia ante webhooks repetidos, reintentos controlados, cola de fallidos, monitorización y respaldo/recuperación probada. Ninguna confirmación falsa de recepción.
8. **Eficiencia:** conservar la infraestructura existente si es viable; evitar una instalación pesada de helpdesk o modelos IA funcionando de forma permanente sin evidencia de necesidad. No habilitar servicios pagos ni modificar producción durante la investigación.
9. **Transparencia:** distinguir claramente respuesta automatizada, acuse de recepción, horario de personal y estado del incidente; dejar visible un mecanismo de escalamiento humano. No prometer resolución permanente 24/7.
10. **Orientación al cliente:** una consulta comercial, una solicitud de ayuda y una incidencia crítica siguen recorridos diferentes; no usar el soporte como canal indiscriminado de marketing.

## 2. Contexto existente verificado en repositorios

- `SpukLab/SpukLab-web`: página comercial en Cloudflare, orientador local sin tickets persistentes documentados; `docs/CONTINUIDAD.md` y `docs/DAHZEA_CHAT_PUBLICO.md` prohíben conectar el endpoint operativo de DAHZEA directamente al público. El puente de IA pública está sujeto a aislamiento/controles: no asumir que sirve como helpdesk.
- `SpukLab/spuklab-builds/cithela/docs/selfservice-commercial-onboarding-20261101.md`: alta comercial y cobros seguían pendientes de habilitación en el estado documentado, con actualización de decisiones al 09/11. La asistencia de soporte es un componente adicional, no debe activar el alta comercial sin validar sus bloqueantes.
- `SpukLab/ai-commerce-assistant`: posee patrones reutilizables de conversación, propiedad, escalamiento y entrega confirmada; evaluar y abstraer patrones, **sin acceder a información de Mercado Libre de terceros** ni acoplar el soporte al runtime del negocio.
- Observatory en `spk-multidev`: el contrato propuesto en la rama `docs/forgeworks-observatory-v1-contract` exige identidad estable de investigación, procedencia y evidencia auditable. Esta nota es un *Research Intent* inicial, no afirma que el contrato ni un módulo Observatory estén desplegados.

## 3. Preguntas de investigación

1. ¿Cuál es el mínimo viable para garantizar persistencia verificable, consulta de estado y respuestas deterministas desde una página de ayuda propia?
2. ¿Conviene usar Chatwoot Cloud/API, Freshdesk, soluciones nativas de Meta o un helpdesk mínimo en Cloudflare con almacenamiento duradero? Comparar por operación real, coste total, dependencia, datos, límites, exportación y recuperación.
3. ¿Cómo unificar mensajes de email, web, WhatsApp Business Platform e Instagram sin duplicados ni dependencia del transporte?
4. ¿Qué restricciones oficiales de Meta afectan ventanas de respuesta, permisos de acceso, automatización, handoff humano, tarifas y consentimiento?
5. ¿Qué puede resolverse sin IA? ¿En qué situaciones una respuesta por IA aporta valor verificable y no amplía riesgos de privacidad/costo?
6. ¿Cómo manejar incidentes de autenticación, envío de WhatsApp, disponibilidad de CITHELA o sincronización de DAHZEA con permisos mínimos y sin acciones destructivas?
7. ¿Cómo medir fiabilidad, tiempos de respuesta, pérdidas, errores de reintento y coste por ticket para los primeros 2, 10 y 50 clientes?

## 4. Recorrido objetivo (sin implementación autorizada)

```
WEB / EMAIL / WHATSAPP / INSTAGRAM
             |
  Validar origen y consentimiento aplicable
             |
   Guardar recepción e idempotency key
             |
    Ticket persistido con identificador
             |
       Emitir acuse de recibo
             |
        Clasificar / priorizar
        /                 \
 Respuesta aprobada      Pendiente humano
        \                 /
         Evidencia + seguimiento
                   |
           Resolución validada
                   |
                Cierre
```

El canal entrante **no** debe ser la fuente de verdad. Si la persistencia falla, comunicar el error y proporcionar alternativa, sin inventar ID de ticket. Para correos o eventos asincrónicos, distinguir la recepción en el proveedor de la importación confirmada en el registro central.

### Estados sugeridos para evaluación

`received -> triaging -> (automated | human_pending | awaiting_customer) -> resolved -> closed`

- `received`: almacenado, ticket verificable.
- `automated`: se respondió automáticamente; NO implica resolución.
- `human_pending`: necesita revisión de una persona y tiene responsable/cola.
- `resolved`: solución verificada según el tipo de incidente y evidencia.
- `closed`: cierre administrativo con reapertura disponible.

Definir transiciones y fallos sin permitir cierres automáticos silenciosos.

## 5. P0: requisitos de disponibilidad y seguridad para piloto

- Acuse de recepción únicamente tras commit confirmado del ticket; ID estable visible y trazabilidad de origen.
- Idempotencia por `provider + provider_message_id` o clave propia protegida; un webhook duplicado no crea dos tickets.
- Retención de contenido mínimo, políticas de privacidad, consentimiento, borrado/exportación cuando corresponda, y auditabilidad sin filtrar secretos.
- Autorización por identidad/organización; pruebas de aislamiento entre dos clientes reales de CITHELA y simulaciones de productos distintos.
- Cola de incidencias humanas con prioridad; alertas para errores severos; no depender de que una persona inspeccione constantemente la bandeja.
- Base de respuestas revisadas con versión y actualización; respuestas de IA no deben afirmar estados o transacciones no confirmadas por sistemas autorizados.
- Comprobaciones externas de disponibilidad y plan de comunicación ante caída; la página de estado no puede depender únicamente del sistema al que supervisa.
- Recuperación comprobada de almacenamiento mediante copia/exportación, no solamente disponibilidad de una función de backup.
- Fallback para fallo de IA, API Meta, correo, almacenamiento, monitor y picos de tráfico. Reconocer que una caída simultánea de todos los canales externos no admite garantía absoluta.
- Métricas básicas agregadas sin datos sensibles: tickets recibidos, duplicados evitados, pendientes por antigüedad, entregas confirmadas, errores de persistencia, alertas no atendidas y costo por caso.

## 6. Orden de experimentos propuesto

**Fase 0 — Auditoría sin cambios productivos.** Inventariar infraestructura, credenciales requeridas, dependencias, cuentas Meta disponibles, mail transaccional, límites de costos y soporte actual. Identificar capacidad de contacto real en `SpukLab-web`.

**Fase 1 — Vertical slice de recepción:** prototipo aislado de formulario web -> ticket persistente -> acuse real con ID -> panel mínimo para revisar/contestar y consultar estado. Incluir duplicados, fallas y respaldos antes de conectar redes.

**Fase 2 — Base de conocimientos y fallback:** FAQ verificada CITHELA/DAHZEA, respuesta deterministic-first, escalamiento humano y notificaciones. Probar que falla la IA sin pérdida de solicitudes.

**Fase 3 — Canales adicionales:** evaluar correo, WhatsApp e Instagram por separado. Integraciones solo tras políticas, consentimiento, permisos, costos y ensayos de entrega de extremo a extremo.

**Fase 4 — IA opcional y analítica:** activación controlada si mejora tasas verificables sin fuga de información ni costos desproporcionados.

No activar bot comercial ni cobros en nombre del soporte; no cambiar `main`, Supabase, Render, Cloudflare, Meta ni cuentas productivas sin revisión.

## 7. Matriz mínima de pruebas

| Ensayo | Criterio de aceptación |
|---|---|
| DB caída antes de crear ticket | No se informa recepción confirmada; se ofrece fallback |
| Webhook duplicado o fuera de orden | Un ticket consistente; eventos trazables |
| IA desconectada / timeout | FAQ básica y registro operativos |
| Meta no entrega mensajes | Solicitudes previas persisten; canal alternativo visible |
| Reintentos agotados | Se conserva falla investigable y se alerta; no desaparición silenciosa |
| Dos organizaciones consultan soporte | No se cruzan identidades, historiales ni permisos |
| Consulta sensible o cambio de cuenta | Autenticación reforzada / intervención autorizada |
| Se emite respuesta automática | Estado no pasa a resuelto solo por responder |
| Fallo del monitor o alerta | Verificación independiente/fallback definido |
| Restauración de backup | Recuperación probada sin exposición a otros clientes |

## 8. Benchmark inicial y fuentes oficiales (verificar al ejecutar)

**Candidatos:** Chatwoot Cloud/API, Freshdesk, Meta Business Suite, APIs oficiales de WhatsApp/Instagram, solución mínima con Cloudflare Workers y D1, Cloudflare Queues solo como transporte, no como base maestra. Make/n8n/Manychat: evaluar como automatizadores, **no sustituir** la autoridad del ticket por un workflow.

- Política WhatsApp Business (ventana y escalamiento humano): https://whatsappbusiness.com/policy/
- Chatwoot canales e inboxes: https://www.chatwoot.com/hc/user-guide/articles/1677492191-adding-inboxes
- Chatwoot canal API: https://app.chatwoot.com/hc/user-guide/articles/1677839703-how-to-create-an-api-channel-inbox
- Cloudflare Queues / reintentos: https://developers.cloudflare.com/queues/configuration/batching-retries/
- Cloudflare dead-letter queues: https://developers.cloudflare.com/queues/configuration/dead-letter-queues/
- Cloudflare D1 point-in-time recovery: https://developers.cloudflare.com/d1/reference/time-travel/

**No asumir precios ni cuotas duraderas:** relevar directamente páginas de tarifas y fecha de acceso antes de aprobar compras; los límites de la plataforma cambian. No instalar ningún proveedor en producción por registrar esta investigación.

## 9. Entregables y puertas de decisión

- **E1:** estado real de canales y herramientas existentes, con fuentes, fecha y configuración verificada.
- **E2:** tabla costo / dependencia / funciones / privacidad / resiliencia para 2, 10 y 50 clientes.
- **E3:** contrato funcional mínimo de ticket y escalamiento, con esquemas y política de retención propuestos.
- **E4:** demostración reproducible del slice de recepción y al menos 10 ensayos de fallo, sin datos reales.
- **E5:** decisión `BUILD | INTEGRATE | EXPERIMENT | WAIT` con evidencias, riesgos residuales y aprobación explícita previa a producción.

### Condición de salida

El piloto comercial no debe afirmar “soporte 24/7 garantizado” hasta demostrar **recepción y persistencia 24/7**, canales alternativos, monitoreo y respuesta ante incidentes. La promesa humana deberá expresar horario y tiempos verificables.

---

## Relación con otras investigaciones

- **OBS-SOCIAL-001 — Captación desde redes:** comentarios, mensajes y conversiones hacia la web comercial; separado de la cola de soporte, aunque reutilice conectores autorizados.
- **OBS-LORA-001 — Hardware LoRa/SURKARA:** investigación independiente de comunicaciones offline; no forma parte del alcance P0 de soporte.
- Este Research Intent permanece en estado **PROPOSED** hasta que se vincule con los mecanismos persistentes de Observatory, preservando el contrato Canon-to-Runtime existente.


## 10. Avance verificable del 09/11 — auditoría de web y prototipo aislado

- Auditoría de \`SpukLab/SpukLab-web/main\`: contacto por \`SpukLab@gmail.com\` vía \`mailto:\`, orientador comercial local, puente IA sin persistencia de soporte, sin formulario ni tickets en la web actual. La URL de producción no pudo validarse desde la consulta externa; se trata de evidencia de repositorio.
- La revisión de PR abiertas #21–#24 confirma trabajo paralelo en identidad, piezas comerciales y contratación; **no modificar ni fusionar esas PR por causa de soporte**.
- PR de experimento **SpukLab/SpukLab-web#25**, draft: https://github.com/SpukLab/SpukLab-web/pull/25.
- Prototipo en \`experiments/obs-support-001\`: handler de \`POST /api/support/tickets\`, esquema SQL D1, verificación servidor Turnstile, idempotencia por UUID y HMAC, rechazo sin confirmación ante fallo de base, pruebas unitarias incorporadas a suite de CI.
- **No desplegado ni conectado** al Worker actual, páginas públicas, CRM, servicios de Meta, correo o cuentas operativas.
- Criterios aún bloqueantes: pruebas D1 reales separadas, rate limit, aviso de privacidad y retención, bandeja de operador con autenticación, notificación y alertas, canal alternativo, backup/restore, monitoreo, continuidad.
- No se promete recepción 24/7 verificable ni soporte humano 24/7 hasta validar las condiciones; estado *EXPERIMENT*, no *PILOT*.
