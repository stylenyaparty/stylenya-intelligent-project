# Arquitectura del Sistema — Stylenya Intelligent Project (TFM)

## 1. Propósito y Alcance

Este documento define la arquitectura del sistema para **Stylenya Intelligent Project**, una plataforma de soporte a la toma de decisiones para un negocio e-commerce real (Stylenya). El sistema integra:

- **Señales de ventas históricas** (exportaciones de Etsy / pedidos de Shopify),
- **Estructura del catálogo de Shopify** (productos/variantes/etiquetas),
- **Reglas de negocio** (precios, capacidad de producción, restricciones de tiempo de entrega),
- E **insights asistidos por LLM opcionales** (resúmenes, priorización, recomendaciones).

La arquitectura está diseñada para ser:

- **Mantenible** (Arquitectura Limpia),
- **Auditable** (las reglas de negocio son deterministas y trazables),
- **Extensible** (el LLM es opcional y no puede romper la lógica central),
- **Desplegable** (Docker + Postgres; API/Web como aplicaciones separadas).

Esta arquitectura respalda los requisitos del TFM de decisiones de ingeniería claras, trazabilidad y aplicabilidad en el mundo real.

---

## 2. Visión General de la Arquitectura de Alto Nivel

El sistema está compuesto por dos aplicaciones principales:

- **Aplicación API (Backend)**: expone capacidades de negocio mediante endpoints HTTP (REST).
- **Aplicación Web (Frontend)**: proporciona la interfaz de usuario del dashboard para toma de decisiones, informes y flujos de trabajo.

Una base de datos PostgreSQL almacena:

- Conjuntos de datos importados (pedidos, productos, clientes si es necesario),
- Entidades de dominio y salidas de reglas,
- Métricas derivadas y "registros de decisiones" (qué recomendó el sistema y por qué).

### Resumen de Componentes

- **apps/api**  
  - Implementa casos de uso y expone endpoints HTTP.
  - Posee la ejecución de reglas de dominio (determinista).
  - Llama al gateway LLM opcionalmente (insights no deterministas).

- **apps/web**  
  - Interfaz de usuario del dashboard y flujos de trabajo.
  - Consume endpoints de la API.
  - Sin lógica de negocio más allá de reglas de presentación y UX.

- **PostgreSQL (Docker)**  
  - Única fuente de verdad para datos estructurados.

- **Proveedor LLM (Opcional)**  
  - Usado para resúmenes, explicaciones, "narrativas de insights".
  - Nunca se convierte en una dependencia para la corrección.

---

## 3. Mapeo de Arquitectura Limpia a la Estructura del Repositorio

La estructura del repositorio sigue un enfoque de Arquitectura Limpia, con adaptaciones prácticas para Fastify y organización modular:

### 3.1 Capas Principales

**Capa de Dominio (`apps/api/src/domain`)**  
Contiene conceptos de negocio de nivel empresarial:

- Entidades (objetos centrales del negocio)
- Objetos de valor / enums (ej. `UserRole`)
- Servicios de dominio (lógica de negocio pura)
- Puertos (interfaces que definen dependencias hacia afuera)

**Capa de Aplicación (`apps/api/src/application`)**  
Contiene orquestación a nivel de sistema:

- Casos de uso (interactores) que coordinan operaciones de dominio
- DTOs (modelos de entrada/salida para casos de uso)
- Mappers (convierten entre DTOs y objetos de dominio)

**Capa de Infraestructura (`apps/api/src/infrastructure`)**  
Contiene integraciones externas e implementaciones técnicas:

- DB (adaptadores de Postgres con Prisma ORM)
- Repositorios (implementan puertos de dominio)
- Gateways (ej. adaptador LLM, adaptadores de importación Shopify/Etsy)

**Capa de Interfaces (`apps/api/src/interfaces/http`)**  
Contiene el mecanismo de entrega HTTP:

- Configuración de la aplicación Fastify (`app.ts`)
- Punto de entrada del servidor (`server.ts`)
- Registro de rutas (`routes.ts`)
- Middleware (guardias de autenticación, validación)
- Formateo de respuestas

