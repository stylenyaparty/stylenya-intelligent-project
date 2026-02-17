# DOCS POLICY — Stylenya Intelligence Dashboard (TFM)

## Propósito
Este repositorio contiene documentación técnica y académica (TFM). La documentación debe mantenerse alineada con el código, sin alterar el significado del dominio ni las decisiones arquitectónicas aprobadas.

## Idioma y tono
- Idioma por defecto: **español**.
- Tono: claro, directo y tecnico.
- Evitar marketing y lenguaje ambiguo.

## Fuente de verdad
- El **código** define el comportamiento real.
- La documentación describe ese comportamiento y su justificación.
- No se deben inventar funcionalidades, endpoints o tablas no presentes en el repositorio.

## Elementos “no negociables” (NO reescribir)
Estos conceptos no deben ser reinterpretados ni reemplazados por sinónimos:
- El sistema es un **DSS** (Decision Support System).
- La IA es **asistencial**, **no decisoria** y **no ejecutora**.
- Flujo operativo: **Signals → Decision Drafts → Decisions (Decision Log) → SEO Focus**.
- **Trazabilidad**: toda decisión debe poder justificarse (señales/drafts/inputs).
- **Human-in-the-loop**: solo el usuario promueve, cancela, cambia estados.

## Qué está permitido actualizar
- Rutas/endpoints y ejemplos de request/response para coincidir con el código.
- Variables de entorno y configuraciones (env vars).
- Pasos de instalación, comandos, scripts y troubleshooting.
- Nombres de pantallas/labels UI, capturas, referencias a archivos.
- Diagramas/explicaciones cuando el código cambió y hay evidencia clara.

## Qué NO está permitido actualizar
- Definiciones de dominio, invariantes, reglas de negocio consolidadas.
- Decisiones arquitectónicas ya justificadas (p. ej., IA asistencial, trazabilidad, bounded context).
- Cambiar alcance del producto (“ahora también hace X”) sin implementación real.
- Cambiar el significado de estados (NEW/PROMOTED/DISMISSED, PLANNED/EXECUTED/MEASURED/CANCELLED).

## Reglas de seguridad
- No introducir ni exponer secretos (API keys, tokens, DATABASE_URL).
- No incluir valores reales de env vars; solo nombres y placeholders.
- No copiar logs con credenciales.

## En caso de duda
Si un cambio no está respaldado por evidencia en el repo:
- Proponerlo como comentario en el PR (no como cambio directo en docs),
- o dejar el contenido intacto.
