// Re-export API types so existing imports from "../types" keep working.
export type {
  User,
  Thread,
  Comment,
  Club,
  ClubThread,
  InstitutionalContext,
} from "../lib/api";

// Scope aliases
export type Scope = "local" | "national" | "european";
export type UserRole = "citizen" | "institution" | "moderator";
export type InstitutionType = "municipality" | "agency" | "ministry";

// Re-export UserSummary for components that import it from types
export type { UserSummary, ClubMemberSummary } from "../lib/api";

// Demo/fixture-only types (used by data/ mock files and ServicesPage)
export interface Service {
  id: string;
  name?: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  url: string;
  provider?: string;
  municipality?: string;
  integrationDemoType?: string;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  isOwn?: boolean;
}

export interface MessageGroup {
  id: string;
  name: string;
  avatar?: string;
  lastMessage?: string;
  unread?: number;
  messages: Message[];
}
