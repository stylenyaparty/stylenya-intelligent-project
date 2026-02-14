# API Contract — Stylenya Intelligent Project (v1.0)

## 1. Purpose

This document defines the REST API contract for the Stylenya Intelligent Project.  
The API enables data ingestion, KPI computation, insight generation, and traceable decision support for a real e-commerce business.

The API is designed to:

- Separate business logic from presentation (API/Web split),
- Provide deterministic and auditable outputs,
- Support incremental growth without breaking existing consumers.

---

## 2. API Design Principles

### 2.1 Versioning

All endpoints are prefixed with `/api/v1`.  
Breaking changes require a new version.

### 2.2 Deterministic Core

All KPIs and rule-based recommendations must be deterministic given the same inputs and date ranges.  
LLM-assisted text is optional and always labeled as such.

### 2.3 Traceability by Design

Every recommendation must be traceable to:

- The evidence metrics used,
- The business rules applied,
- The time range and context.

---

## 3. Common Concepts

### Platforms

- ETSY
- SHOPIFY

### Insight Types

- TREND
- OPPORTUNITY
- WARNING
- INFO

### Insight Scope

- PRODUCT
- CATEGORY
- THEME
- GLOBAL

### Decision Types

- PRODUCT
- SEO
- CONTENT
- BUNDLE
- PRICING

### Priority Levels

- P0 (critical)
- P1 (important)
- P2 (nice to have)

### Decision Status

- PROPOSED
- ACCEPTED
- REJECTED
- DONE

---

## 4. Error Model

All errors follow a standard structure.

### Error Response Format

- code: short error identifier
- message: human-readable description
- details: optional contextual information

### Common Error Codes

- VALIDATION_ERROR (400)
- NOT_FOUND (404)
- CONFLICT (409)
- INTERNAL_ERROR (500)
- SERVICE_UNAVAILABLE (503)

---

## 5. API Endpoints (MVP)

### 5.1 Health Check

**GET /api/v1/health**
Purpose: verify that the API and its dependencies are running.

Response:

- status
- API version
- current server time
- database connectivity status

---

### 5.2 Imports (Data Ingestion)

#### POST /api/imports/etsy

Purpose: import Etsy orders using a simplified JSON representation (MVP).

Input:

- import metadata (type, filename)
- list of order rows with items

Behavior:

- validates required fields
- maps raw rows to canonical Orders and OrderItems
- stores an import run record
- rejects duplicate external order IDs

Output:

- import run summary
- total records processed
- success/failure counts

Errors:

- VALIDATION_ERROR for malformed payloads
- CONFLICT if duplicate orders are detected
- INTERNAL_ERROR for unexpected failures

---

#### GET /api/imports

Purpose: list previous import executions for audit and debugging.

Supports filtering by:

- platform
- pagination (limit, offset)

---

### 5.3 Products (Catalog)

#### GET /api/products

Purpose: list canonical products.

Supports filtering by query params:

- source (ETSY | SHOPIFY | MANUAL)
- status (ACTIVE | DRAFT | ARCHIVED | REVIEW)
- q (text search on name/product type)
- page (default 1)
- pageSize (default 20, max 100)

Returns:

- products[]
- pagination { page, pageSize, total, totalPages }


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
