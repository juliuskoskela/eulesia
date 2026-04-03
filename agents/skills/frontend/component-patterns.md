# Component Patterns

React component design, hooks, composition, accessibility, and rendering
patterns for the Eulesia frontend.

## React hooks conventions

### useState: mutable reactive values

```typescript
// Primitive state
const [count, setCount] = useState(0);
const [title, setTitle] = useState("");

// Object/array state
const [threads, setThreads] = useState<Thread[]>([]);
const [filters, setFilters] = useState({
  scope: "local" as Scope,
  sort: "newest",
});

// Updating objects: spread to create new reference
setFilters((prev) => ({ ...prev, scope: "national" }));
```

### useMemo: computed values

```typescript
const [threads, setThreads] = useState<Thread[]>([]);
const [searchQuery, setSearchQuery] = useState("");

// Simple derived
const count = useMemo(() => threads.length, [threads]);

// Derived with computation
const filtered = useMemo(
  () =>
    threads.filter((t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  [threads, searchQuery],
);

// Derived chain
const totalScore = useMemo(
  () => filtered.reduce((sum, t) => sum + t.score, 0),
  [filtered],
);
```

**Rules**:

- Use `useMemo` for any computation that depends on state/props
- Don't use `useEffect` + `setState` for derived values
- Dependency arrays must be complete and correct

### useEffect: side effects only

```typescript
// GOOD: external subscription
useEffect(() => {
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (e) => setMessages((prev) => [...prev, JSON.parse(e.data)]);
  return () => ws.close();
}, [wsUrl]);

// GOOD: DOM interaction
useEffect(() => {
  if (open) inputRef.current?.focus();
}, [open]);

// GOOD: debounced URL update
useEffect(() => {
  const timeout = setTimeout(() => {
    setSearchParams((prev) => {
      prev.set("q", query);
      return prev;
    });
  }, 300);
  return () => clearTimeout(timeout);
}, [query]);

// BAD: computing derived state — use useMemo
// useEffect(() => { setTotal(items.reduce(...)); }, [items]);
```

### Custom hooks

```typescript
// hooks/useThreads.ts
function useThreads(scope: Scope) {
  const [state, setState] = useState<AsyncState<Thread[]>>({
    status: "loading",
  });

  useEffect(() => {
    setState({ status: "loading" });
    api
      .getThreads(scope)
      .then((data) => setState({ status: "success", data: data.data }))
      .catch((err) => setState({ status: "error", error: toAppError(err) }));
  }, [scope]);

  return state;
}
```

## Component composition

### Props interface pattern

```typescript
// Explicit interface (preferred for complex props)
interface ThreadCardProps {
  thread: Thread;
  onVote: (threadId: string, value: 1 | -1) => Promise<void>;
  onComment?: () => void;
  compact?: boolean;
}

function ThreadCard({
  thread,
  onVote,
  onComment,
  compact = false,
}: ThreadCardProps) {
  // ...
}
```

**Rules**:

- Always type props (no untyped destructuring)
- Default values in the parameter destructuring
- Callbacks specify exact parameter and return types
- No `any` in props

### Children and render props

```typescript
// Children for simple composition
interface CardProps {
  title: string;
  children: React.ReactNode;
}

function Card({ title, children }: CardProps) {
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  );
}

// Render props for typed rendering
interface DataListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
}

function DataList<T>({ items, renderItem, emptyMessage }: DataListProps<T>) {
  if (items.length === 0) return <p>{emptyMessage ?? 'No items'}</p>;
  return <>{items.map((item, i) => renderItem(item, i))}</>;
}
```

## Accessibility patterns

### Semantic HTML first

```tsx
// BAD: div soup
<div className="btn" onClick={save}>Save</div>
<div className="input-wrapper">
  <div className="label">Title</div>
  <div className="input" contentEditable></div>
</div>

// GOOD: semantic elements
<button onClick={save}>Save</button>
<label>
  Title
  <input type="text" value={title} onChange={e => setTitle(e.target.value)} />
</label>
```

### Keyboard navigation

```typescript
function handleKeyDown(e: React.KeyboardEvent) {
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      focusNext();
      break;
    case "ArrowUp":
      e.preventDefault();
      focusPrevious();
      break;
    case "Escape":
      close();
      break;
    case "Enter":
    case " ":
      e.preventDefault();
      selectCurrent();
      break;
  }
}
```

### Loading and error states

```tsx
// Always communicate state to screen readers
{
  state.status === "loading" && (
    <div role="status" aria-live="polite">
      <Spinner />
      <span className="sr-only">{t("loading")}</span>
    </div>
  );
}
{
  state.status === "error" && (
    <div role="alert">
      <p>{state.error.message}</p>
      {state.error.recovery === "retry" && (
        <button onClick={retry}>{t("tryAgain")}</button>
      )}
    </div>
  );
}
```

### Focus management

```typescript
// Focus first element when modal opens
useEffect(() => {
  if (open && dialogRef.current) {
    const first = dialogRef.current.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    first?.focus();
  }
}, [open]);
```

## Performance patterns

### Debounced inputs

```typescript
const [rawQuery, setRawQuery] = useState("");
const [debouncedQuery, setDebouncedQuery] = useState("");

useEffect(() => {
  const timeout = setTimeout(() => setDebouncedQuery(rawQuery), 300);
  return () => clearTimeout(timeout);
}, [rawQuery]);

// Use debouncedQuery for expensive operations
const results = useMemo(
  () => search(items, debouncedQuery),
  [items, debouncedQuery],
);
```

### Lazy loading components

```typescript
const MapView = React.lazy(() => import('./MapView'));

function AgoraPage() {
  return (
    <Suspense fallback={<Skeleton height={400} />}>
      <MapView threads={threads} />
    </Suspense>
  );
}
```

Use for heavy components (maps, charts, editors) not needed on initial render.

### Stable references with useCallback

```typescript
// Stable callback for child components that use React.memo
const handleVote = useCallback(
  async (threadId: string, value: 1 | -1) => {
    await api.voteThread(threadId, value);
    refetch();
  },
  [refetch],
);
```

## Conditional CSS with Tailwind

```tsx
// Use template literals or clsx for conditional classes
<tr className={`border-b ${thread.isPinned ? 'bg-amber-50' : ''}`}>
<button className={`px-4 py-2 rounded ${scope === 'local' ? 'bg-blue-800 text-white' : 'bg-gray-100'}`}>
```

## File naming conventions

```
src/
├── pages/
│   ├── LoginPage.tsx          PascalCase + Page suffix
│   ├── AgoraPage.tsx
│   └── ProfilePage.tsx
├── components/
│   ├── agora/
│   │   ├── ThreadCard.tsx     PascalCase for components
│   │   └── ThreadList.tsx
│   └── ui/
│       ├── Button.tsx
│       └── Modal.tsx
├── hooks/
│   ├── useAuth.ts             camelCase with use prefix
│   └── useThreads.ts
├── lib/
│   ├── api.ts                 camelCase for modules
│   └── runtimeConfig.ts
├── types/
│   └── thread.ts              camelCase for type files
└── utils/
    ├── format.ts
    └── validation.ts
```

Co-locate tests: `format.test.ts` next to `format.ts`.
