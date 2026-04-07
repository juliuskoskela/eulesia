import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Hash, Building2, Tag } from "lucide-react";
import { Layout } from "../components/layout";
import { SEOHead } from "../components/SEOHead";
import { ThreadCard } from "../components/agora/ThreadCard";
import { FollowButton } from "../components/common";
import { useTagPage, useVoteThread } from "../hooks/useApi";
import type { Thread as ApiThread } from "../lib/api";
import { getAvatarInitials } from "../utils/avatar";

function transformThread(thread: ApiThread) {
  return {
    id: thread.id,
    title: thread.title,
    scope: thread.scope,
    municipalityId: thread.municipality?.id,
    municipalityName: thread.municipality?.name,
    tags: thread.tags,
    authorId: thread.authorId ?? thread.author?.id ?? "",
    content: thread.content,
    contentHtml: thread.contentHtml,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    replyCount: thread.replyCount,
    score: thread.score,
    userVote: thread.userVote,
    institutionalContext: thread.institutionalContext,
    source: thread.source,
    sourceUrl: thread.sourceUrl,
    aiGenerated: thread.aiGenerated,
  };
}

export function TagPage() {
  const { t } = useTranslation(["agora", "common"]);
  const { tagName } = useParams<{ tagName: string }>();
  const decodedTag = decodeURIComponent(tagName || "");

  const { data, isLoading, error } = useTagPage(decodedTag);
  const voteMutation = useVoteThread();

  const handleVote = (threadId: string, value: number) => {
    voteMutation.mutate({ threadId, value });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !data) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <p className="text-gray-500">{t("tag.notFound")}</p>
          <Link
            to="/agora"
            className="text-blue-600 hover:underline mt-2 inline-block"
          >
            {t("thread.returnToAgora")}
          </Link>
        </div>
      </Layout>
    );
  }

  const displayName =
    data.tagMeta?.displayName || decodedTag.replace(/-/g, " ");
  const description =
    data.institution?.description || data.tagMeta?.description;

  return (
    <Layout>
      <SEOHead
        title={`${displayName} – Agora`}
        description={
          description || `Keskustelut aiheesta ${displayName} Eulesia-alustalla`
        }
        path={`/agora/tag/${tagName}`}
      />
      {/* Back navigation */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-2">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("common:actions.back")}
        </button>
      </div>

      {/* Tag header */}
      <div className="bg-gradient-to-b from-teal-50 to-white dark:from-teal-900/30 dark:to-gray-900 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-teal-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <Hash className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {displayName}
            </h1>
            {description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {description}
              </p>
            )}
            {data.tagMeta?.category && (
              <div className="flex items-center gap-1.5 mt-2">
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs text-gray-500 capitalize">
                  {data.tagMeta.category}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Institution link if this is an institution topic */}
        {data.institution && (
          <div className="mt-3 p-3 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              <Link
                to={`/user/${data.institution.institutionId}`}
                className="text-sm font-medium text-violet-700 dark:text-violet-400 hover:underline"
              >
                {data.institution.institutionName}
              </Link>
            </div>
            {data.institution.relatedTags &&
              data.institution.relatedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {data.institution.relatedTags.map((tag) => (
                    <Link
                      key={tag}
                      to={`/agora/tag/${encodeURIComponent(tag)}`}
                      className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full hover:bg-violet-200 dark:hover:bg-violet-900/50"
                    >
                      {tag.replace(/-/g, " ")}
                    </Link>
                  ))}
                </div>
              )}
          </div>
        )}

        {/* Follow button */}
        <div className="mt-2">
          <FollowButton entityType="tag" entityId={decodedTag} />
        </div>

        <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {t("tag.thread", { count: data.total })}
        </div>
      </div>

      {/* Thread list */}
      <div className="px-4 py-4 space-y-3">
        {data.items.length > 0 ? (
          data.items.map((thread) => (
            <ThreadCard
              key={thread.id}
              thread={transformThread(thread)}
              author={(() => {
                const a = thread.author ?? {
                  id: "",
                  name: "",
                  role: "citizen" as const,
                };
                return { ...a, avatarInitials: getAvatarInitials(a.name) };
              })()}
              onVote={handleVote}
              isVoting={voteMutation.isPending}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Hash className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>{t("tag.noThreads")}</p>
          </div>
        )}

        {/* Pagination hint */}
        {data.hasMore && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">
              {t("tag.showing", {
                shown: data.items.length,
                total: data.total,
              })}
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
