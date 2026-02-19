# Modelo de Datos — Stylenya Intelligent Project (Actualizado 2026)

## 1. Propósito

Este documento describe el **modelo de datos actual** del sistema Stylenya Intelligent Project, un DSS (Decision Support System) para e-commerce creativo. El modelo refleja la estructura real de la base de datos y las entidades principales, alineadas con la lógica de negocio y las funcionalidades implementadas.

---

## 2. Estrategia de Modelado

- **Canonical-first**: Las entidades principales (productos, pedidos, decisiones, métricas) se modelan de forma normalizada y agnóstica a la plataforma.
- **Trazabilidad y auditoría**: Todas las decisiones y recomendaciones quedan registradas junto con la evidencia y reglas que las generaron.
- **Extensibilidad**: El modelo permite incorporar nuevas fuentes de datos, reglas y funcionalidades sin romper la estructura base.

---

## 3. Entidades Principales

### Usuario (`User`)
- id (UUID, PK)
- email (único)
- nombre
- rol (enum: ADMIN, USER, etc.)
- isReviewer (bool)
- archivedAt (fecha de archivado)
- passwordHash
- createdAt, updatedAt

### Producto (`Product`)
- id (UUID, PK)
- nombre
- productSource (enum: SHOPIFY, ETSY, etc.)
- productType
- status (enum: ACTIVE, DISCONTINUED, etc.)
- seasonality (enum)
- shopifyProductId, shopifyHandle, etsyListingId (referencias externas)
- importNotes
- archivedAt
- createdAt, updatedAt

#### Relaciones:
- Un producto puede tener muchos registros de ventas (`SalesRecord`)
- Un producto puede estar vinculado a muchas solicitudes (`Request`)

### Registro de Ventas (`SalesRecord`)
- id (UUID, PK)
- productId (FK → Product)
- salesPeriod (enum: D7, D30, D90, etc.)
- unitsSold
- revenueAmount
- asOfDate
- createdAt

### Solicitud de Producto (`Request`)
- id (UUID, PK)
- channel (enum)
- theme
- productType
- status (enum)
- productId (FK → Product)
- createdAt

### Configuración (`Settings`)
- id (PK)
- boostSalesThresholdD90, retireSalesThresholdD180, requestThemePriorityThreshold
- defaultCurrency
- googleAdsEnabled y credenciales asociadas
- updatedAt

### Decisión (`Decision`)
- id (UUID, PK)
- status (enum: PLANNED, etc.)
- actionType
- targetType, targetId
- dedupeKey (único)
- title, rationale, priorityScore, sources
- promotedDraft (relación con DecisionDraft)
- createdAt, updatedAt

### Registro de Decisiones (`DecisionLog`)
- id (UUID, PK)
- weekStart (fecha)
- engineVersion
- itemsJson (snapshot de items)
- createdAt

### Palabra Clave (`KeywordSeed`)
- id (UUID, PK)
- term (único)
- source, kind, status (enums)
- tagsJson
- createdAt, updatedAt

### Definición de Tipo de Producto (`ProductTypeDefinition`)
- id (UUID, PK)
- key (único)
- label, synonymsJson, required, status, tagsJson
- createdAt, updatedAt

### Señales y Métricas (`SignalBatch`, `KeywordSignal`)
- SignalBatch: agrupa cargas de señales externas (ej. keywords)
- KeywordSignal: señal individual, vinculada a un batch

---

## 4. Relaciones y Trazabilidad

- Un producto puede tener múltiples registros de ventas y solicitudes.
- Las decisiones pueden estar vinculadas a borradores promovidos y a evidencia/rastros de reglas.
- Todas las acciones relevantes quedan auditadas con fecha y usuario.

---

## 5. Índices y Reglas de Integridad

- Índices en campos de búsqueda frecuente (fechas, status, referencias externas).
- Unicidad en claves externas y dedupeKey para evitar duplicados.
- Integridad referencial entre entidades principales.

---

## 6. Extensiones y Futuras Tablas

- Temas (`themes`) y relación producto-tema.
- Snapshots de KPIs precomputados.
- Items de contenido para SEO/blog.

---

## 7. Alineación con la Lógica de Negocio

- El modelo soporta reglas como: productos agnósticos de plataforma, pedidos inmutables, decisiones trazables y configuraciones editables.
- Permite la evolución del sistema sin migraciones disruptivas.

---

---

### 3.2 `product_platform_refs`

Maps canonical products to platform identifiers.
**Columns**

