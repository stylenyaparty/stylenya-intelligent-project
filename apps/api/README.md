# Stylenya API

Backend API for the Stylenya Intelligent Project. This application implements **Clean Architecture** principles and exposes business capabilities through HTTP endpoints using **Fastify** as the web framework.

---

## 🏗️ Architecture Overview

The API follows **Clean Architecture** with clear separation of concerns:

```
apps/api/
├── prisma/                      # Database schema and migrations
│   ├── schema.prisma           # Prisma data models
│   └── seed.ts                 # Database seed data
├── scripts/                     # Utility scripts
├── src/
│   ├── application/            # Use cases / business logic orchestration
│   ├── domain/                 # Core business entities and rules
│   │   ├── entities/          # Domain entities (User, Product, etc.)
│   │   └── enums/             # Domain enumerations
│   ├── infrastructure/         # External adapters
│   │   ├── db/                # Prisma database client
│   │   └── repositories/      # Data persistence implementations
│   ├── interfaces/            # HTTP interface layer
│   │   └── http/              # Fastify routes, controllers, middleware
│   │       ├── auth/          # Authentication routes
│   │       ├── decisions/     # Decision management routes
│   │       ├── recommendations/ # Recommendation routes
│   │       ├── middleware/    # Auth guards and middleware
│   │       ├── app.ts         # Fastify app setup
│   │       ├── routes.ts      # Main route registration
│   │       └── server.ts      # Server entry point
│   ├── modules/               # Feature modules
│   │   ├── dashboard/         # Dashboard KPIs and metrics
│   │   ├── decision-drafts/   # AI-generated decision drafts
│   │   ├── keywords/          # Keyword research and management
│   │   ├── llm/               # LLM integration (OpenAI)
│   │   ├── products/          # Product catalog management
│   │   ├── seo-focus/         # SEO focus tracking
│   │   ├── settings/          # Application settings
│   │   ├── signals/           # Market signals processing
│   │   └── weekly-focus/      # Weekly focus recommendations
│   ├── plugins/               # Fastify plugins
│   │   └── auth-guard.ts      # JWT authentication guard
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
├── test/                       # Integration tests
│   ├── helpers.ts             # Test utilities
│   └── integration/           # Integration test suites
├── .env.example               # Environment variables template
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── vitest.config.ts           # Vitest test configuration
```

---

## 🚀 Tech Stack

- **Runtime**: Node.js with TypeScript
- **Web Framework**: Fastify 5.x
- **ORM**: Prisma 6.19.2
- **Database**: PostgreSQL
- **Authentication**: JWT (@fastify/jwt) + bcrypt
- **Validation**: Zod
- **AI/LLM**: OpenAI GPT-4o-mini
- **Testing**: Vitest + Supertest
- **Build Tool**: tsx + TypeScript compiler

---

## 📋 Core Features

### 1. **Authentication & Authorization**
- JWT-based authentication with secure httpOnly cookies
- Role-based access control (ADMIN, USER)
- Reviewer access with temporary codes
- Initial admin bootstrap flow
- Password hashing with bcrypt
- Auth guard plugin protecting all non-public routes

**Routes**: `/auth/login`, `/auth/reviewer/signup`, `/auth/reviewer/end`, `/initial-admin`, `/bootstrap-status`, `/me`

### 2. **Decision Management**
- Create, list, and manage business decisions
- Status tracking (PLANNED, EXECUTED, DISMISSED)
- Priority scoring and rationale tracking
- Deduplication by action/target combination
- Date-range filtering (today, all-time)
- Source attribution and audit trail

**Routes**: `/decisions` (GET, POST), `/decisions/weekly-focus/latest`

### 3. **AI-Powered Decision Drafts**
- LLM-generated decision recommendations
- Batch generation from market signals
- Expansion with detailed next steps
- Draft lifecycle: NEW → DISMISSED | PROMOTED
- Context-aware generation with SEO seeds
- Retry logic and error handling