### 3.2 Organización Modular (Extensión Práctica)

**Módulos de Características (`apps/api/src/modules`)**  
Para mantener la cohesión y facilitar el escalado, las funcionalidades específicas se organizan en módulos verticales:

- `dashboard/` — KPIs y métricas del dashboard
- `decision-drafts/` — Borradores de decisiones generados por IA
- `keywords/` — Investigación y gestión de palabras clave
- `llm/` — Integración LLM (OpenAI + Mock provider)
- `products/` — Gestión del catálogo de productos
- `seo-focus/` — Seguimiento de enfoque SEO
- `settings/` — Configuración de aplicación (tipos de producto, contexto SEO, proveedores de keywords)
- `signals/` — Procesamiento de señales de mercado
- `weekly-focus/` — Recomendaciones de enfoque semanal

Cada módulo puede contener:
- Rutas (`.routes.ts`)
- Servicios (`.service.ts`)
- Lógica específica del módulo

**Plugins Fastify (`apps/api/src/plugins`)**  
- `auth-guard.ts` — Guardia de autenticación JWT global
- Otros plugins reutilizables de Fastify

**Tipos TypeScript (`apps/api/src/types`)**  
- `app-error.ts` — Manejo de errores personalizado
- `fastify-jwt.d.ts` — Extensión de tipos para Fastify JWT
- Definiciones de tipos compartidas

**Utilidades (`apps/api/src/utils`)**  
- `hash.ts` — Utilidades de hashing (SHA256)
- Funciones auxiliares transversales

### 3.3 Por Qué Esta Estructura Importa (Justificación TFM)

Esta separación asegura:

- Las reglas de dominio son **testeables** sin HTTP/DB.
- Los servicios externos (LLM, importaciones) pueden cambiarse sin alterar la lógica de negocio.
- El sistema permanece **auditable**: las recomendaciones pueden rastrearse hasta salidas de reglas deterministas.
- **Escalabilidad modular**: nuevas funcionalidades pueden añadirse como módulos independientes sin afectar el núcleo.
- **Mantenibilidad**: separación clara de responsabilidades entre capas y módulos.

---

## 4. Flujo de Datos y Pipelines de Procesamiento

### 4.1 Flujo Principal (Soporte a Decisiones)

1. El usuario abre el dashboard Web.
2. Web llama a endpoint(s) de la API para:
   - KPIs,
   - Recomendaciones,
   - Colas de trabajo (ej. "qué preparar a continuación"),
   - Alertas basadas en reglas (señales del dashboard, no alertas push).
3. La API ejecuta casos de uso:
   - Carga datos relevantes (repositorios),
   - Ejecuta reglas de negocio deterministas (servicios de dominio),
   - Almacena salidas de decisiones cuando es apropiado (registros de decisiones).
4. La API opcionalmente llama al gateway LLM para generar:
   - Explicaciones (legibles por humanos),
   - Resúmenes (estado semanal),
   - Narrativas de insights (ej. "por qué este producto es tendencia").
5. La API devuelve resultados estructurados a Web.

### 4.2 Flujo de Importación y Normalización

Las fuentes de datos pueden incluir:

- Exportaciones/API de Shopify (futuro),
- Exportaciones CSV de Etsy (histórico),
- Entrada manual (formularios de administrador).

Enfoque de importación:

- Los datos crudos se normalizan en tablas internas.
- Una etapa de validación asegura que existan campos requeridos.
- Un "puntaje de calidad de datos" (opcional) puede señalar conjuntos de datos incompletos.

---

## 5. Decisiones Arquitectónicas Clave (Con Justificación)

### Decisión A — API + Web como Aplicaciones Separadas

**Decisión:** Mantener API y Web como aplicaciones separadas en `apps/`.

**Justificación:**

- Separación limpia de responsabilidades: cambios de UI no rompen reglas de negocio.
- Rutas de despliegue independientes.
- Soporta escalado: futuros móvil, admin, integraciones pueden reutilizar la API.

