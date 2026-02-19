# Stylenya Web

Frontend dashboard for the Stylenya Intelligent Project. This React-based single-page application (SPA) consumes the backend API and provides a comprehensive interface for e-commerce intelligence, SEO decision-making, and product management.

---

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Pages & Functionalities](#pages--functionalities)
- [Authentication & Authorization](#authentication--authorization)
- [API Integration](#api-integration)
- [UI Components](#ui-components)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Testing](#testing)

---

## 🛠 Tech Stack

### Core Framework & Build Tools
- **Vite** - Fast build tool and dev server with HMR (Hot Module Replacement)
- **React 18.3.1** - UI library with hooks and modern patterns
- **TypeScript 5.8.3** - Type-safe development
- **React Router DOM 6.30.1** - Client-side routing

### UI & Styling
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **shadcn/ui** - High-quality, accessible React components built on Radix UI
- **Radix UI** - Unstyled, accessible component primitives
- **Lucide React** - Beautiful icon library (462.0)
- **next-themes** - Theme management (dark/light mode)

### Forms & Validation
- **React Hook Form 7.61.1** - Performant form state management
- **Zod 3.25.76** - TypeScript-first schema validation
- **@hookform/resolvers** - Form validation resolvers

### Data Fetching & State
- **TanStack Query 5.83.0** - Async state management and caching
- **date-fns 3.6.0** - Modern date utility library

### Data Visualization
- **Recharts 2.15.4** - Composable charting library built on React components

### Testing
- **Vitest 3.2.4** - Fast unit test framework
- **@testing-library/react 16.0.0** - React testing utilities
- **@testing-library/jest-dom 6.6.0** - Custom jest matchers
- **jsdom 20.0.3** - JavaScript implementation of web standards

### Linting & Code Quality
- **ESLint 9.32.0** - JavaScript linter
- **TypeScript ESLint 8.38.0** - TypeScript-specific linting rules
- **eslint-plugin-react-hooks** - React hooks linting
- **eslint-plugin-react-refresh** - React Fast Refresh linting

---

## ✨ Key Features

### 1. **Intelligent Decision Management**
   - AI-powered decision draft generation from keyword signals
   - Decision log with daily and historical views
   - Draft promotion, expansion, and dismissal workflows
   - Priority scoring and action type classification

### 2. **Product Management**
   - Multi-source product import (Shopify, Etsy, Manual)
   - Product type classification with synonyms
   - Seasonality tracking (Valentines, Halloween, Christmas, etc.)
   - Product status management (Active, Draft, Archived, Review)
   - CSV import/export capabilities

### 3. **Keyword Intelligence**
   - Custom and auto-generated keyword seeds
   - Integration with Google Ads Keyword Planner
   - Keyword job execution with SerpAPI
   - Interest and competition scoring
   - Related keyword discovery

### 4. **Signal Processing**
   - CSV signal upload from Google Ads Keyword Planner
   - Automatic scoring based on search volume, CPC, and trends
   - Relevance filtering (strict/broad/all modes)
   - Batch management and history tracking

### 5. **SEO Focus Planner**
   - Bi-weekly planning view (7/14/30/60 day windows)
   - Derived from decision log with priority ordering
   - Status filtering (planned vs. executed)
   - Quick access to actionable items

### 6. **Settings & Configuration**
   - Google Ads API integration setup
   - Product type definition management
   - SEO context seeds (include/exclude terms)
   - LLM temperature control for AI generation

### 7. **Authentication & Security**
   - JWT-based authentication
   - Role-based access (Admin, Reviewer)
   - Protected and public-only routes
   - Initial admin setup flow
   - Temporary reviewer access with invite codes

---

## 📁 Project Structure

```
apps/web/
├── public/                      # Static assets
├── src/
│   ├── api/                     # API client functions
│   │   └── auth.ts             # Authentication API calls
│   ├── auth/                    # Authentication logic
│   │   ├── AuthContext.tsx     # Auth context provider
│   │   ├── AuthGate.tsx        # Initial setup gate
│   │   ├── ProtectedRoute.tsx  # Private route wrapper
│   │   ├── PublicOnlyRoute.tsx # Public-only route wrapper
│   │   └── useAuth.ts          # Auth hook
│   ├── components/              # Reusable UI components
│   │   ├── dashboard/          # Dashboard-specific components
│   │   │   ├── ActionBadge.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── KPICard.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   ├── LoadingState.tsx
│   │   │   ├── ErrorState.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   └── index.ts
│   │   ├── layout/             # Layout components
│   │   ├── ui/                 # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── ... (50+ components)
│   │   └── NavLink.tsx
│   ├── hooks/                   # Custom React hooks
│   │   ├── use-mobile.tsx      # Mobile detection hook
│   │   └── use-toast.ts        # Toast notification hook
│   ├── lib/                     # Utility libraries
│   │   ├── api.ts              # API client with error handling
│   │   ├── api-url.ts          # API URL builder
│   │   └── utils.ts            # General utilities (cn function)
│   ├── pages/                   # Application pages/routes
│   │   ├── Dashboard.tsx       # Main dashboard with KPIs
│   │   ├── ProductsPage.tsx    # Product management
│   │   ├── KeywordsPage.tsx    # Keyword seed & job management
│   │   ├── SignalsPage.tsx     # Signal upload & analysis
│   │   ├── DecisionsPage.tsx   # Decision log & drafts
│   │   ├── SEOFocusPage.tsx    # SEO planner view
│   │   ├── SettingsPage.tsx    # Configuration & settings
│   │   ├── Login.tsx           # Login & reviewer signup
│   │   ├── InitialAdminSetup.tsx # First-time admin setup
│   │   └── NotFound.tsx        # 404 page
│   ├── test/                    # Test utilities
│   ├── App.css                  # Global styles
│   ├── App.tsx                  # Root component with routing
│   ├── index.css                # Tailwind directives
│   ├── main.tsx                 # Application entry point
│   └── vite-env.d.ts           # Vite environment types
├── .gitignore
├── bun.lockb                    # Bun lock file
├── components.json              # shadcn/ui configuration
├── eslint.config.js
├── index.html                   # HTML entry point
├── package.json
├── postcss.config.js
├── README.md
├── tailwind.config.ts           # Tailwind configuration
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts              # Vite configuration
└── vitest.config.ts            # Vitest test configuration
```

---

## 📄 Pages & Functionalities

### **Dashboard** (`/dashboard`)
Main landing page after login showing:
- **KPI Cards**: Active products, weekly focus items, pending decisions, recent decisions
- **SEO Focus Preview**: Top 3 upcoming SEO action items
- **Quick Navigation**: Links to all major sections
- **Reviewer Access Controls**: End review session button for temporary reviewers

### **Products Page** (`/dashboard/products`)
Comprehensive product catalog management:
- **Multi-tab View**: Separate tabs for Etsy, Shopify, and Review products
- **Search & Filtering**: Quick search by product name
- **Bulk Import**: CSV upload from Shopify/Etsy
- **CRUD Operations**: Create, edit, archive, restore products
- **Product Attributes**:
  - Name, source, product type
  - Status (Active, Draft, Archived, Review)
  - Seasonality classification
  - Last updated timestamp

### **Keywords Page** (`/dashboard/keywords`)
Keyword research and management:
- **Tabs**: Seeds, Jobs, Promoted Signals
- **Seed Management**: 
  - Add custom keywords manually or via bulk input
  - View auto-generated seeds
  - Archive/unarchive seeds
- **Job Creation**:
  - Configure marketplace (Etsy/Shopify/Google)
  - Set language (en/es), country, engine
  - Choose mode (Custom/Auto/Hybrid)
  - Set max results per seed
- **Job Execution**:
  - Run keyword research jobs
  - View job items and results
  - See interest/competition scores
  - Access related keywords
- **Signal Promotion**:
  - Promote job results to signals
  - Set priority levels (Low/Med/High)

### **Signals Page** (`/dashboard/signals`)
Google Ads Keyword Planner data import and analysis:
- **CSV Upload**: Import keyword performance data
- **Batch Management**: View upload history with warnings
- **Signal Exploration**:
  - Search and filter signals
  - Sort by score, searches, CPC, trends
  - Relevance mode selection (strict/broad/all)
- **Key Metrics**:
  - Average monthly searches
  - Competition level
  - CPC range (low/high)
  - 3-month and YoY change percentages
  - Custom scoring algorithm

### **Decisions Page** (`/dashboard/decisions`)
AI-powered decision intelligence center:
- **Decision Log Tab**:
  - Daily and historical views
  - Date navigation (previous/next day)
  - Action type badges (Add, Update, Archive, Optimize, etc.)
  - Status tracking (Planned, Executed, Dismissed)
  - Priority scores
  - Source attribution
- **Drafts Tab**:
  - Generate decision drafts from signal batches
  - Review AI-generated recommendations
  - Expand drafts for more detail
  - Promote drafts to decision log
  - Dismiss irrelevant drafts
  - View expansion history

### **SEO Focus Page** (`/dashboard/seo-focus`)
Strategic planning view:
- **Time Windows**: 7, 14, 30, or 60-day views
- **Status Filter**: Include executed or planned-only
- **Priority Ordering**: Sorted by AI-calculated priority
- **Action Types**: Visual badges for quick identification
- **Quick Links**: Direct links to decision details

### **Settings Page** (`/dashboard/settings`)
System configuration in tabbed interface:

**LLM Tab**:
- Temperature control for AI generation (0.0 - 2.0)
- Affects decision draft creativity/consistency

**Keyword Providers Tab**:
- Google Ads API integration
- Customer ID, Developer Token, Client credentials
- Refresh token management
- Enable/disable provider

**SEO Context Tab**:
- Include seeds (occasions: Valentines, Halloween, etc.)
- Exclude seeds (terms to avoid)
- Add/archive seeds

**Product Types Tab**:
- Define product categories
- Add synonyms for better matching
- Set required/optional flags
- Archive unused types

### **Login Page** (`/login`)
Authentication entry point:
- Standard email/password login
- Reviewer signup with invite code
- Optional reviewer name field
- Form validation and error handling

### **Initial Admin Setup** (`/setup`)
First-run configuration:
- Only shown if no admin exists
- Create initial admin account
- Name, email, password fields
- Redirects to login on completion

### **404 Not Found**
Friendly error page with navigation back to dashboard

---

## 🔐 Authentication & Authorization

### **AuthContext** (`src/auth/AuthContext.tsx`)
React context providing auth state and methods:
- `user`: Current user object or null
- `loading`: Auth check in progress
- `login(email, password)`: Authenticate user
- `logout()`: Clear session
- Stores JWT in localStorage

### **AuthGate** (`src/auth/AuthGate.tsx`)
Wrapper component that:
1. Checks if initial admin exists
2. Shows setup page if not
3. Shows login if no authenticated user
4. Renders children for authenticated users

### **ProtectedRoute** (`src/auth/ProtectedRoute.tsx`)
Route wrapper requiring authentication:
- Redirects to `/login` if not authenticated
- Used for all dashboard pages

### **PublicOnlyRoute** (`src/auth/PublicOnlyRoute.tsx`)
Route wrapper for login/setup pages:
- Redirects to `/dashboard` if already authenticated
- Prevents authenticated users from seeing login

### **User Roles**
- **Admin**: Full access to all features
- **Reviewer**: Temporary access with invite code
  - Can view and interact with data
  - Limited to review session duration
  - Can end session voluntarily

---

## 🌐 API Integration

### **API Client** (`src/lib/api.ts`)
Centralized API communication:

```typescript
// Generic API function
api<T>(path: string, options?: RequestInit): Promise<T>

// Features:
- Automatic JWT token attachment
- JSON content-type headers
- Error handling with ApiError class
- Empty response handling
- TypeScript generics for type safety
```

### **API URL Builder** (`src/lib/api-url.ts`)
Constructs API URLs with environment-based configuration:
```typescript
buildApiUrl(path: string): string

// Handles:
- Base URL from VITE_API_URL
- Prefix from VITE_API_PREFIX (default: /v1)
- Smart prefix deduplication
- Path normalization
```

### **API Modules**

**Auth API** (`src/api/auth.ts`):
- `login(email, password)`: User authentication
- `createInitialAdmin(data)`: First admin setup
- `reviewerSignup(data)`: Create reviewer account
- `endReviewerAccess()`: Disable reviewer session
- `getToken()`: Retrieve stored JWT
- `hasInitialAdmin()`: Check if admin exists
- `whoami()`: Get current user info

**Data Fetching Patterns**:
- All pages use `api<T>()` for type-safe requests
- Async/await with try/catch error handling
- Loading states with spinners
- Error states with user-friendly messages
- Empty states for no data scenarios

---

## 🎨 UI Components

### **Dashboard Components** (`src/components/dashboard/`)

**PageHeader**:
- Consistent page titles and subtitles
- Action buttons slot
- Responsive design

**ActionBadge**:
- Visual indicators for decision action types
- Color-coded (Add, Update, Archive, Optimize, Research, Review)
- Icon + text labels

**StatusBadge**:
- Decision status display (Planned, Executed, Dismissed)
- Color-coded for quick recognition

**KPICard**:
- Dashboard metric display
- Icon, label, value, trend
- Loading and error states

**LoadingState**:
- Spinner with optional message
- Centered display

**ErrorState**:
- Error icon and message
- Retry button option

**EmptyState**:
- Icon, title, description
- Call-to-action button

### **shadcn/ui Components** (`src/components/ui/`)
50+ pre-built, customizable components including:

**Form Controls**:
- Button, Input, Textarea, Checkbox, Switch, Radio Group
- Select, Combobox, Date Picker
- Slider, OTP Input

**Layout**:
- Card, Separator, Tabs
- Accordion, Collapsible
- Resizable Panels
- Scroll Area

**Overlays**:
- Dialog, Alert Dialog
- Popover, Dropdown Menu, Context Menu
- Tooltip, Hover Card
- Toast, Sonner (notifications)

**Navigation**:
- Navigation Menu, Menubar
- Breadcrumb

**Feedback**:
- Alert, Badge, Progress
- Skeleton (loading placeholders)

**Data Display**:
- Table, Avatar, Carousel
- Command (⌘K menu)

All components:
- Built on Radix UI primitives
- Fully accessible (ARIA compliant)
- Keyboard navigable
- Dark mode compatible
- Customizable with Tailwind

### **Layout Components** (`src/components/layout/`)
- Shared layout wrappers
- Navigation sidebars
- Header/footer components

---

## 🚀 Local Development

### Prerequisites
- Node.js 18+ or Bun 1.0+
- Backend API running (default: http://localhost:3001)

### Installation & Running

#### Option 1: Run from app directory
```bash
cd apps/web
npm install
npm run dev
```

#### Option 2: Run from repo root (runs both frontend and backend)
```bash
npm install
npm run dev
```

### Available Scripts

```json
{
  "dev": "vite",                          // Start dev server
  "build": "vite build",                   // Production build
  "build:dev": "vite build --mode development", // Dev mode build
  "lint": "eslint .",                      // Lint code
  "preview": "vite preview",               // Preview production build
  "test": "vitest run",                    // Run tests once
  "test:watch": "vitest"                   // Run tests in watch mode
}
```

### Development Server
- **URL**: http://localhost:5173 (Vite default)
- **HMR**: Instant updates on file changes
- **React Fast Refresh**: Preserves component state

---

## ⚙️ Environment Variables

Create `apps/web/.env` file:

```env
# Backend API configuration
VITE_API_URL=http://localhost:3001
VITE_API_PREFIX=/v1
```

### Variable Details

**VITE_API_URL**:
- Base URL of the backend API
- Default: `http://localhost:3001`
- Production: Set to deployed backend URL

**VITE_API_PREFIX**:
- API route prefix (e.g., `/v1`, `/api/v1`)
- Default: `/v1`
- Can be empty if backend doesn't use prefix
- System avoids duplicating prefix if already in base URL

### Examples

**Local development**:
```env
VITE_API_URL=http://localhost:3001
VITE_API_PREFIX=/v1
# Results in: http://localhost:3001/v1/...
```

**Production with proxy**:
```env
VITE_API_URL=https://api.stylenya.com/v1
VITE_API_PREFIX=
# Results in: https://api.stylenya.com/v1/... (no duplication)
```

**Production without prefix**:
```env
VITE_API_URL=https://api.stylenya.com
VITE_API_PREFIX=/api/v1
# Results in: https://api.stylenya.com/api/v1/...
```

---

## 🧪 Testing

### Test Framework
- **Vitest**: Fast, Vite-native unit testing
- **Testing Library**: React component testing
- **jsdom**: Browser environment simulation

### Running Tests

```bash
# Run all tests once
npm test

# Watch mode (reruns on changes)
npm run test:watch
```

### Test Configuration
- Config file: `vitest.config.ts`
- Test files: `*.test.ts`, `*.test.tsx`
- Located in `src/test/` or co-located with components

### Coverage
Run with coverage reporting:
```bash
npm run test -- --coverage
```

---

## 🎯 Key Technical Highlights

### 1. **Type Safety**
- Comprehensive TypeScript coverage
- API response types defined in `lib/api.ts`
- Zod schemas for runtime validation
- No `any` types in production code

### 2. **Performance**
- React Query for intelligent caching and refetching
- Debounced search inputs
- Lazy loading with React.lazy (where applicable)
- Optimized re-renders with proper React patterns

### 3. **Accessibility**
- WCAG 2.1 AA compliant
- Keyboard navigation throughout
- Screen reader friendly
- Focus management in modals

### 4. **Responsive Design**
- Mobile-first Tailwind approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Touch-friendly targets
- Adaptive layouts

### 5. **Error Handling**
- Centralized ApiError class
- User-friendly error messages
- Retry mechanisms
- Toast notifications for feedback

### 6. **Code Organization**
- Feature-based folder structure
- Separated concerns (UI, logic, API)
- Reusable components
- Consistent naming conventions

---

## 🔗 Related Documentation

- [Backend API Documentation](../api/README.md)
- [Deployment Guide](../../docs/deployment.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)

---

## 📝 Notes

- This is a monorepo app under `apps/web/`
- Backend counterpart is in `apps/api/`
- Uses Bun as package manager (see `bun.lockb`)
- Built with Lovable.dev tooling (`lovable-tagger`)
- Vite HMR port: 5173 (default)
- Production builds to `dist/` folder