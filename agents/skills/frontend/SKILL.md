---
name: frontend-ts-style
description: >
  Opinionated TypeScript and React code style, architecture, and review guide
  for the Eulesia frontend. Use this skill whenever reviewing, writing,
  refactoring, or designing frontend code in `src/`. Triggers include:
  TypeScript code review, React component design, "review this component",
  "refactor this page", state management patterns, API client design, or
  any request involving frontend code quality. Also use when the user asks
  about form handling, error boundaries, hooks, accessibility, or
  TypeScript type design.
---

# Frontend TypeScript & React Style Guide

An opinionated style guide for the Eulesia frontend. React 19 + TypeScript +
Vite + React Router + Tailwind CSS. Prioritizes **types as documentation**,
**derived state over synced state**, and **accessibility by default**.

## When to use this skill

- **Code review**: Score and critique TS/React modules. See `frontend/review-rubric.md`.
- **Refactoring**: Decompose components, tighten types, simplify state.
  See `frontend/refactoring-patterns.md`.
- **Architecture**: Project structure, API design, state management.
  See `frontend/architecture.md`.
- **Components**: React patterns, composition, accessibility.
  See `frontend/component-patterns.md`.

Always read the relevant reference file before responding. Multiple may apply.

## Eulesia-specific conventions

### Project structure

```
src/
├── App.tsx                     Route definitions, auth wrapper
├── pages/                      Page-level components (one per route)
├── components/                 Shared UI and domain components
│   ├── agora/                  Agora-specific components
│   ├── clubs/                  Club-specific components
│   ├── admin/                  Admin panel components
│   └── SEOHead.tsx             Shared utility components
├── hooks/                      Custom React hooks (useAuth, useApi, etc.)
├── lib/                        API client, runtime config, utilities
│   ├── api.ts                  Typed API client
│   └── runtimeConfig.ts        Environment-based config
├── types/                      Shared TypeScript types
├── utils/                      Pure utility functions
└── data/                       Static/mock data
```

### Key conventions

- **i18n**: All user-facing strings via `useTranslation()` from react-i18next
- **API client**: `src/lib/api.ts` — all API calls go through here, not raw `fetch`
- **Auth**: `useAuth()` hook for session state, login/logout
- **Routing**: React Router v7 with `<Navigate>` for redirects
- **Styling**: Tailwind CSS 4, no CSS modules
- **E2EE**: Client owns all crypto — see `docs/architecture.md` for scope

## Core principles (always in context)

### 1. Discriminated unions over optional fields

```typescript
// BAD: which combinations are valid?
type ApiState = {
  data?: Thread[];
  error?: string;
  loading: boolean;
};

// GOOD: exactly 4 states, each with only the data that exists
type ApiState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; error: AppError; retryable: boolean };
```

### 2. Derive state, don't sync it

If a value can be computed from other values, compute it with `useMemo`.
Don't store it in a separate `useState` and try to keep it in sync.

```typescript
// BAD: synced state — will drift
const [threads, setThreads] = useState<Thread[]>([]);
const [filteredCount, setFilteredCount] = useState(0);

useEffect(() => {
  setFilteredCount(threads.filter((t) => t.scope === scope).length);
}, [threads, scope]);

// GOOD: derived — always correct
const [threads, setThreads] = useState<Thread[]>([]);
const filteredCount = useMemo(
  () => threads.filter((t) => t.scope === scope).length,
  [threads, scope],
);
```

### 3. Props are contracts

Type component props precisely. No `any`.

```typescript
// BAD
interface Props {
  data?: any;
  onSave?: (data: any) => void;
  mode?: string;
}

// GOOD
interface Props {
  thread: Thread;
  onVote: (threadId: string, value: 1 | -1) => Promise<void>;
  scope: "local" | "national" | "european";
}
```

### 4. Errors are user-facing

Every error needs a human-readable message and a recovery action.
All user-facing strings go through i18n.

```typescript
type AppError = {
  code: string;
  message: string; // user-facing, via i18n
  detail?: string; // technical, for debugging
  recovery?: "retry" | "refresh" | "login";
};
```

### 5. Components are renderers, not orchestrators

Components receive data and emit events. They don't fetch data or manage
global state. Data fetching lives in hooks or page-level components.

```typescript
// BAD: component fetches its own data
function ThreadList() {
  const [threads, setThreads] = useState([]);
  useEffect(() => {
    fetch("/api/v1/threads").then(/* ... */);
  }, []);
  return /* render */;
}

// GOOD: page provides data, component renders
function ThreadList({ threads, onVote }: Props) {
  return /* render threads, call onVote on interaction */;
}
```

### 6. Server blindness for E2EE content

The client is the sole authority for cryptographic operations. Message
content is encrypted/decrypted only on the client. The API client sends
and receives opaque `Uint8Array` blobs for encrypted content.