- `id` UUID PK
- `product_id` UUID FK → products(id) ON DELETE CASCADE
- `platform` TEXT NOT NULL  -- ETSY | SHOPIFY
- `external_product_id` TEXT NOT NULL
- `external_variant_id` TEXT NULL
- `external_sku` TEXT NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
**Constraints**
- Unique mapping per platform + external IDs:
  - `UNIQUE(platform, external_product_id, COALESCE(external_variant_id, ''))`
**Indexes**
- `idx_platform_refs_product_id` on (`product_id`)
- `idx_platform_refs_platform_ext` on (`platform`, `external_product_id`)

---

### 3.3 `orders`

Historical order facts (immutable once saved).
**Columns**

- `id` UUID PK
- `platform` TEXT NOT NULL  -- ETSY | SHOPIFY
- `external_order_id` TEXT NULL  -- from platform export if available
- `order_date` TIMESTAMPTZ NOT NULL
- `total_amount` NUMERIC(12,2) NOT NULL DEFAULT 0
- `currency` TEXT NOT NULL DEFAULT 'USD'
- `country` TEXT NULL
- `import_run_id` UUID NULL FK → import_runs(id) ON DELETE SET NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
**Constraints**
- Optional uniqueness when `external_order_id` exists:
  - `UNIQUE(platform, external_order_id)` (can be partial index if nulls are common)
**Indexes**
- `idx_orders_order_date` on (`order_date`)
- `idx_orders_platform_date` on (`platform`, `order_date`)

---

### 3.4 `order_items`

Line items within an order.
**Columns**

- `id` UUID PK
- `order_id` UUID NOT NULL FK → orders(id) ON DELETE CASCADE
- `product_id` UUID NULL FK → products(id) ON DELETE SET NULL
- `raw_item_name` TEXT NULL  -- fallback when mapping is unknown
- `quantity` INT NOT NULL CHECK (quantity > 0)
- `unit_price` NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0)
- `customization_type` TEXT NULL -- e.g., NAME, AGE, PHOTO, COLOR, OTHER
- `notes` TEXT NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
**Notes**
- `product_id` nullable supports BR-06 (unmapped products allowed).
- `raw_item_name` helps later mapping improvement.
**Indexes**
- `idx_order_items_order_id` on (`order_id`)
- `idx_order_items_product_id` on (`product_id`)

---

## 4) Derived Outputs (Insights + Decision Records)

### 4.1 `insights`

Human-readable analysis outputs derived from deterministic logic (and optionally enhanced by LLM).
**Columns**

- `id` UUID PK
- `type` TEXT NOT NULL  -- TREND | OPPORTUNITY | WARNING | INFO
- `title` TEXT NOT NULL
- `message` TEXT NOT NULL
- `scope` TEXT NOT NULL  -- PRODUCT | CATEGORY | THEME | GLOBAL
- `target_ref_id` TEXT NULL  -- product_id (UUID as text) or category/theme name
- `confidence_score` NUMERIC(3,2) NULL CHECK (confidence_score >= 0 AND confidence_score &lt;= 1)
- `period_start` DATE NOT NULL
- `period_end` DATE NOT NULL
- `generated_by` TEXT NOT NULL DEFAULT 'RULES' -- RULES | LLM | HYBRID
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
**Indexes**
- `idx_insights_created_at` on (`created_at`)
- `idx_insights_scope_target` on (`scope`, `target_ref_id`)

---

### 4.2 `decision_records`

A structured audit trail of recommendations/actions proposed by the system.

**Why this exists**
Insights are descriptive; **decisions** are prescriptive. This table supports traceability for the TFM:

- What was recommended
- When
- With what priority
- Based on what evidence
- Under which rule version
**Columns**
- `id` UUID PK
- `decision_type` TEXT NOT NULL -- PRODUCT | SEO | CONTENT | BUNDLE | PRICING
- `title` TEXT NOT NULL
- `summary` TEXT NOT NULL
- `priority` TEXT NOT NULL DEFAULT 'P1' -- P0 | P1 | P2
- `status` TEXT NOT NULL DEFAULT 'PROPOSED' -- PROPOSED | ACCEPTED | REJECTED | DONE
- `target_ref` JSONB NULL -- flexible target reference (product/category/theme/content)
- `rule_version` TEXT NULL
- `generated_by` TEXT NOT NULL DEFAULT 'RULES' -- RULES | LLM | HYBRID
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
**Indexes**
- `idx_decisions_priority_status` on (`priority`, `status`)
- `idx_decisions_created_at` on (`created_at`)

