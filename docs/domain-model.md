# Stylenya Intelligent Project — Domain Model (v1.0)

## 1) Purpose of the Domain

This project is a **decision-support system** for Stylenya (real e-commerce business).  
It is **not** a store-front and it is **not** a CRM. Its mission is to consolidate historical business data and produce actionable insights to improve product strategy and operations.

### Core goals

- Consolidate sales activity from different sources (Etsy, Shopify).
- Understand product performance over time.
- Detect patterns: trends, seasonality, best sellers, slow movers.
- Generate recommendations (human-readable insights) supported by business rules and (later) LLM assistance.
- Provide a dashboard-oriented experience focused on **analysis and decision-making**.

---

## 2) Domain Boundaries (What the system is / is not)

### In scope

- Products and their classification (category/type).
- Orders and sold items (historical facts).
- Aggregations and indicators (KPIs).
- Insights and recommendations (decision outputs).
- “Designer workflow” signals (what’s next, candidate themes, priorities).

### Out of scope (explicit anti-features)

- Payment processing.
- Checkout/cart/shipping flows.
- Customer messaging automation (CRM).
- Inventory real-time tracking (Phase 2+ only, if ever).
- Alerts/notifications (we keep it dashboard-first).

---

## 3) Ubiquitous Language (Glossary)

A shared vocabulary to prevent ambiguity.

- **Product**: A sellable offering from Stylenya (independent of platform).
- **Platform**: The channel where a transaction occurred (ETSY, SHOPIFY).
- **Order**: A purchase event (historical record).
- **OrderItem**: A product line inside an order (quantity + price).
- **Category**: High-level grouping (Banners, Cake Toppers, Stickers, Stirrers, etc.).
- **Theme**: A motif / party concept (Unicorn, Dino, Minnie-like, etc.).
- **Customization**: Personalization signals (name, age, photo, color, etc.).
- **Insight**: A human-readable conclusion derived from analysis.
- **Recommendation**: Suggested action (boost, redesign, retire, create).
- **KPI**: Metric used to evaluate performance.

---

## 4) Domain Entities (Core)

Entities have identity and lifecycle.

### 4.1 Product

Represents a Stylenya product in a platform-agnostic manner.

**Why it matters**
Products are the main driver of decisions: what to promote, iterate, or discontinue.
**Key attributes (v1)**

- `id` (UUID)
- `name`
- `category` (Category)
- `productType` (ProductType)
- `platformRefs` (mapping to Etsy/Shopify identifiers)
- `isCustom` (boolean)
- `status` (ACTIVE | DISCONTINUED)
- `createdAt`
**Rules**

- A Product can exist without being currently active (DISCONTINUED).
- A Product can map to multiple platform references (same concept sold in different platforms).

---

### 4.2 Order

Represents a historical purchase event.
**Key attributes (v1)**

- `id` (UUID)
- `platform` (ETSY | SHOPIFY)
- `orderDate`
- `totalAmount` (Money)
- `currency`
- `country` (optional)
- `items` (OrderItem[])
**Rules**

- Orders are immutable once stored (historical fact).
- Order totals must match the sum of OrderItem totals (+ optional adjustments later).

---

### 4.3 OrderItem

Represents a single product line within an order.
**Key attributes (v1)**

- `id` (UUID)
- `orderId`
- `productId`
- `quantity`
- `unitPrice` (Money)
- `customizationType` (CustomizationType, optional)
- `notes` (optional)
**Rules**
- `quantity > 0`
- `unitPrice >= 0`
- OrderItem must reference an existing Product (or a temporary “UnmappedProduct” state during ingestion, to be resolved later).

---

### 4.4 Theme (Optional v1, recommended for TFM clarity)

Represents a conceptual theme used in designs.
**Key attributes**

- `id`
- `name` (e.g., “Unicorn Pastel”)
- `tags` (keywords)
- `status` (ACTIVE | EXPERIMENTAL | RETIRED)
**Rules**

- Themes can be inferred from products (keywords) in early phases.
- Later, they can be curated by the designer/admin.

---

### 4.5 Insight

Represents an analysis output that is consumable by humans.
**Key attributes (v1)**

- `id`
- `type` (TREND | OPPORTUNITY | WARNING | INFO)
- `title`
- `message`
- `scope` (PRODUCT | CATEGORY | THEME | GLOBAL)
- `targetRefId` (the product/category/theme it relates to)
- `confidenceScore` (0..1)
- `generatedAt`
- `period` (date range)
**Rules**

- Insights are derived, not manually entered (except curated notes in later phases).
- ConfidenceScore is optional in v1 but recommended for TFM rigor.

---

## 5) Value Objects (Supporting Concepts)

### 5.1 Money

- `amount`
- `currency`
Rules: `amount >= 0`

