# Code Review Rubric

Structured approach to reviewing TypeScript and React code in the Eulesia
frontend. Score 1–10 on each axis, weight by relevance.

## Axes

### Type safety (weight: high)

- No `any` in public interfaces (props, function signatures, API responses)
- Discriminated unions for multi-state values (not bags of optionals)
- String literal types for modes/variants — not bare `string`
- Generic types reduce duplication without sacrificing readability
- `as` type assertions are rare and justified

### Component design (weight: high)

- Components are renderers, not orchestrators (no fetch in components)
- Props typed precisely with no `any`
- State derived where possible (`useMemo` over manual sync)
- `useEffect` used only for genuine side effects, never for derived state
- Single responsibility: one component does one thing well
- Callbacks typed with exact parameters

### Data flow (weight: high)

- API calls go through `src/lib/api.ts`, not raw `fetch`
- Loading and error states handled explicitly (not just happy path)
- Mutations through the API client with optimistic updates where appropriate
- All user-facing strings go through `useTranslation()`

### Error handling (weight: medium-high)

- Every user-facing error has an i18n-ready message
- API errors parsed into typed `AppError`
- Form validation errors mapped to specific fields
- No swallowed `catch` blocks — at minimum, show user feedback
- Error boundaries at appropriate levels

### State management (weight: medium)

- Minimal state: if derivable, derive with `useMemo`
- URL state for anything bookmarkable (filters, pagination, tabs)
- React context for cross-component state, not prop drilling avoidance
- `useState` only for values that change and trigger re-renders

### Accessibility (weight: medium)

- Semantic HTML (not `<div>` with click handlers replacing `<button>`)
- ARIA attributes where semantic HTML isn't sufficient
- Keyboard navigation works (tab order, Enter/Space, Escape)
- Color is not the only indicator
- Focus management on route transitions and modal open/close
- Form labels associated with inputs

### Performance (weight: medium)

- No unnecessary re-renders from state changes
- Large lists use virtualization or pagination
- Images lazy-loaded below the fold
- `useMemo`/`useCallback` for expensive computations and stable references
- Bundle size conscious

### Style & conventions (weight: low)

- `camelCase` for variables/functions, `PascalCase` for components/types
- No dead code
- Functions ≤ 40 lines, components ≤ 200 lines (soft limits)
- `async/await` over `.then()` chains

## Scoring guide

- **9–10**: Production-grade. Types enforce contracts, state flows cleanly,
  errors handled for the user, accessible by default.
- **7–8**: Solid with improvement areas.
- **5–6**: Functional but brittle. `any` types, state sync bugs, happy-path only.
- **3–4**: Significant issues. Fetching in components, untyped props.
- **1–2**: Needs rewrite.

## Anti-patterns to flag

### The `any` escape hatch

```typescript
function processData(data: any) { ... }  // type the actual shape
```

### Effect-driven derived state

```typescript
// BAD
const [items, setItems] = useState([]);
const [total, setTotal] = useState(0);
useEffect(() => { setTotal(items.reduce(...)); }, [items]);

// GOOD
const total = useMemo(() => items.reduce(...), [items]);
```

### The god component

500+ lines that fetches, transforms, renders, and manages state.
Split into page (data loading), container (state), presenter (rendering).

### Fetch-in-component

```typescript
// BAD: useEffect + fetch for data that belongs in a page/hook
useEffect(() => { fetch('/api/...').then(/* */); }, []);

// GOOD: data loaded in page component or custom hook, passed as props
```

### Stringly-typed events

```typescript
// BAD: magic strings
dispatch({ type: 'UPDATE', payload: value });

// GOOD: typed callback props
interface Props { onUpdate: (value: ThreadUpdate) => void; }
```
