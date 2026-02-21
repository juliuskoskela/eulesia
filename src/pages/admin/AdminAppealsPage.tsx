import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { AdminLayout } from "../../components/admin";
import { useAdminAppeals, useResolveAppeal } from "../../hooks/useAdminApi";
import { formatRelativeTime } from "../../lib/formatTime";

export function AdminAppealsPage() {
  const { t } = useTranslation("admin");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");

  const { data, isLoading } = useAdminAppeals({
    page,
    limit: 20,
    status: statusFilter || undefined,
  });
  const resolveAppealMutation = useResolveAppeal();

  const handleResolve = async (id: string, status: "accepted" | "rejected") => {
    if (!responseText.trim()) return;
    await resolveAppealMutation.mutateAsync({
      id,
      data: { status, adminResponse: responseText },
    });
    setRespondingId(null);
    setResponseText("");
  };

  return (
    <AdminLayout>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        {t("appeals.title")}
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">{t("appeals.allStatuses")}</option>
          <option value="pending">{t("appeals.pending")}</option>
          <option value="accepted">{t("appeals.accepted")}</option>
          <option value="rejected">{t("appeals.rejected")}</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data?.items?.map((appeal) => (
              <div
                key={appeal.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {appeal.userName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      {formatRelativeTime(appeal.createdAt)}
                    </span>
                  </div>
                  <StatusBadge status={appeal.status} />
                </div>

                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                  {appeal.reason}
                </p>

                {appeal.adminResponse && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {t("appeals.adminResponse")}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {appeal.adminResponse}
                    </p>
                  </div>
                )}

                {appeal.status === "pending" &&
                  (respondingId === appeal.id ? (
                    <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-800">
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        placeholder={t("appeals.responsePlaceholder")}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm resize-none dark:bg-gray-900 dark:text-gray-100"
                        rows={3}
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => {
                            setRespondingId(null);
                            setResponseText("");
                          }}
                          className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300"
                        >
                          {t("common.cancel")}
                        </button>
                        <button
                          onClick={() => handleResolve(appeal.id, "rejected")}
                          disabled={
                            !responseText.trim() ||
                            resolveAppealMutation.isPending
                          }
                          className="text-sm px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          {t("appeals.reject")}
                        </button>
                        <button
                          onClick={() => handleResolve(appeal.id, "accepted")}
                          disabled={
                            !responseText.trim() ||
                            resolveAppealMutation.isPending
                          }
                          className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {t("appeals.accept")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRespondingId(appeal.id)}
                      className="text-sm text-blue-600 hover:underline mt-2"
                    >
                      {t("appeals.respond")}
                    </button>
                  ))}
              </div>
            ))}
            {!data?.items?.length && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                {t("appeals.noAppeals")}
              </div>
            )}
          </div>

          {data && data.total > 20 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {(page - 1) * 20 + 1}-{Math.min(page * 20, data.total)} /{" "}
                {data.total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!data.hasMore}
                  className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    accepted: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] || "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"}`}
    >
      {status}
    </span>
  );
}
