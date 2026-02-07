# Stylenya Intelligent Project

Decision-support platform for Stylenya that combines deterministic business rules with optional AI-assisted insights. The system is split into two apps:

- API: exposes use cases and rules via HTTP.
- Web: dashboard UI for analysis and decision-making.

## Repo structure

```
apps/
	api/         # Backend API (clean architecture)
	web/         # Frontend dashboard (Vite + React)
docs/          # Project documentation (Mintlify)
```

## Documentation

Core docs live in the repo and are also rendered by Mintlify:

- [docs/system-architecture.md](docs/system-architecture.md)
- [docs/domain-model.md](docs/domain-model.md)
- [docs/data-model.md](docs/data-model.md)
- [docs/api-contract.md](docs/api-contract.md)

Mintlify config:

- [docs/docs.json](docs/docs.json)
- [docs/mint.json](docs/mint.json)

### Run docs locally

```bash
cd docs
npx mintlify dev
```

## Development

### Prerequisites

- Node.js
- Docker (for Postgres)

### Install dependencies

```bash
npm install --prefix apps/api
npm install --prefix apps/web
```

### Run API + Web together

```bash
npm install
npm run dev
```

### Database (local)

```bash
docker compose up -d db
```

### API integration tests

See [apps/api/README.md](apps/api/README.md) for the dedicated Postgres test database setup and Vitest commands.
