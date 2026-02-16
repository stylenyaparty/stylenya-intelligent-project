# Stylenya Intelligence Dashboard

## a. Descripción general del proyecto

**Stylenya Intelligence Dashboard** es un **Sistema de Apoyo a la Toma de Decisiones (Decision Support System – DSS)** diseñado para asistir estratégicamente a negocios de e-commerce creativo mediante el análisis de señales externas de demanda y la generación de propuestas de decisión asistidas por Inteligencia Artificial.

El sistema **no automatiza decisiones ni ejecuta acciones**, sino que actúa como una plataforma de **inteligencia asistencial**, donde la IA colabora generando contexto, borradores y explicaciones que posteriormente son evaluadas, validadas y promovidas por un usuario humano.

El objetivo principal del proyecto es **reducir la carga cognitiva del decisor**, mejorar la trazabilidad de las decisiones estratégicas y transformar datos externos (como keywords de búsqueda con volumen real) en **planes operativos accionables**, manteniendo siempre el control humano sobre el ciclo de vida de cada decisión.

El sistema ha sido diseñado, implementado y desplegado como una **aplicación real en producción**, no como un prototipo académico, y constituye el **Trabajo Fin de Máster (TFM)** del autor.

---

## b. Stack tecnológico utilizado

El sistema sigue una **arquitectura desacoplada**, separando claramente frontend, backend, dominio, persistencia e infraestructura.

### Backend

- **Node.js** (runtime)
- **TypeScript** (tipado estático)
- **Fastify** (framework HTTP de alto rendimiento)
- **Prisma ORM** (modelado y migraciones de base de datos)
- **PostgreSQL** (motor de base de datos)
- **JWT** (autenticación)
- **Vitest + Supertest** (tests de integración)

### Frontend

- **React**
- **Vite**
- **TypeScript**
- **Arquitectura desktop-first**
- **Separación clara UI / servicios / lógica**

### Inteligencia Artificial

- **Capa LLM desacoplada del dominio**
- **Provider abstraction** (Mock / OpenAI)
- IA en rol **asistencial**, no decisorio
- Generación de *Decision Drafts* y explicaciones contextualizadas

### Infraestructura y despliegue

- **Render**
  - Web Service (Backend)
  - Static Site (Frontend)
- **Neon Console**
  - PostgreSQL serverless
- **Prisma Migrate** para sincronización de esquema en producción

---

## c. Instalación y ejecución

### Requisitos previos

- Node.js ≥ 18
- Yarn
- Docker (opcional para entorno local de base de datos)
- PostgreSQL (local o remoto)

---

### Instalación del proyecto

#### Clonar el repositorio

```bash
git clone https://github.com/stylenyaparty/stylenya-intelligent-project.git
cd stylenya-intelligent-project
```

#### Instalar dependencias

```bash
yarn install
```

### Configuración del backend

#### Crear un archivo `.env` en `apps/api`

```env
DATABASE_URL=postgresql://user:password@localhost:5432/stylenya
JWT_SECRET=your_secret_here
NODE_ENV=development

# Reviewer Access (opcional para evaluación)
ENABLE_REVIEWER_ACCESS=false
EVAL_ACCESS_CODE=YOUR_SECURE_CODE
```

#### Ejecutar migraciones

```bash
cd apps/api
npx prisma migrate dev
```

#### Ejecutar backend

```bash
yarn dev
```

Backend disponible por defecto en:

`http://localhost:3001`

### Configuración del frontend

#### Crear un archivo `.env` en `apps/web`

```env
VITE_API_URL=http://localhost:3001
VITE_API_PREFIX=/v1
```

Notas:

- `VITE_API_PREFIX` controla el prefijo de rutas del backend (por defecto `/v1`).
- Si `VITE_API_URL` ya incluye `/v1`, no se duplica automáticamente.
- En Render (u otros entornos con rewrite/proxy), puedes dejar `VITE_API_PREFIX=` vacío si el prefijo ya se resuelve en infraestructura.

#### Ejecutar frontend

```bash
cd apps/web
yarn dev
```

Frontend disponible por defecto en:

`http://localhost:5173`

## d. Estructura del proyecto

El proyecto sigue una estructura monorepo, organizada por responsabilidades:

```text
stylenya-intelligent-project/
│
├── apps/
│   ├── api/                # Backend (Fastify + Prisma)
│   │   ├── prisma/         # Esquema y migraciones
│   │   ├── src/
│   │   │   ├── routes/     # Endpoints HTTP
│   │   │   ├── domain/     # Modelo de dominio
│   │   │   ├── services/   # Casos de uso
│   │   │   ├── llm/        # Capa IA (provider abstraction)
│   │   │   └── app.ts
│   │   └── tests/          # Tests de integración
│   │
│   └── web/                # Frontend (React + Vite)
│       ├── src/
│       │   ├── pages/
│       │   ├── components/
│       │   ├── services/   # Cliente API
│       │   └── App.tsx
│       └── dist/           # Build de producción
│
├── docs/                   # Documentación académica (TFM)
├── README.md
└── package.json
```

## e. Funcionalidades principales

### Autenticación y bootstrap

- Creación de administrador inicial (one-time bootstrap).
- Diferenciación explícita entre:
  - inexistencia de usuarios.
  - usuario no autenticado.
- Autenticación basada en JWT.

### Reviewer Access Mode (Evaluación Académica)

Para permitir la evaluación externa del sistema sin alterar el modelo de bootstrap ni introducir un sistema completo de administración de usuarios, se implementó un modo especial de acceso controlado por código.

- Activación:

Se controla exclusivamente mediante variables de entorno:

ENABLE_REVIEWER_ACCESS=true
EVAL_ACCESS_CODE=SECURE_RANDOM_CODE

- Flujo:

En la pantalla de login se muestra un campo opcional Reviewer Code. Si el código es válido, se habilita un formulario para ingresar:

- Name
- Email
- Password

Se crea un usuario temporal con:

- role = ADMIN
- isReviewer = true
- El usuario inicia sesión normalmente.
- Tiene acceso completo al flujo DSS.
- Desde el Dashboard puede ejecutar End Review.
- El sistema deshabilita el usuario (archivedAt).
- Se fuerza logout y regreso al login.

Consideraciones:

- No existe CRUD de usuarios.
- No existe panel administrativo.
- No se exponen configuraciones internas.
- El endpoint puede desactivarse completamente vía entorno.
- No se altera el modelo de dominio.

### Ingesta de señales externas

- Carga de keywords vía CSV (Google Keyword Planner).
- Normalización y deduplicación.
- Persistencia trazable de señales.
- Registro de runs e histórico de ingesta.

### Capa de Inteligencia Artificial (LLM)

- Generación de Decision Drafts.
- Análisis contextual de señales externas + contexto interno.
- Redacción de propuestas y justificación.
- La IA no ejecuta acciones ni modifica estados de negocio.
- Human-in-the-loop obligatorio para promoción.

### Decision Drafts & Decision Log

- Inbox diario de borradores generados por IA.
- Promoción manual a decisión.
- Registro histórico navegable por fechas.
- Estados controlados manualmente.
- Auditoría completa del ciclo de vida.

### SEO Focus (plan operativo)

- Cadencia bi-weekly.
- Derivado exclusivamente de decisiones aprobadas.
- Evita duplicados y ruido estratégico.
- Actúa como centro operativo de corto plazo.

### Trazabilidad y control

- Todas las decisiones requieren justificación.
- No existen transiciones automáticas.
- Estados controlados manualmente.
- Historial persistente y auditable.
- Soft-disable de usuarios reviewer sin eliminar datos históricos.