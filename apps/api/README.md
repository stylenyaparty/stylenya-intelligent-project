# Stylenya API

Backend API for the Stylenya Intelligent Project. This app implements clean architecture and exposes business use cases via HTTP endpoints.

## Local development

From the repo root:

```bash
npm install --prefix apps/api
npm --prefix apps/api run dev
```

Create a local environment file before running the API:

```bash
copy apps/api/.env.example apps/api/.env
```

Or run both apps together from the repo root:

```bash
npm install
npm run dev
```

## Integration tests

These tests use Vitest + Supertest and require a dedicated Postgres database.

1. Start Postgres (example with the repo `docker-compose.yml`):

   ```bash
   docker compose up -d db
   ```

2. Create a test database (example name shown below):

   ```bash
   createdb -h localhost -p 5432 -U stylenya stylenya_intel_test

3. Create `apps/api/.env.test` with:

   ```bash
   DATABASE_URL=postgresql://stylenya:stylenya_dev_password@localhost:5432/stylenya_intel_test?schema=public
   JWT_SECRET=your-test-secret
   ```

4. Run the tests:

   ```bash
   cd apps/api
   npm test
   ```

The test setup runs Prisma migrations once and truncates all tables between tests to keep them isolated and repeatable.

## LLM draft variability tuning

Set these environment variables to tune creativity and repeatability for decision-draft generation:

- `LLM_TEMPERATURE_GENERATE` (default `0.9`)
- `LLM_TEMPERATURE_EXPAND` (default `0.3`)
- `LLM_TOP_P_GENERATE` (default `1.0`)
- `LLM_TOP_P_EXPAND` (default `1.0`)
- `LLM_USE_NONCE` (default `false`, set `true` to add a per-run nonce for extra diversity)

Suggested Render values after deploy:

- `LLM_TEMPERATURE_GENERATE=0.9`
- `LLM_TEMPERATURE_EXPAND=0.3`
- `LLM_USE_NONCE=true` (optional)
