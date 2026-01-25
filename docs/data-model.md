# Data Model — Stylenya Intelligent Project (v1.0)

## 1) Purpose

This document defines the initial **PostgreSQL data model** for the Stylenya Intelligent Project (decision-support system). The data model is designed to:

- Store canonical business entities (Products, Orders, OrderItems),
- Support analytics queries for dashboard KPIs,
- Persist derived outputs (Insights, Recommendation/Decision records),
- Maintain traceability (what was recommended, why, and based on which evidence).

The model follows the Clean Architecture principle: **database structures support the domain** and not the other way around.

---

## 2) Modeling Strategy (Key Decisions)

### 2.1 Canonical vs Raw Ingestion (Pragmatic approach)

We will support ingestion from external exports (Etsy/Shopify CSV). Two strategies exist:

- **Raw-first**: store raw rows, then normalize later.
- **Canonical-first**: map directly into normalized canonical tables.
**Decision (v1 MVP): Hybrid**

- Store minimal metadata about each import (`import_runs`),
- Store canonical entities (`orders`, `order_items`, `products`) as the primary truth,
- Optionally store raw payload for debugging only (future table `import_raw_rows` if needed).

**Why:**

- Keeps MVP fast,
- Avoids complex raw schemas early,
- Still preserves audit via `import_runs` + mapping notes.

---

## 3) Core Entities and Tables (MVP)

### 3.1 `products`

Canonical representation of a Stylenya product (platform-agnostic).
**Columns**

- `id` UUID PK
- `name` TEXT NOT NULL
- `category` TEXT NOT NULL
- `product_type` TEXT NOT NULL
- `is_custom` BOOLEAN NOT NULL DEFAULT false
- `status` TEXT NOT NULL DEFAULT 'ACTIVE'  -- ACTIVE | DISCONTINUED
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()
**Notes**

- `category` and `product_type` can be enums later (Prisma enum / PG enum), but TEXT is fine for v1.
- Products are not bound to Etsy/Shopify IDs; that mapping is done via `product_platform_refs`.
**Indexes**
- `idx_products_category` on (`category`)
- `idx_products_status` on (`status`)

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
- `confidence_score` NUMERIC(3,2) NULL CHECK (confidence_score >= 0 AND confidence_score <= 1)
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