**Compromiso:**

- Más configuración y coordinación en etapas tempranas (endpoints/contratos).
- Mitigado por documentación fuerte y contratos de API versionados.

---

### Decisión B — Reglas de Negocio Deterministas Primero; LLM como Mejora Opcional

**Decisión:** Las decisiones de negocio se toman mediante lógica determinista; el LLM solo mejora la presentación.

**Justificación:**

- Las operaciones de e-commerce requieren lógica repetible y auditable.
- La salida del LLM puede variar; no puede ser la fuente de verdad.
- Habilita explicabilidad para el TFM: "la regla produjo X porque Y".

**Resultado:**
- La plataforma nunca se convierte en "magia de IA"; se convierte en un motor de decisiones confiable con explicaciones de IA.

---

### Decisión C — PostgreSQL como Única Fuente de Verdad Estructurada

**Decisión:** Postgres almacena conjuntos de datos normalizados y salidas del sistema.

**Justificación:**

- Modelado relacional fuerte para pedidos/productos/métricas.
- Soporta reporting, pistas de auditoría y futura analítica.
- Funciona suavemente con Docker en desarrollo.

---

### Decisión D — Arquitectura Limpia para Proteger el Dominio

**Decisión:** La lógica de dominio no tiene dependencia en DB, HTTP o LLM.

**Justificación:**

- Protege la mantenibilidad a largo plazo del proyecto.
- Se alinea con mejores prácticas académicas (defendible para el TFM).
- Reduce el costo de refactorización futura.

---

### Decisión E — Organización Modular dentro de Clean Architecture

**Decisión:** Implementar módulos por funcionalidad dentro del backend.

**Justificación:**

- Mejora la cohesión: código relacionado vive junto.
- Facilita navegación y mantenimiento en un proyecto real.
- Permite equipos distribuidos trabajando en módulos diferentes.
- Compatible con Arquitectura Limpia: los módulos respetan las capas.

---

### Decisión F — Autenticación JWT con Roles

**Decisión:** Implementar autenticación JWT con sistema de roles (ADMIN/USER).

**Justificación:**

- Sistema de producción real requiere control de acceso.
- JWT stateless facilita escalado horizontal.
- Sistema de roles permite separación de responsabilidades (admin setup, revisión, operaciones).

**Implementación:**
- Guardia global de autenticación con rutas públicas definidas
- Middleware `requireAuth` y `requireRole`
- Flujo de bootstrap para setup inicial del admin

---

## 6. Interfaces y Contratos (Cómo se Comunican las Apps)

### 6.1 Estilo de Contrato de la API

La API es REST-based para claridad y velocidad de implementación.

**Prefijo de API:** `/api/v1`

### 6.2 Familias de Endpoints Implementados

**Autenticación**
- `POST /api/v1/auth/login` — Login de usuario
- `POST /api/v1/auth/reviewer/signup` — Registro de revisor
- `GET /api/v1/me` — Información del usuario actual

**Bootstrap**
- `GET /api/v1/bootstrap-status` — Estado del setup inicial
- `POST /api/v1/initial-admin` — Crear primer admin

**Dashboard**
- `GET /api/v1/dashboard/*` — KPIs y métricas del dashboard

**Productos**
- `GET /api/v1/products` — Listado de productos
- Endpoints CRUD para gestión de productos

**Keywords**
- `GET /api/v1/keywords/*` — Gestión de keywords y seeds
- `POST /api/v1/keywords/jobs` — Trabajos de investigación de keywords

**Señales**
- `POST /api/v1/signals/upload` — Carga de señales de mercado
- `GET /api/v1/signals/*` — Análisis de señales

**Decisiones**
- `GET /api/v1/decisions` — Registro de decisiones
- `POST /api/v1/decisions` — Crear decisión

**Decision Drafts (IA)**
- `GET /api/v1/decision-drafts` — Borradores generados por IA
- `POST /api/v1/decision-drafts/generate` — Generar nuevo borrador

