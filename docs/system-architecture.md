# System Architecture — Stylenya Intelligent Project (TFM)

## 1. Purpose and Scope

This document defines the system architecture for **Stylenya Intelligent Project**, a decision-support platform for a real e-commerce business (Stylenya). The system integrates:

- **Historical sales signals** (Etsy exports / Shopify orders),
- **Shopify catalog structure** (products/variants/tags),
- **Business rules** (pricing, production capacity, turnaround constraints),
- And optional **LLM-assisted insights** (summaries, prioritization, recommendations).

The architecture is designed to be:

- **Maintainable** (Clean Architecture),
- **Auditable** (business rules are deterministic and traceable),
- **Extensible** (LLM is optional and cannot break core logic),
- **Deployable** (Docker + Postgres; API/Web as separate apps).

This architecture supports the TFM requirement of clear engineering decisions, traceability, and real-world applicability.

---

## 2. High-Level Architecture Overview

The system is composed of two main applications:

- **API App (Backend)**: exposes business capabilities via HTTP endpoints (REST).
- **Web App (Frontend)**: provides the dashboard UI for decision-making, reporting, and workflows.

A PostgreSQL database stores:

- Imported datasets (orders, products, customers if needed),
- Domain entities and rule outputs,
- Derived metrics and “decision records” (what the system recommended and why).

### Component Summary

- **apps/api**  
  - Implements use cases and exposes HTTP endpoints.
  - Owns domain rules execution (deterministic).
  - Calls LLM gateway optionally (non-deterministic insights).

- **apps/web**  
  - Dashboard UI and workflows.
  - Consumes API endpoints.
  - No business logic beyond presentation & UX rules.

- **PostgreSQL (Docker)**  
  - Single source of truth for structured data.

- **LLM Provider (Optional)**  
  - Used for summarization, explanation, “insight narratives”.
  - Never becomes a dependency for correctness.

---

## 3. Clean Architecture Mapping to Repository Structure

The repository structure follows a Clean Architecture approach:

### 3.1 Layers

**Domain Layer (`apps/api/src/domain`)**  
Contains enterprise-level business concepts:

- Entities (core objects of the business)
- Value objects / enums
- Domain services (pure business logic)
- Ports (interfaces that define dependencies outward)

**Application Layer (`apps/api/src/application`)**  
Contains system-level orchestration:

- Use cases (interactors) that coordinate domain operations
- DTOs (input/output models for use cases)
- Mappers (convert between DTOs and domain objects)

**Infrastructure Layer (`apps/api/src/infrastructure`)**  
Contains external integrations and technical implementations:

- DB (Postgres adapters)
- Repositories (implement domain ports)
- Gateways (e.g., LLM adapter, Shopify/Etsy import adapters)

**Interfaces Layer (`apps/api/src/interfaces/http`)**  
Contains the HTTP delivery mechanism:

- Controllers / routes
- Request validation
- Authentication hooks (future)
- Response formatting

### 3.2 Why this structure matters (TFM justification)

This separation ensures:

- Domain rules are **testable** without HTTP/DB.
- External services (LLM, imports) can be changed without altering business logic.
- The system remains **auditable**: recommendations can be traced to deterministic rule outputs.

---

## 4. Data Flow and Processing Pipelines

### 4.1 Primary Flow (Decision Support)

1. User opens the Web dashboard.
2. Web calls API endpoint(s) for:
   - KPIs,
   - Recommendations,
   - Work queues (e.g., “what to prepare next”),
   - Rule-based alerts (not push alerts; dashboard signals).
3. API executes use cases:
   - Loads relevant data (repositories),
   - Runs deterministic business rules (domain services),
   - Stores decision outputs when appropriate (decision records).
4. API optionally calls LLM gateway to generate:
   - Explanations (human readable),
   - Summaries (weekly status),
   - Insights narratives (e.g., “why this product is trending”).
5. API returns structured results to Web.

### 4.2 Import & Normalization Flow

Data sources may include:

- Shopify exports / API access (future),
- Etsy CSV exports (historical),
- Manual input (admin forms).

Import approach:

- Raw data is normalized into internal tables.
- A validation stage ensures required fields exist.
- A “data quality score” (optional) can flag incomplete datasets.

