
# Especificación de API — Stylenya Intelligent Project (Actualizado 2026)

## 1. Propósito

Este documento define la especificación REST de la API para Stylenya Intelligent Project, alineada con la implementación real y las funcionalidades actuales. Incluye la lista de endpoints, DTOs de request/response y consideraciones de seguridad.

---

## 2. Principios de Diseño

- Versionado: todos los endpoints están bajo `/api/v1`.
- Respuestas deterministas y auditables.
- Trazabilidad total de decisiones y acciones.
- Autenticación JWT obligatoria (excepto login y registro reviewer).

---

## 3. Estructura General de Endpoints

### Autenticación
- `POST /api/v1/login` — Login de usuario (email, password)
- `POST /api/v1/reviewer/signup` — Alta temporal de reviewer (modo evaluación)
- `POST /api/v1/reviewer/end` — Finalizar sesión reviewer

### Productos
- `GET /api/v1/products` — Listar productos (filtros: source, status, búsqueda, paginación)
- `POST /api/v1/products` — Crear producto
- `PATCH /api/v1/products/:id` — Modificar producto
- `POST /api/v1/products/:id/archive` — Archivar producto
- `POST /api/v1/products/:id/restore` — Restaurar producto archivado
- `DELETE /api/v1/products/:id` — Eliminar producto (requiere confirmación)
- `POST /api/v1/products/import-csv` — Importar catálogo (Shopify/Etsy, CSV)

### Señales y Keywords
- `POST /api/v1/signals/upload` — Subir CSV de señales externas (Google Keyword Planner)
- `GET /api/v1/signals/batches` — Listar lotes de señales importadas
- `GET /api/v1/signals` — Listar señales (filtros: batch, source, búsqueda, orden, paginación)

### Keywords y Jobs
- `GET /api/v1/keyword-seeds/count` — Contar seeds activas
- `POST /api/v1/keywords/seeds` — Crear seeds
- `GET /api/v1/keywords/seeds` — Listar seeds (filtro por estado)
- `PATCH /api/v1/keywords/seeds/:id` — Actualizar estado de seed
- `POST /api/v1/keywords/jobs` — Crear job de keywords
- `GET /api/v1/keywords/jobs` — Listar jobs
- `GET /api/v1/keywords/jobs/:id` — Detalle de job
- `POST /api/v1/keywords/jobs/:id/promote` — Promover señal
- `POST /api/v1/keywords/jobs/:id/archive` — Archivar job
- `POST /api/v1/keywords/jobs/:id/restore` — Restaurar job

### Decisiones y Borradores
- `GET /api/v1/decision-drafts` — Listar borradores de decisión (filtros: fecha, estado)
- `POST /api/v1/decision-drafts/generate` — Generar borradores (IA)
- `POST /api/v1/decision-drafts/:id/dismiss` — Descartar borrador
- `POST /api/v1/decision-drafts/:id/promote` — Promover borrador a decisión

### Decisiones
- `GET /api/v1/decisions` — Listar decisiones (filtros: tipo, prioridad, estado, paginación)
- `GET /api/v1/decisions/:id` — Detalle de decisión (incluye evidencia y reglas)

### Métricas y Dashboard
- `GET /api/v1/dashboard/kpis` — KPIs principales del sistema
- `GET /api/v1/kpis/products` — Métricas de productos (parámetros: fecha inicio/fin, plataforma, categoría)

### SEO y Contexto
- `GET /api/v1/seo-focus` — Decisiones SEO recientes (parámetros: días, incluir ejecutadas)
- `GET /api/v1/settings/seo-context` — Listar seeds de contexto SEO
- `POST /api/v1/settings/seo-context/seeds` — Crear seed de contexto SEO
- `PATCH /api/v1/settings/seo-context/seeds/:id` — Actualizar seed de contexto SEO

### Tipos de Producto y Configuración
- `GET /api/v1/settings/product-types` — Listar tipos de producto
- `POST /api/v1/settings/product-types` — Crear tipo de producto
- `PATCH /api/v1/settings/product-types/:id` — Modificar tipo de producto
- `GET /api/v1/settings/keyword-providers` — Estado de proveedores de keywords
- `POST /api/v1/settings/google-ads` — Configuración de Google Ads

### LLM (IA)
- `GET /api/v1/llm/status` — Estado del proveedor LLM
- `POST /api/v1/llm/sandbox` — Generar borradores sandbox (IA, pruebas)

### Weekly Focus
- `GET /api/v1/weekly-focus` — Resumen de enfoque semanal

---

## 4. Estructura de DTOs (Request/Response)