**LLM**
- `GET /api/v1/llm/status` — Estado del proveedor LLM
- `POST /api/v1/llm/sandbox` — Sandbox para pruebas de LLM

**Weekly Focus**
- `GET /api/v1/weekly-focus` — Recomendaciones de enfoque semanal
- `POST /api/v1/weekly-focus/snapshot` — Generar snapshot

**SEO Focus**
- `GET /api/v1/seo-focus` — Seguimiento de enfoque SEO

**Settings**
- `GET/POST /api/v1/settings/keyword-provider` — Configuración de proveedor de keywords
- `GET/POST /api/v1/settings/product-types` — Gestión de tipos de producto
- `GET/POST /api/v1/settings/seo-context` — Contexto SEO del negocio

**Utilidades**
- `GET /api/v1/health` — Health check del sistema
- `POST /api/v1/ui/sidebar-state` — Estado de UI (sidebar)
- `GET /api/v1/admin/ping` — Verificación de permisos de admin

### 6.3 Autenticación y Autorización

**Rutas Públicas (sin autenticación):**
- `GET /api/v1/health`
- `GET /api/v1/bootstrap-status`
- `POST /api/v1/initial-admin`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/reviewer/signup`

**Rutas Protegidas:**
- Todas las demás rutas requieren token JWT válido
- Algunas rutas requieren rol específico (ej. ADMIN)

**Flujo de Autenticación:**
1. Usuario envía credenciales a `/auth/login`
2. API valida y devuelve JWT
3. Cliente incluye JWT en header `Authorization: Bearer <token>`
4. Guardia de autenticación valida token en cada request

---

## 7. Requisitos No Funcionales

### 7.1 Mantenibilidad

- Separación de capas (domain, application, infrastructure, interfaces)
- Organización modular por funcionalidad
- Mapeo consistente de DTOs
- Tests unitarios priorizados en domain/application
- Tests de integración con Vitest + Supertest

### 7.2 Trazabilidad / Auditabilidad

- Las reglas deterministas producen salidas de decisiones estructuradas
- Las decisiones pueden almacenarse con:
  - timestamp,
  - versión de regla,
  - referencia de snapshot de entrada,
  - campos de justificación de salida

### 7.3 Rendimiento

- El dashboard es de lectura intensiva: KPIs, listas, resúmenes
- Usar índices y agregados precalculados donde sea necesario
- Las llamadas al LLM son asíncronas u opcionales para evitar bloquear flujos principales

### 7.4 Seguridad

**Implementado:**
- Sin secretos sensibles en el repo
- `.env` no commiteado
- Autenticación JWT para todos los endpoints protegidos
- Hashing de contraseñas con bcrypt
- Validación de entrada con Zod
- CORS configurado
- Cookies HttpOnly para estado de UI

**Futuro:**
- Rate limiting
- Auditoría de acciones de admin
- Encriptación de datos sensibles en DB

### 7.5 Observabilidad

**Actual:**
- Logs estructurados en API (request ID + nombre de caso de uso)
- Endpoint de health check básico
- Logging de uso de LLM (tokens, latencia)

**Futuro:**
- Métricas (duraciones de request, tiempos de DB)
- Rastreo de errores (Sentry, etc.)
- Distributed tracing

---

## 8. Estrategia de Despliegue y Entornos

### 8.1 Desarrollo (Local)

- Docker Compose ejecuta Postgres
- API se conecta usando variables de entorno
- Web apunta a URL base de API (local: `http://localhost:3001`)
- **Runtime:** Bun (preferido) o Node.js

**Comandos de inicio:**
```bash
# Backend
cd apps/api
bun install
bun run dev

# Frontend
cd apps/web
bun install
bun run dev

# Base de datos
docker-compose up -d
bun run prisma:migrate
```

### 8.2 Producción (Futuro)

Opciones típicas:

