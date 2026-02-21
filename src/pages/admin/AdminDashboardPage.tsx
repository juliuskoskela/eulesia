import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Users, MessageSquare, Flag, Scale, Loader2 } from "lucide-react";
import { AdminLayout } from "../../components/admin";
import { useAdminDashboard } from "../../hooks/useAdminApi";
import { formatRelativeTime } from "../../lib/formatTime";

export function AdminDashboardPage() {
  const { t } = useTranslation("admin");
  const { data, isLoading } = useAdminDashboard();

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </AdminLayout>
    );
  }

  const stats = data?.stats;

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        {t("dashboard.title")}
      </h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Users className="w-5 h-5 text-blue-600" />}
          label={t("dashboard.totalUsers")}
          value={stats?.totalUsers ?? 0}
          to="/admin/users"
        />
        <StatCard
          icon={<MessageSquare className="w-5 h-5 text-green-600" />}
          label={t("dashboard.totalThreads")}
          value={stats?.totalThreads ?? 0}
        />
        <StatCard
          icon={<Flag className="w-5 h-5 text-orange-600" />}
          label={t("dashboard.pendingReports")}
          value={stats?.pendingReports ?? 0}
          to="/admin/reports"
          highlight={!!stats?.pendingReports}
        />
        <StatCard
          icon={<Scale className="w-5 h-5 text-purple-600" />}
          label={t("dashboard.pendingAppeals")}
          value={stats?.pendingAppeals ?? 0}
          to="/admin/appeals"
          highlight={!!stats?.pendingAppeals}
        />
      </div>

      {/* Recent reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              {t("dashboard.recentReports")}
            </h2>
            <Link
              to="/admin/reports"
              className="text-sm text-blue-600 hover:underline"
            >
              {t("dashboard.viewAll")}
            </Link>
          </div>
          {data?.recentReports?.length ? (
            <div className="space-y-3">
              {data.recentReports.map((report) => (
                <Link
                  key={report.id}
                  to={`/admin/reports/${report.id}`}
                  className="block p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                      {report.reason}
                    </span>
                    <StatusBadge status={report.status} />
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {report.contentType} · {report.reporterName} ·{" "}
                    {formatRelativeTime(report.createdAt)}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
              {t("dashboard.noReports")}
            </p>
          )}
        </div>

        {/* Recent actions */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              {t("dashboard.recentActions")}
            </h2>
            <Link
              to="/admin/modlog"
              className="text-sm text-blue-600 hover:underline"
            >
              {t("dashboard.viewAll")}
            </Link>
          </div>
          {data?.recentActions?.length ? (
            <div className="space-y-3">
              {data.recentActions.map((action) => (
                <div key={action.id} className="p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatActionType(action.actionType)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatRelativeTime(action.createdAt)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {action.adminName} · {action.targetType}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
              {t("dashboard.noActions")}
            </p>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function StatCard({
  icon,
  label,
  value,
  to,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  to?: string;
  highlight?: boolean;
}) {
  const content = (
    <div
      className={`bg-white dark:bg-gray-900 rounded-xl border p-5 ${highlight ? "border-orange-300 bg-orange-50 dark:bg-orange-900/20" : "border-gray-200 dark:border-gray-800"}`}
    >
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block hover:shadow-md transition-shadow rounded-xl"
      >
        {content}
      </Link>
    );
  }
  return content;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    reviewing: "bg-blue-100 text-blue-800",
    resolved: "bg-green-100 text-green-800",
    dismissed: "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"}`}
    >
      {status}
    </span>
  );
}

function formatActionType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