---

### 4.3 `decision_evidence`

Links a decision record to computed evidence metrics (traceability).
**Columns**

- `id` UUID PK
- `decision_id` UUID NOT NULL FK → decision_records(id) ON DELETE CASCADE
- `metric` TEXT NOT NULL -- revenue, units_sold, delta_pct, etc.
- `value` NUMERIC(14,4) NOT NULL
- `context` JSONB NULL -- additional context (platform, category, etc.)
- `period_start` DATE NOT NULL
- `period_end` DATE NOT NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
**Indexes**
- `idx_decision_evidence_decision` on (`decision_id`)
- `idx_decision_evidence_metric` on (`metric`)

---

### 4.4 `decision_rule_trace`

Records which rules contributed to a decision.
**Columns**

- `id` UUID PK
- `decision_id` UUID NOT NULL FK → decision_records(id) ON DELETE CASCADE
- `rule_id` TEXT NOT NULL  -- BR-01, BR-02, etc.
- `rule_name` TEXT NOT NULL
- `rule_result` TEXT NOT NULL -- APPLIED | SKIPPED | FAILED
- `details` JSONB NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
**Indexes**
- `idx_rule_trace_decision` on (`decision_id`)
- `idx_rule_trace_rule_id` on (`rule_id`)

---

## 5) Import Tracking (Operational)

### 5.1 `import_runs`

Tracks each import execution (Etsy export ingestion, Shopify export ingestion).
**Columns**

- `id` UUID PK
- `platform` TEXT NOT NULL -- ETSY | SHOPIFY
- `import_type` TEXT NOT NULL -- CSV_EXPORT | API_SYNC | MANUAL
- `file_name` TEXT NULL
- `status` TEXT NOT NULL DEFAULT 'SUCCESS' -- SUCCESS | PARTIAL | FAILED
- `started_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `finished_at` TIMESTAMPTZ NULL
- `records_total` INT NULL
- `records_inserted` INT NULL
- `records_failed` INT NULL
- `notes` TEXT NULL
**Indexes**
- `idx_import_runs_platform_time` on (`platform`, `started_at`)

---

## 6) Optional / vNext Tables (Not required for MVP, but planned)

### 6.1 `themes` + `product_themes`

If theme intelligence becomes central, add:

- `themes(id, name, status, tags)`
- `product_themes(product_id, theme_id)`

### 6.2 `kpi_snapshots`

If performance becomes heavy to compute on-demand:

- store precomputed KPIs per product/category per period.

### 6.3 `content_items`

For SEO/blog workflows:

- `content_items(id, type, title, target_keywords, status, published_date)`

---

## 7) Relationships Summary

- `products` 1..* `product_platform_refs`
- `orders` 1..* `order_items`
- `products` 0..* `order_items` (nullable mapping)
- `import_runs` 1..* `orders`
- `decision_records` 1..* `decision_evidence`
- `decision_records` 1..* `decision_rule_trace`

---

## 8) Data Integrity and Business Rules Alignment

This data model supports the domain rules:

- BR-01 (Orders immutable): no update flows; corrections happen via new records or future adjustment tables.
- BR-02 (Product platform-agnostic): mapping is separated (`product_platform_refs`).
- BR-03 (Reproducible KPIs): metrics are derived from immutable facts + deterministic rules.
- BR-04 (Configurable thresholds): thresholds are stored in config (future `settings` table) not hard-coded.
- BR-05 (Rationale required): decision tables store evidence and rule trace explicitly.
- BR-06 (Unmapped products allowed): `order_items.product_id` is nullable.

---

## 9) Indexing Strategy (Performance Notes)

Primary dashboard queries typically filter by:

- date range (`orders.order_date`)
- platform (`orders.platform`)
- category (`products.category`)
- product (`order_items.product_id`)

Recommended indexes already included:

- orders by date and platform+date
- order_items by order_id and product_id
- products by category/status
- insights by scope/target and created_at
- decisions by priority/status/created_at

---

## 10) Next Steps (Implementation Alignment)

After this document:

1. Create Prisma schema matching these tables (API infrastructure/db).
2. Implement repositories for Products and Orders (infrastructure layer).
3. Implement first use case:
   - AnalyzeProductPerformanceUseCase
4. Expose endpoints:
   - GET /kpis (date range)
   - GET /recommendations (decisions)
   - POST /imports/etsy (CSV ingestion)

This completes the first MVP vertical slice: import → KPIs → insights → dashboard.