**Routes**: `/decision-drafts/generate`, `/decision-drafts`, `/decision-drafts/:id/dismiss`, `/decision-drafts/:id/promote`, `/decision-drafts/:id/expand`, `/decision-drafts/:id/expansions`

### 4. **Product Catalog Management**
- Multi-source support (Etsy, Shopify)
- CSV import with auto-detection
- Product lifecycle management (ACTIVE, RETIRED, ARCHIVE)
- Seasonality tracking (NONE, SEASONAL, YEAR_ROUND)
- Sales records integration
- Archive/restore functionality

**Routes**: `/products` (GET, POST), `/products/:id` (GET, PUT, DELETE), `/products/:id/archive`, `/products/:id/restore`, `/products/import`

### 5. **Keyword Research & SEO**
- Keyword seed management (ACTIVE, ARCHIVED, DISMISSED)
- Job-based keyword research execution
- Signal batch processing
- Promoted keyword signals
- Integration with keyword providers (AUTO, MANUAL, GOOGLE_ADS)
- Product type definitions for context

**Routes**: `/keywords/seeds`, `/keywords/jobs`, `/keywords/jobs/:id/run`, `/keywords/jobs/:id/items`, `/keywords/signals/promoted`

### 6. **Market Signals Processing**
- Keyword signal tracking with metrics
- Competition level analysis (LOW, MEDIUM, HIGH)
- Batch creation and management
- Signal promotion workflow
- Top signals listing

**Routes**: `/signals`, `/signals/batches`, `/signals/latest`

### 7. **SEO Focus & Weekly Planning**
- Weekly focus recommendations
- SEO context seeds (INCLUDE, EXCLUDE)
- Product type definitions
- Decision log snapshots
- Date-range SEO focus queries

**Routes**: `/seo-focus`, `/seo-context`, `/settings/product-types`, `/weekly-focus`

### 8. **Dashboard & Analytics**
- KPI metrics overview
- Decision statistics
- Product performance tracking
- Signal analytics
- Real-time status reporting

**Routes**: `/dashboard/kpis`

### 9. **LLM Integration**
- OpenAI GPT-4o-mini integration
- Configurable temperature and sampling
- Sandbox mode for testing
- Token usage tracking
- Fallback model support
- Timeout and retry configuration

**Routes**: `/llm/status`, `/llm/sandbox`

### 10. **Settings Management**
- Keyword provider configuration
- SEO context management
- Product type definitions
- Google Ads integration settings
- Currency and threshold configuration

**Routes**: `/settings/keyword-provider`, `/settings/seo-context`, `/settings/product-types`

---

## 🔐 Authentication Flow

### Public Routes (No Auth Required)
- `GET /v1/health`
- `GET /v1/bootstrap-status`
- `POST /v1/initial-admin`
- `POST /v1/auth/login`
- `POST /v1/auth/reviewer/signup`

### Protected Routes
All other routes require:
1. Valid JWT in Authorization header or httpOnly cookie
2. Role-based permissions (some routes require ADMIN)

### Middleware
- **authGuardPlugin**: Automatically checks JWT on all non-public routes
- **requireAuth**: Explicit auth check for specific routes
- **requireRole(role)**: Role-based access control

---

## 💾 Database Models

Key Prisma models:

- **User**: Authentication and user management
- **Product**: Product catalog (Etsy, Shopify sources)
- **SalesRecord**: Sales metrics by period (D90, D180)
- **Request**: Customer requests and themes
- **Settings**: Global application settings
- **Decision**: Business decisions and actions
- **DecisionLog**: Weekly snapshot logs
- **DecisionDraft**: AI-generated decision drafts
- **KeywordSeed**: SEO keyword seeds
- **KeywordJob**: Keyword research jobs
- **KeywordJobItem**: Individual job results
- **KeywordSignal**: Market signals
- **SignalBatch**: Grouped signal batches
- **PromotedKeywordSignal**: Promoted signals
- **ProductTypeDefinition**: Product type taxonomy
- **SeoContextSeed**: SEO inclusion/exclusion terms

---

## ⚙️ Environment Variables

See `.env.example` for the complete list. Key variables:

