# Stylenya Web

Frontend dashboard for the Stylenya Intelligent Project. This app consumes the API and focuses on data visualization and decision workflows.

## Tech stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Local development

From the repo root:

```sh
npm install --prefix apps/web
npm --prefix apps/web run dev
```

Or run both apps together from the repo root:

```sh
npm install
npm run dev
```

### Environment variables (`apps/web/.env`)

```env
VITE_API_URL=http://localhost:3001
VITE_API_PREFIX=/v1
```

- `VITE_API_PREFIX` controls the backend route prefix (default `/v1`).
- If `VITE_API_URL` already includes `/v1`, the app avoids duplicating it.
- In Render (or any setup with rewrite/proxy), you can set `VITE_API_PREFIX=` empty if infra already resolves the prefix.

## Project structure

- src/pages: routes and page-level views
- src/components: reusable UI components
- src/api: API client and data fetching
- src/hooks: app hooks