### 5.2 DateRange

- `start`
- `end`
Rules: `start &lt;= end`

### 5.3 KPI Snapshot (read model)

A computed representation:

- revenue
- units sold
- avg order value
- repeat rate (optional)
- trend delta %

This is not necessarily stored as a domain entity in v1, but can be computed per request.

---

## 6) Domain Services (Pure business logic)

Domain services encapsulate rules that don’t belong to a single entity.

### 6.1 PerformanceAnalyzer

Computes performance KPIs for products/categories/themes.

Responsibilities:

- Aggregate orders and order items for a time window.
- Produce metrics per product/category/theme.
- Provide comparable deltas between two periods.

### 6.2 InsightGenerator

Transforms metrics into human-readable insights using business rules.

Responsibilities:

- Identify anomalies (spikes, drops).
- Detect consistent growth/decline.
- Generate prioritized recommendations.

---

## 7) Ports (Interfaces required by the Domain)

Clean Architecture: domain depends on abstractions only.

### 7.1 ProductRepository (Port)

- `findAll()`
- `findById(id)`
- `findByCategory(category)`
- `upsert(product)` (for ingestion sync)

### 7.2 OrderRepository (Port)

- `findByDateRange(range)`
- `saveBatch(orders)` (ingestion)

### 7.3 InsightRepository (Port)

- `saveBatch(insights)`
- `findLatest(limit)`
- `findByScope(scope, targetRefId)`

### 7.4 Clock (Port)

- `now()`
Used to make time deterministic and testable.

---

## 8) Use Cases (Application Layer)

Use cases orchestrate domain logic and coordinate repositories.

### 8.1 IngestPlatformOrdersUseCase

**Goal**: Import raw orders from Etsy/Shopify into canonical domain model.

High-level flow:

1. Fetch raw data from a gateway (platform integration).
2. Map raw records to `Order` + `OrderItem`.
3. Resolve product references or create placeholders.
4. Save to repository in batch.
**Value**

- Foundation for everything else.
- Converts external noise into clean domain facts.

---

### 8.2 AnalyzeProductPerformanceUseCase (Core MVP)

**Goal**: Produce KPIs per product for a period and compare to previous.
Inputs:

- dateRange
- optional filters (category, platform)

Outputs:

- list of KPI snapshots (ranked)
**Value**
- Enables the first real dashboard screen.
- Provides measurable decision support.

---

### 8.3 GenerateInsightsUseCase

**Goal**: Turn KPI results into actionable insights.
Inputs:

- KPI snapshots
- business thresholds (config)

Outputs:

- list of Insight (prioritized)
**Value**

- Converts “numbers” into “decisions”.
- Ideal for TFM narrative: rule-based + LLM-assisted layer later.

---

### 8.4 WhatToBuildNextUseCase (Strategic)

**Goal**: Recommend themes/categories/products to prioritize next.

Inputs:

- recent sales metrics
- seasonality signals
- catalog gaps

Outputs:

- recommendations list with rationale
**Value**

- This becomes “News from the Designer” (dashboard module).

---

## 9) Initial Business Rules (v1)

These are the first explicit rules that the system will enforce.

### BR-01 — Historical Orders are immutable

Once imported and stored, an Order is never edited.  
Corrections happen via append-only adjustments (future), not overwrites.

### BR-02 — Product identity is platform-agnostic

A Product exists independently of Etsy/Shopify IDs.  
Platform IDs are references, not the identity.

### BR-03 — KPI computation must be reproducible

Given the same data and date range, results must be identical.  
(Important for academic evaluation and testing.)

### BR-04 — Insight thresholds are configurable

Trend thresholds (e.g., +20% growth) must not be hard-coded.  
They belong in configuration.

### BR-05 — Recommend actions with rationale

Every recommendation must include a reason:

- metric evidence (delta, volume, revenue)
- time range
- confidence indicator

### BR-06 — “Unmapped products” are allowed during ingestion

If a sold item cannot be mapped to a Product, it enters a temporary state to avoid data loss.

---

## 10) Conceptual Diagram (Mermaid)

```mermaid
classDiagram
  class Product {
    +UUID id
    +string name
    +Category category
    +ProductType productType
    +bool isCustom
    +Status status
  }

  class Order {
    +UUID id
    +Platform platform
    +Date orderDate
    +Money totalAmount
  }

  class OrderItem {
    +UUID id
    +UUID orderId
    +UUID productId
    +int quantity
    +Money unitPrice
  }

  class Insight {
    +UUID id
    +InsightType type
    +string title
    +string message
    +float confidenceScore
    +Date generatedAt
  }

  Order "1" --> "many" OrderItem
  Product "1" --> "many" OrderItem
  Insight --> Product : (scope=PRODUCT)