### Database
- `DATABASE_URL`: PostgreSQL connection string
- `SHADOW_DATABASE_URL`: Shadow DB for Prisma migrations

### Authentication
- `JWT_SECRET`: Secret key for JWT signing
- `JWT_EXPIRES_IN`: Token expiration (default: 7d)

### Server
- `PORT`: Server port (default: 3001)
- `HOST`: Server host (default: 127.0.0.1)
- `NODE_ENV`: Environment mode (development, production)

### LLM Configuration
- `LLM_ENABLED`: Enable LLM features (default: true)
- `LLM_PROVIDER`: Provider name (openai)
- `OPENAI_API_KEY`: OpenAI API key
- `OPENAI_MODEL`: Default model (gpt-4o-mini)
- `LLM_MODEL_GENERATE`: Model for draft generation
- `LLM_MODEL_EXPAND`: Model for draft expansion
- `LLM_TEMPERATURE_GENERATE`: Creativity for generation (default: 0.9)
- `LLM_TEMPERATURE_EXPAND`: Precision for expansion (default: 0.3)
- `LLM_TOP_P_GENERATE`: Nucleus sampling (default: 1.0)
- `LLM_TOP_P_EXPAND`: Nucleus sampling (default: 1.0)
- `LLM_USE_NONCE`: Add randomness nonce (default: false)
- `MAX_OUTPUT_TOKENS_GENERATE`: Max tokens for generation (default: 900)
- `MAX_OUTPUT_TOKENS_EXPAND`: Max tokens for expansion (default: 1600)
- `LLM_TIMEOUT_MS`: Request timeout (default: 30000)
- `LLM_MAX_RETRIES`: Retry attempts (default: 1)

### Keywords & SEO
- `KEYWORD_PROVIDER`: Keyword provider (AUTO, MANUAL, GOOGLE_ADS)
- `ENABLE_REVIEWER_ACCESS`: Enable reviewer signup (default: false)
- `EVAL_ACCESS_CODE`: Access code for reviewers

### Legacy Flags
- `LEGACY_API_ENABLED`: Legacy API compatibility (default: false)
- `LEGACY_ENGINE_ENABLED`: Legacy engine support (default: false)

---

## 🛠️ Local Development

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- npm or pnpm

### Setup

1. **Install dependencies** (from repo root):
   ```bash
   npm install
   ```

2. **Create environment file**:
   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

3. **Configure database**:
   Update `DATABASE_URL` in `.env` with your PostgreSQL credentials.

4. **Run migrations**:
   ```bash
   cd apps/api
   npm run prisma:migrate:dev
   ```

5. **Seed database** (optional):
   ```bash
   npx prisma db seed
   ```

6. **Start development server**:
   ```bash
   npm run dev
   ```

   Or from repo root to run both apps:
   ```bash
   npm run dev
   ```

7. **Open Prisma Studio** (optional):
   ```bash
   npm run prisma:studio
   ```

---

## 🧪 Testing

### Integration Tests

Tests use **Vitest + Supertest** and require a dedicated PostgreSQL test database.

#### Setup

1. **Start PostgreSQL**:
   ```bash
   docker compose up -d db
   ```

2. **Create test database**:
   ```bash
   createdb -h localhost -p 5432 -U stylenya stylenya_intel_test
   ```

3. **Create `.env.test`** in `apps/api/`:
   ```dotenv
   DATABASE_URL=postgresql://stylenya:stylenya_dev_password@localhost:5432/stylenya_intel_test?schema=public
   JWT_SECRET=your-test-secret
   ```

4. **Run tests**:
   ```bash
   cd apps/api
   npm test
   ```

5. **Watch mode**:
   ```bash
   npm run test:watch
   ```

#### Test Structure
- `test/helpers.ts`: Test utilities (server setup, DB reset, auth helpers)
- `test/integration/`: Integration test suites (decisions, auth, etc.)
- Tests use automatic DB truncation between runs for isolation

---

## 📦 Build & Deploy

### Build for Production

```bash
cd apps/api
npm run build
```

