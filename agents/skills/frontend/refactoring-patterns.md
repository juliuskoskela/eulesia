# Refactoring Patterns

Concrete patterns for decomposing and tightening TypeScript and React code
in the Eulesia frontend.

## Pattern 1: Replace optional fields with discriminated unions

### Symptom

An interface has 3+ optional fields, and code is full of `if (x.foo)` checks.

```typescript
// BEFORE
interface ThreadState {
  thread?: Thread;
  error?: string;
  loading?: boolean;
  stale?: boolean;
}

// AFTER
type ThreadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; thread: Thread }
  | { status: "error"; error: AppError; retryable: boolean };
```

## Pattern 2: Extract data fetching from components

### Symptom

A component has `useEffect` + `fetch`, manages loading/error state,
and renders the result. The component is untestable without mocking fetch.

```typescript
// BEFORE: everything in the component
function AgoraPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getThreads(scope).then(setThreads).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [scope]);

  return /* render loading/error/threads */;
}

// AFTER: custom hook handles data, component is pure renderer
function useThreads(scope: Scope) {
  const [state, setState] = useState<AsyncState<Thread[]>>({ status: 'loading' });
  useEffect(() => {
    api.getThreads(scope)
      .then(data => setState({ status: 'success', data }))
      .catch(error => setState({ status: 'error', error: toAppError(error), retryable: true }));
  }, [scope]);
  return state;
}

function AgoraPage() {
  const threads = useThreads(scope);
  if (threads.status === 'loading') return <Spinner />;
  if (threads.status === 'error') return <ErrorBanner error={threads.error} />;
  return <ThreadList threads={threads.data} />;
}
```

## Pattern 3: Replace useEffect with useMemo for derived state

### Symptom

`useEffect` blocks that compute a value and call `setState`.

```typescript
// BEFORE
const [threads, setThreads] = useState<Thread[]>([]);
const [searchQuery, setSearchQuery] = useState("");
const [filtered, setFiltered] = useState<Thread[]>([]);

useEffect(() => {
  setFiltered(
    threads.filter((t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  );
}, [threads, searchQuery]);

// AFTER
const filtered = useMemo(
  () =>
    threads.filter((t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  [threads, searchQuery],
);
```

### When useEffect IS appropriate

- DOM interaction (focus, scroll, resize observers)
- External subscriptions (WebSocket, event listeners)
- Browser API calls (localStorage, clipboard)
- Analytics/logging side effects

The test: does this block produce a value or cause a side effect?
Values → `useMemo`. Side effects → `useEffect`.

## Pattern 4: Extract form logic into a custom hook

### Symptom

A component has inline validation, submission, error state, and field-level
error mapping tangled with rendering.

```typescript
// useForm.ts
function useForm<T>(config: {
  initial: T;
  validate: (values: T) => Partial<Record<keyof T, string>>;
  onSubmit: (values: T) => Promise<void>;
}) {
  const [values, setValues] = useState(config.initial);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const updateField = <K extends keyof T>(field: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors({});
  };

  const submit = async () => {
    const fieldErrors = config.validate(values);
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      await config.onSubmit(values);
    } catch (e) {
      setErrors({ _form: toAppError(e).message } as any);
    } finally {
      setSubmitting(false);
    }
  };

  return { values, errors, submitting, updateField, submit };
}
```

## Pattern 5: Lift URL-representable state to the URL

### Symptom

Component state (filters, sort order, tabs, pagination) lost on refresh.

```typescript
// BEFORE: state in component, lost on refresh
const [scope, setScope] = useState<Scope>("local");
const [sort, setSort] = useState("newest");

// AFTER: state in URL, preserved
const [searchParams, setSearchParams] = useSearchParams();
const scope = (searchParams.get("scope") ?? "local") as Scope;
const sort = searchParams.get("sort") ?? "newest";

function setScope(s: Scope) {
  setSearchParams((prev) => {
    prev.set("scope", s);
    return prev;
  });
}
```

## Pattern 6: Split container and presenter components

### Symptom

A component manages state, handles events, transforms data, AND renders
complex markup. Over 200 lines.

```typescript
// Container: state + logic
function AgoraPageContainer({ threads }: { threads: Thread[] }) {
  const [scope, setScope] = useState<Scope>('local');
  const filtered = useMemo(() => threads.filter(t => t.scope === scope), [threads, scope]);

  return <AgoraView threads={filtered} scope={scope} onScopeChange={setScope} />;
}

// Presenter: pure rendering, easily testable
function AgoraView({ threads, scope, onScopeChange }: AgoraViewProps) {
  return /* pure markup */;
}
```

## Pattern 7: Replace magic strings with const objects

```typescript
// BEFORE
if (thread.scope === 'lcal') { ... }  // typo compiles

// AFTER
export const SCOPE = { LOCAL: 'local', NATIONAL: 'national', EUROPEAN: 'european' } as const;
export type Scope = typeof SCOPE[keyof typeof SCOPE];
```

## General heuristics

- **Extract when a component exceeds 200 lines** (hard limit: 300)
- **Extract when a function exceeds 40 lines** (hard limit: 60)
- **Extract when `useEffect` computes a value** → `useMemo`
- **Extract when a component fetches data** → custom hook
- **Lift to URL when state is shareable** (filters, sort, pagination, tabs)
- **Name components for what they render**: `ThreadList`, not `ThreadDataFetcherAndRenderer`
