// Re-export API types for backwards compatibility.
// New code should import directly from ../lib/api or ../types/generated/.
export type { User, Thread, InstitutionalContext } from "../lib/api";

// Scope union — used by agora filter components.
// Will be replaced by generated ThreadScope when components migrate.
export type Scope = "local" | "national" | "european";
