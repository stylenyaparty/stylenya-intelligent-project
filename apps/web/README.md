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

## Project structure

- src/pages: routes and page-level views
- src/components: reusable UI components
- src/api: API client and data fetching
- src/hooks: app hooks