This compiles TypeScript to JavaScript and generates Prisma client.

### Start Production Server

```bash
npm start
```

### Deploy to Render

Set the following environment variables on Render:

- All database, JWT, and LLM variables from `.env.example`
- Recommended LLM settings:
  - `LLM_TEMPERATURE_GENERATE=0.9`
  - `LLM_TEMPERATURE_EXPAND=0.3`
  - `LLM_USE_NONCE=true`

---

## 📜 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload (tsx watch) |
| `npm start` | Start production server |
| `npm test` | Run integration tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run build` | Build for production |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run prisma:migrate:dev` | Run DB migrations |
| `npm run prisma:shadow:reset` | Reset shadow database |

---

## 🔧 API Prefix

All routes are prefixed with `/v1` by default.

Example: `http://localhost:3001/v1/health`

---

## 📖 API Documentation

### Health Check
```
GET /v1/health
Response: { ok: true, service: "stylenya-api" }
```

### Root Endpoint
```
GET /v1/
Response: {
  ok: true,
  service: "stylenya-api",
  version: "0.1.0",
  docs: {
    health: "/v1/health",
    bootstrapStatus: "/v1/bootstrap-status",
    initialAdmin: "/v1/initial-admin",
    login: "/v1/auth/login"
  }
}
```

For complete endpoint documentation, see:
- `docs/api-contract.md` (in project root)
- Source files in `src/interfaces/http/` and `src/modules/`

---

## 🧩 Module Breakdown

### Core Modules (`src/modules/`)

| Module | Purpose | Key Files |
|--------|---------|-----------|
| **dashboard** | KPIs and metrics | `dashboard.routes.ts`, `dashboard.service.ts` |
| **decision-drafts** | AI decision generation | `decision-drafts.routes.ts`, `decision-drafts.service.ts` |
| **keywords** | Keyword research | `keywords.routes.ts`, `keywords.service.ts`, `keywords-runner.service.ts` |
| **llm** | LLM integration | `llm.routes.ts`, `llm.service.ts` |
| **products** | Product management | `products.routes.ts`, `products.service.ts`, `products.schemas.ts` |
| **seo-focus** | SEO tracking | `seo-focus.routes.ts` |
| **settings** | Settings management | `keyword-provider-settings.routes.ts`, `seo-context.routes.ts`, `product-types.routes.ts` |
| **signals** | Market signals | `signals.routes.ts`, `signals.service.ts` |
| **weekly-focus** | Weekly planning | `weekly-focus.routes.ts`, `weekly-focus.service.ts` |

---

## 🛡️ Error Handling

The API uses custom `AppError` class for structured errors:

```typescript
class AppError {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}
```

Global error handler in `app.ts` catches all unhandled errors and returns:
```json
{
  "error": "INTERNAL_SERVER_ERROR",
  "message": "Error description"
}
```

---

## 🤖 LLM Draft Variability Tuning

Adjust AI creativity and consistency for decision drafts:

- **`LLM_TEMPERATURE_GENERATE`** (default `0.9`): Higher = more creative generation
- **`LLM_TEMPERATURE_EXPAND`** (default `0.3`): Lower = more precise expansion
- **`LLM_TOP_P_GENERATE`** (default `1.0`): Nucleus sampling for generation
- **`LLM_TOP_P_EXPAND`** (default `1.0`): Nucleus sampling for expansion
- **`LLM_USE_NONCE`** (default `false`): Add randomness for diversity

**Suggested Render values**:
- `LLM_TEMPERATURE_GENERATE=0.9`
- `LLM_TEMPERATURE_EXPAND=0.3`
- `LLM_USE_NONCE=true` (optional for more variation)

---

## 🔗 Related Documentation

- **Project Root Docs**: `/docs/`
- **Web App**: `/apps/web/README.md`
- **API Contract**: `/docs/api-contract.md`
- **Clean Architecture**: `/docs/apps-api.mdx`

---

## 📝 License

ISC

---

## 👥 Contributors

Stylenya Team

---

**Happy Coding! 🚀**