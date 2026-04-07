// Admin-specific types — dashboard, moderation, waitlist.
// These are NOT generated from Rust; they exist only in the frontend.

export interface AdminSanction {
  id: string;
  sanctionType: "warning" | "suspension" | "ban";
  reason: string;
  issuedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  issuerName?: string;
}

export interface AdminReportContentPreview {
  title?: string;
  content?: string;
  name?: string;
  authorId?: string;
  [key: string]: unknown;
}

export interface GeneratedAdminInvite {
  id: string;
  code: string;
  createdAt: string;
}

export interface AdminDashboard {
  stats: {
    totalUsers: number;
    totalThreads: number;
    totalClubs: number;
    pendingReports: number;
    pendingAppeals: number;
  };
  recentReports: {
    id: string;
    contentType: string;
    reason: string;
    status: string;
    createdAt: string;
    reporterName: string;
  }[];
  recentActions: {
    id: string;
    actionType: string;
    targetType: string;
    reason: string;
    createdAt: string;
    adminName: string;
  }[];
}

export interface AdminUser {
  id: string;
  email: string | null;
  username: string;
  name: string;
  avatarUrl?: string;
  role: "citizen" | "institution" | "moderator";
  institutionType?: string;
  institutionName?: string;
  identityVerified: boolean;
  createdAt: string;
  lastSeenAt?: string;
}

export interface AdminUserDetail extends AdminUser {
  sanctions: AdminSanction[];
  threadCount: number;
  commentCount: number;
  inviteCodesRemaining: number;
}

export interface IssueSanctionData {
  sanctionType: "warning" | "suspension" | "ban";
  reason: string;
  expiresAt?: string;
}

export interface AdminReport {
  id: string;
  contentType: string;
  contentId: string;
  reason: string;
  description?: string;
  status: string;
  createdAt: string;
  resolvedAt?: string;
  reporterName: string;
  reporterUserId: string;
}

export interface AdminReportDetail extends AdminReport {
  content: AdminReportContentPreview | null;
  assignedTo?: string;
}

export interface TransparencyStats {
  period: { from: string; to: string };
  reports: {
    byStatus: { status: string; count: number }[];
    byReason: { reason: string; count: number }[];
    byContentType: { contentType: string; count: number }[];
    avgResponseTimeHours: number | null;
  };
  actions: {
    byType: { actionType: string; count: number }[];
  };
  sanctions: {
    byType: { sanctionType: string; count: number }[];
  };
  appeals: {
    byStatus: { status: string; count: number }[];
  };
}

export interface AdminAppeal {
  id: string;
  reason: string;
  status: "pending" | "accepted" | "rejected";
  adminResponse?: string;
  createdAt: string;
  respondedAt?: string;
  sanctionId?: string;
  reportId?: string;
  actionId?: string;
  userId: string;
  userName: string;
}

export interface SystemAnnouncement {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "critical";
  createdAt: string;
  expiresAt: string | null;
}

export interface AdminAnnouncement extends SystemAnnouncement {
  active: boolean;
  createdByName: string | null;
}

export interface AdminInvite extends GeneratedAdminInvite {
  status: "available" | "used" | "revoked";
  usedAt: string | null;
  usedBy: { name: string } | null;
}

export interface AvailableInstitution {
  id: string;
  name: string;
  institutionType: "municipality" | "agency" | "ministry";
  institutionName: string;
  municipalityId: string | null;
  identityProvider: string;
}

export interface InstitutionClaim {
  id: string;
  institutionId: string;
  userId: string;
  role: "owner" | "editor";
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  name: string | null;
  status: "pending" | "approved" | "rejected";
  locale: string;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  emailSentAt: string | null;
  note: string | null;
}

export interface WaitlistStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}