- VPS único con Docker Compose para todos los servicios, o
- DB gestionada + API/Web contenerizados (plataforma de elección)
- Variables de entorno seguras
- SSL/TLS para comunicaciones
- Backups regulares de BD

Esto se deja intencionalmente flexible para la etapa del TFM.

---

## 9. Stack Tecnológico Completo

### Backend (apps/api)

**Runtime & Lenguaje:**
- **Bun** (runtime principal, compatible con Node.js)
- **TypeScript** (tipado estático)

**Framework & Librerías:**
- **Fastify** (framework HTTP de alto rendimiento)
- **Prisma ORM** (modelado y migraciones de base de datos)
- **PostgreSQL** (motor de base de datos)
- **@fastify/jwt** (autenticación JWT)
- **@fastify/cors** (CORS)
- **@fastify/cookie** (gestión de cookies)
- **@fastify/multipart** (carga de archivos)
- **Zod** (validación de esquemas)
- **bcrypt** (hashing de contraseñas)

**Testing:**
- **Vitest** (test runner)
- **Supertest** (tests de integración HTTP)

**Integración IA:**
- **OpenAI SDK** (proveedor principal)
- Capa de abstracción de proveedores (Mock/OpenAI)

### Frontend (apps/web)

**Framework & Build:**
- **React 18**
- **Vite** (build tool)
- **TypeScript**

**Routing & Estado:**
- **React Router** (navegación)
- **Context API** (estado de autenticación)

**UI & Estilos:**
- **Tailwind CSS** (estilos utility-first)
- **shadcn/ui** (50+ componentes UI pre-construidos)
- **Lucide React** (iconos)

**Formularios & Validación:**
- **React Hook Form**
- **Zod** (validación client-side)

**Data Fetching:**
- Fetch API nativo
- Cliente API custom con manejo de errores

**Testing:**
- **Vitest** (unit tests)

### Infraestructura

**Base de Datos:**
- **PostgreSQL 16** (en Docker para desarrollo)
- **Prisma** como ORM y gestor de migraciones

**Containerización:**
- **Docker** & **Docker Compose**

**Control de Versiones:**
- **Git** + GitHub

---

## 10. Próximos Pasos (Alineación con Roadmap de Implementación)

Documentos inmediatos siguientes:

1. **Modelo de Datos** (`docs/data-model.md`)  
   - Tablas/entidades para pedidos, productos, decisiones, métricas.
   
2. **Especificación de API** (`docs/api-contract.md`)  
   - Lista completa de endpoints, DTOs de request/response.
   
3. **Wireframe del Dashboard** (`docs/dashboard-wireframe.md` o existente en `apps-web.mdx`)  
   - Pantallas y componentes mapeados a endpoints.
   
4. **README del Sistema** (`README.md`)  
   - Pasos de setup, comandos de ejecución, resumen de arquitectura.

5. **Modelo de Dominio** (`docs/domain-model.md`)
   - Entidades, value objects, servicios de dominio.

---

## 11. Conclusión

Esta arquitectura proporciona una base profesional y defendible para un sistema real de soporte a decisiones:

- Mantiene la lógica de negocio limpia y testeable,
- Soporta toma de decisiones basada en evidencia,
- Habilita generación opcional de insights de IA sin sacrificar corrección,
- Implementa autenticación y autorización desde el inicio,
- Organiza el código de forma modular y escalable,
- Y se alinea con las expectativas académicas para un proyecto final de máster.

El sistema está diseñado para entregar un producto usable incrementalmente: motor determinista primero, capa de insights segundo, con arquitectura sólida que soporta ambos.

**Diferencias clave con documentación previa:**
- ✅ Refleja la estructura real implementada (modules/, plugins/, types/, utils/)
- ✅ Documenta la autenticación JWT ya implementada
- ✅ Incluye endpoints reales y rutas específicas
- ✅ Añade Bun como runtime
- ✅ Detalla el sistema de bootstrap y roles
- ✅ Actualiza el stack tecnológico completo
- ✅ Mantiene los principios de Clean Architecture con adaptaciones prácticas