---

## 5. Core Architectural Decisions (With Rationale)

### Decision A — API + Web as Separate Apps

**Decision:** Maintain API and Web as separate applications in `apps/`.

**Rationale:**

- Clean separation of concerns: UI changes do not break business rules.
- Independent deployment paths.
- Supports scaling: future mobile, admin, integrations can reuse API.

**Trade-off:**

- More setup and coordination in early stages (endpoints/contracts).
- Mitigated by strong documentation and versioned API contracts.

---

### Decision B — Deterministic Business Rules First; LLM as Optional Enhancement

**Decision:** Business decisions are made by deterministic logic; LLM only enhances presentation.

**Rationale:**

- E-commerce operations require repeatable and auditable logic.
- LLM output can vary; it cannot be the source of truth.
- Enables explainability for TFM: “the rule produced X because Y”.
**Result:**
- The platform never becomes “AI magic”; it becomes a reliable decision engine with AI explanations.

---

### Decision C — PostgreSQL as Single Source of Structured Truth

**Decision:** Postgres stores normalized datasets and system outputs.

**Rationale:**

- Strong relational modeling for orders/products/metrics.
- Supports reporting, audit trails, and future analytics.
- Works smoothly with Docker in dev.

---

### Decision D — Clean Architecture to Protect the Domain

**Decision:** Domain logic has no dependency on DB, HTTP, or LLM.

**Rationale:**

- Protects the long-term maintainability of the project.
- Aligns with academic best practices (TFM defensible).
- Reduces future refactor cost.

---

## 6. Interfaces and Contracts (How apps communicate)

### 6.1 API Contract Style

The API will be REST-based for clarity and speed of implementation.

Examples of endpoint families:

- `/health` — system health check
- `/kpis` — dashboard KPIs
- `/recommendations` — suggested actions
- `/imports/*` — dataset ingestion
- `/catalog/*` — products & variants
- `/decisions/*` — “decision records” for audit trail

The final endpoint list will be derived from the **domain use cases**.

---

## 7. Non-Functional Requirements

### 7.1 Maintainability

- Separation of layers
- Consistent DTO mapping
- Unit tests prioritized at domain/application

### 7.2 Traceability / Auditability

- Deterministic rules produce structured decision outputs
- Decisions can be stored with:
  - timestamp,
  - rule version,
  - input snapshot reference,
  - output rationale fields

### 7.3 Performance

- Dashboard is read-heavy: KPIs, lists, summaries
- Use indexes and precomputed aggregates where needed
- LLM calls are asynchronous or optional to avoid blocking core flows

### 7.4 Security (Initial baseline)

- No sensitive secrets in repo
- `.env` not committed
- Future: authentication for admin/import endpoints

---

## 8. Deployment and Environment Strategy

### 8.1 Development (Local)

- Docker Compose runs Postgres
- API connects using environment variables
- Web points to API base URL (local)

### 8.2 Production (Future)

Two typical options:

- Single VPS with Docker Compose for all services, or
- Managed DB + containerized API/Web (platform of choice)

This is intentionally left flexible for the TFM stage.

---

## 9. Observability (Minimal viable, expandable)

Initial:

- Structured logs at API (request ID + use case name)
- Basic health endpoint

Future:

- Metrics (request durations, DB timings)
- Error tracking (Sentry, etc.)

---

## 10. Next Steps (Implementation Roadmap Alignment)

Immediate next documents:

1. **Data Model** (`docs/data-model.md`)  
   - Tables/entities for orders, products, decisions, metrics.
2. **API Specification** (`docs/api-spec.md` or OpenAPI later)  
   - Endpoint list, request/response DTOs.
3. **Dashboard Wireframe** (`docs/dashboard-wireframe.md`)  
   - Screens and components mapped to endpoints.
4. **System README** (`README.md`)  
   - Setup steps, run commands, architecture summary.

---

## 11. Conclusion

This architecture provides a professional and defensible foundation for a real decision-support system:

- It keeps business logic clean and testable,
- Supports evidence-based decision-making,
- Enables optional AI insight generation without sacrificing correctness,
- And aligns with academic expectations for a final master’s project.

The system is designed to deliver a usable product incrementally: deterministic engine first, insights layer second.