### Ejemplo de respuesta estándar:
```json
{
	"ok": true,
	"data": { ... },
	"error": null
}
```
En caso de error:
```json
{
	"ok": false,
	"error": {
		"code": "VALIDATION_ERROR",
		"message": "El campo X es obligatorio",
		"details": {}
	}
}
```

### Ejemplo DTO Producto (GET /products):
```json
{
	"ok": true,
	"products": [
		{
			"id": "uuid",
			"name": "Nombre",
			"productSource": "SHOPIFY",
			"productType": "Camiseta",
			"status": "ACTIVE",
			"seasonality": "NONE",
			"createdAt": "2026-02-19T12:00:00Z",
			...
		}
	],
	"pagination": { "page": 1, "pageSize": 20, "total": 100, "totalPages": 5 }
}
```

### Ejemplo DTO Decisión (GET /decisions/:id):
```json
{
	"ok": true,
	"decision": {
		"id": "uuid",
		"title": "Recomendar producto X",
		"status": "PLANNED",
		"priorityScore": 90,
		"targetType": "PRODUCT",
		"targetId": "uuid-producto",
		"rationale": "Basado en señales de demanda y ventas recientes",
		"sources": [ ... ],
		"createdAt": "2026-02-19T12:00:00Z",
		...
	},
	"evidence": [ ... ],
	"rules": [ ... ]
}
```

---

## 5. Consideraciones de Seguridad

- Autenticación JWT obligatoria en todos los endpoints salvo login y reviewer.
- Los datos sensibles (tokens, credenciales) nunca se exponen en respuestas.
- Los errores de validación y negocio devuelven códigos y mensajes claros.

---

## 6. Notas de Implementación

- Todos los endpoints devuelven `ok: true/false` y estructura consistente.
- Los filtros y paginación siguen el estándar: `?page=1&pageSize=20`.
- Los DTOs pueden extenderse según necesidades del frontend.

---

## 7. Relación con la Arquitectura

La API refleja la separación de capas (dominio, aplicación, infraestructura) y soporta el ciclo completo: ingestión → señales/keywords → IA → decisiones → dashboard.

---


#### POST /api/products/import-csv

Purpose: import marketplace catalogs (Shopify/Etsy) and return a compact summary.

Response schema:

- source (SHOPIFY | ETSY)
- status (SUCCESS | PARTIAL | FAILED)
- created
- updated
- skipped
- skippedVariants
- forReview
- message

---

#### POST /api/products

Purpose: create or update a canonical product (admin / ingestion support).

Behavior:

- validates mandatory fields
- upserts product by name/category combination
- returns product identifier

---

### 5.4 KPIs (Dashboard Metrics)

#### GET /api/kpis/products

Purpose: compute product performance metrics for a given date range.

Required parameters:

- start (YYYY-MM-DD)
- end (YYYY-MM-DD)

Optional parameters:

- platform
- category

Returned metrics include:

- units sold
- total revenue
- average unit price
- number of orders
- percentage delta vs previous equivalent period

Notes:

- the comparison period is computed automatically
- results are deterministic

---

### 5.5 Insights

#### GET /api/insights

Purpose: retrieve generated insights.

Supports filtering by:

- type
- scope
- target reference
- pagination

Each insight includes:

- title
- explanatory message
- scope and target
- confidence score (if available)
- generation source (RULES / LLM / HYBRID)
- applicable time range

---

### 5.6 Decisions (Recommendations)

#### GET /api/decisions

Purpose: list decision records (recommended actions).

Supports filtering by:

- decision type
- priority
- status
- pagination

Each decision includes:

- title and summary
- priority
- current status
- target reference
- rule version
- generation source
- creation timestamp

---

#### GET /api/decisions/{id}

Purpose: retrieve a single decision with full traceability.

Returns:

- decision details
- associated evidence metrics
- business rules applied and their outcomes

Errors:

- NOT_FOUND if the decision does not exist

---

## 6. Security Considerations (MVP)

- The API assumes trusted usage in early stages.
- Authentication and authorization are deferred to later versions.
- Sensitive configuration is stored in environment variables.
- No secrets are committed to the repository.

---

## 7. Relationship to System Architecture

This API contract directly reflects:

- the use cases defined in the domain model,
- the clean separation between domain, application, and infrastructure layers,
- the decision-support nature of the system.

The API is intentionally minimal to support a single vertical slice:
import → KPIs → insights → decisions → dashboard.

---

## 8. Next Steps

With this contract defined, the next implementation steps are:

1. Create the Prisma schema matching the data model.
2. Implement repository adapters for Products and Orders.
3. Implement core use cases (AnalyzeProductPerformance, GenerateInsights).
4. Bootstrap Fastify and expose the health endpoint.
5. Connect the Web dashboard to the KPI and decision endpoints.

This completes the contract-first phase of the system.
