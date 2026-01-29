# Stylenya API

## Integration tests

These tests use Vitest + Supertest and require a dedicated Postgres database.

1. Start Postgres (example with the repo `docker-compose.yml`):
   ```bash
   docker compose up -d db
   ```
2. Create a test database (example name shown below):
   ```bash
   createdb -h localhost -p 5432 -U stylenya stylenya_intel_test
   ```
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
